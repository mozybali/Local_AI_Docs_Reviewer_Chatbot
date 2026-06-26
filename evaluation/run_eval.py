"""Retrieval değerlendirme + eşik kalibrasyon runner'ı (Hafta 3-4).

`evaluation/ground_truth.json` içindeki soruları sistemin GERÇEK retrieval
hattından (`retrieval_service.search_chunks`) geçirir. İki tür soru desteklenir:

- **Pozitif soru:** `expected_source_doc` doludur. Beklenen kaynak dokümanın ilk
  k sonuç içinde gelip gelmediğini ölçer (Recall@k, MRR).
- **Negatif soru:** `expected_source_doc` `null`/yok ya da `"negative": true`.
  Cevabı dokümanlarda OLMAYAN sorudur; doğru davranış, eşik uygulandıktan sonra
  retrieval'ın BOŞ dönmesi (→ deterministik NO_ANSWER, hallucination yok).

Hesaplanan metrikler:

- Recall@k       : (pozitif) beklenen kaynak ilk k sonuç içinde mi?  (hedef >= %70)
- MRR            : (pozitif) beklenen kaynağın ilk sırasının tersi (1/rank).
- Rejection rate : (negatif) eşik sonrası retrieval'ın doğru şekilde boş dönme oranı.

EŞİK KALİBRASYONU (Hafta 4 — `RETRIEVAL_MIN_SCORE`): Runner her soru için ham
(eşiksiz) top-k skorlarını bir kez toplar, sonra bir dizi aday eşik için
metrikleri bellek içinde yeniden hesaplar (sweep). Böylece "pozitif Recall'ı
düşürmeden negatif red oranını en yükseğe çıkaran eşik" veriyle seçilebilir;
`.env` içindeki `RETRIEVAL_MIN_SCORE` o değere ayarlanır.

ÖNKOŞUL: Değerlendirilecek dokümanlar `--user` ile verilen hesapla yüklenmiş ve
durumları `ready` olmalıdır (PostgreSQL'de chunk + ChromaDB'de vektör mevcut).
Aksi halde tüm skorlar 0 çıkar.

Kullanım (backend sanal ortamı aktifken, repo kökünden):
    python evaluation/run_eval.py --user user@example.com
    python evaluation/run_eval.py --user user@example.com --top-k 5 \
        --thresholds 0.0,0.1,0.2,0.3,0.4,0.5 \
        --ground-truth evaluation/ground_truth.json --output evaluation/results.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Yol kurulumu --------------------------------------------------------
# Bu betik repo kökündeki evaluation/ altında durur; `app` paketi backend/
# içindedir. Hem import yolunu hem de .env'in doğru yüklenmesi için çalışma
# dizinini backend/ olarak ayarlıyoruz (config .env'i cwd'den okur).
EVAL_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVAL_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"

# Hedef >=%70 Recall@5, >=0.50 MRR (README "Performans Metrikleri").
RECALL_TARGET = 0.70
MRR_TARGET = 0.50

# Eşik taraması için varsayılan aday değerler (kosinüs benzerlik skoru, 1.0 = en
# benzer). --thresholds ile değiştirilebilir.
DEFAULT_THRESHOLDS = [0.0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]

# Ham (eşiksiz) skorları toplamak için kullanılan sentinel: kosinüs skoru >= -1
# olduğundan bu değer hiçbir eşleşmeyi elemez.
_DISABLE_THRESHOLD = -2.0


def _force_utf8_stdout() -> None:
    """Konsol çıktısını UTF-8'e sabitler (Python 3.7+).

    Windows varsayılan konsolu (ör. cp1254) özetteki ✓/✗/— gibi sembolleri
    kodlayamaz ve `UnicodeEncodeError` ile çöker. Bu, çıktıyı güvenli kılar;
    yeniden yapılandırma desteklenmiyorsa sessizce geçilir.
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
        except (AttributeError, ValueError):
            pass


def _resolve(path_str: str) -> Path:
    """Kullanıcının verdiği yolu (göreliyse repo köküne göre) mutlaklaştırır."""
    p = Path(path_str)
    return p if p.is_absolute() else (REPO_ROOT / p).resolve()


def _load_ground_truth(path: Path) -> list[dict]:
    if not path.exists():
        sys.exit(
            f"Ground truth dosyası bulunamadı: {path}\n"
            f"Örnek için: {EVAL_DIR / 'ground_truth.example.json'}"
        )
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"Ground truth JSON okunamadı ({path}): {exc}")
    if not isinstance(data, list) or not data:
        sys.exit(
            f"Ground truth boş veya liste değil: {path}\n"
            f"En az 10-15 soru ekleyin (şablon: "
            f"{EVAL_DIR / 'ground_truth.example.json'})."
        )
    return data


def _parse_thresholds(raw: str | None) -> list[float]:
    """`--thresholds` argümanını (virgülle ayrılmış) sıralı float listesine çevirir."""
    if not raw:
        return list(DEFAULT_THRESHOLDS)
    try:
        values = sorted({float(part) for part in raw.split(",") if part.strip()})
    except ValueError as exc:
        sys.exit(f"--thresholds çözümlenemedi: {exc}")
    if not values:
        sys.exit("--thresholds boş.")
    return values


def _is_negative(item: dict) -> bool:
    """Maddeyi negatif (cevabı dokümanlarda olmayan) soru olarak sınıflar.

    Negatif kabul edilir: `negative: true` ya da `expected_source_doc` boş/yok.
    """
    if item.get("negative") is True:
        return True
    return item.get("expected_source_doc") in (None, "")


def _retrieve_all(items: list[dict], user_email: str, top_k: int) -> list[dict]:
    """Her soru için ham (eşiksiz) top-k retrieval yapar; skorlarıyla döner.

    Eşik taraması ham skorlara ihtiyaç duyduğundan canlı `RETRIEVAL_MIN_SCORE`
    geçici olarak devre dışı bırakılır (sonra eski değerine döndürülür). Dönen her
    kayıt, soruyu ve skora göre azalan sıralı `retrieved` listesini içerir.
    """
    from app.config import settings
    from app.database import SessionLocal
    from app.models.user import User
    from app.services import retrieval_service
    from sqlalchemy import select

    original = settings.RETRIEVAL_MIN_SCORE
    settings.RETRIEVAL_MIN_SCORE = _DISABLE_THRESHOLD
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == user_email))
        if user is None:
            sys.exit(f"Kullanıcı bulunamadı: {user_email}")

        records: list[dict] = []
        for item in items:
            question = item.get("question", "")
            results = retrieval_service.search_chunks(
                db=db,
                user_id=user.id,
                question=question,
                document_ids=None,
                top_k=top_k,
            )
            records.append(
                {
                    "id": item.get("id"),
                    "question": question,
                    "negative": _is_negative(item),
                    "expected_source_doc": item.get("expected_source_doc"),
                    "expected_page": item.get("expected_page"),
                    "retrieved": [
                        {"document": r.document, "page": r.page, "score": r.score}
                        for r in results
                    ],
                }
            )
        return records
    finally:
        db.close()
        settings.RETRIEVAL_MIN_SCORE = original


def _metrics_at_threshold(records: list[dict], threshold: float) -> dict:
    """Ham kayıtlardan, verilen eşik için pozitif/negatif metrikleri hesaplar.

    Üretim davranışını birebir taklit eder: top-k aday kümesi sabittir, eşik
    yalnızca o kümeden skoru düşük olanları eler. Tüm adaylar elenirse retrieval
    boş kalır (negatif soruda doğru = NO_ANSWER).
    """
    pos_total = pos_hits = 0
    reciprocal_sum = 0.0
    neg_total = neg_rejected = 0

    for rec in records:
        kept = [r for r in rec["retrieved"] if r["score"] >= threshold]
        if rec["negative"]:
            neg_total += 1
            if not kept:  # eşik sonrası boş bağlam → deterministik NO_ANSWER
                neg_rejected += 1
            continue

        pos_total += 1
        rank: int | None = None
        for index, r in enumerate(kept, start=1):
            if r["document"] == rec["expected_source_doc"]:
                rank = index
                break
        if rank is not None:
            pos_hits += 1
            reciprocal_sum += 1.0 / rank

    return {
        "threshold": round(threshold, 4),
        "pos_total": pos_total,
        "recall_at_k": round(pos_hits / pos_total, 4) if pos_total else None,
        "mrr": round(reciprocal_sum / pos_total, 4) if pos_total else None,
        "neg_total": neg_total,
        "rejection_rate": round(neg_rejected / neg_total, 4) if neg_total else None,
    }


def _recommend_threshold(
    sweep: list[dict], recall_target: float
) -> float | None:
    """Pozitif Recall hedefini koruyan, negatif red oranını en yükseğe çıkaran eşik.

    Negatif soru yoksa öneri yapılamaz (kalibrasyon negatif örnek gerektirir).
    Recall hedefini sağlayan aday yoksa en yüksek Recall'lı eşiği önerir.
    """
    if not any(row["rejection_rate"] is not None for row in sweep):
        return None

    def recall_ok(row: dict) -> bool:
        return row["recall_at_k"] is None or row["recall_at_k"] >= recall_target

    feasible = [row for row in sweep if recall_ok(row)]
    pool = feasible or sweep
    # Önce red oranı (yüksek iyi), eşitlikte daha yüksek eşik (daha seçici).
    best = max(
        pool,
        key=lambda row: (row["rejection_rate"] or 0.0, row["threshold"]),
    )
    return best["threshold"]


def _question_details(records: list[dict], threshold: float) -> list[dict]:
    """results.json için, verilen eşikteki soru bazlı kırılım."""
    details: list[dict] = []
    for rec in records:
        kept = [r for r in rec["retrieved"] if r["score"] >= threshold]
        if rec["negative"]:
            details.append(
                {
                    "id": rec["id"],
                    "question": rec["question"],
                    "negative": True,
                    "rejected": not kept,  # doğru davranış: boş (NO_ANSWER)
                    "retrieved": kept,
                }
            )
            continue
        rank: int | None = None
        for index, r in enumerate(kept, start=1):
            if r["document"] == rec["expected_source_doc"]:
                rank = index
                break
        details.append(
            {
                "id": rec["id"],
                "question": rec["question"],
                "negative": False,
                "expected_source_doc": rec["expected_source_doc"],
                "expected_page": rec["expected_page"],
                "hit": rank is not None,
                "rank": rank,
                "reciprocal_rank": round(1.0 / rank, 4) if rank else 0.0,
                "retrieved": kept,
            }
        )
    return details


def _build_run(
    records: list[dict],
    user_email: str,
    top_k: int,
    thresholds: list[float],
    configured_min_score: float,
) -> dict:
    """Sweep + mevcut eşik metriklerini içeren tam koşu nesnesini kurar."""
    sweep = [_metrics_at_threshold(records, t) for t in thresholds]
    current = _metrics_at_threshold(records, configured_min_score)
    recommended = _recommend_threshold(sweep, RECALL_TARGET)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user_email,
        "top_k": top_k,
        "num_questions": len(records),
        "num_positive": current["pos_total"],
        "num_negative": current["neg_total"],
        "configured_min_score": configured_min_score,
        "recall_at_k": current["recall_at_k"],
        "mrr": current["mrr"],
        "rejection_rate": current["rejection_rate"],
        "targets": {"recall_at_k": RECALL_TARGET, "mrr": MRR_TARGET},
        "recommended_min_score": recommended,
        "sweep": sweep,
        "details": _question_details(records, configured_min_score),
    }


def _append_run(output_path: Path, run: dict) -> None:
    """results.json'daki `runs` listesine yeni koşuyu ekler."""
    existing: dict = {"runs": []}
    if output_path.exists() and output_path.stat().st_size > 0:
        try:
            loaded = json.loads(output_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("runs"), list):
                existing = loaded
        except json.JSONDecodeError:
            pass  # bozuk dosya: sıfırdan yaz
    existing["runs"].append(run)
    output_path.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _fmt_pct(value: float | None) -> str:
    return "  —  " if value is None else f"{value:6.1%}"


def _print_summary(run: dict) -> None:
    print("\n=== Retrieval Değerlendirme Özeti ===")
    print(f"Kullanıcı     : {run['user']}")
    print(
        f"Soru sayısı   : {run['num_questions']} "
        f"(pozitif {run['num_positive']}, negatif {run['num_negative']})"
    )
    print(f"top_k         : {run['top_k']}")
    print(f"Mevcut eşik   : {run['configured_min_score']}")
    print("-" * 64)
    for d in run["details"]:
        if d["negative"]:
            durum = "RED ✓" if d["rejected"] else "SIZDI ✗"
            etiket = "[neg]"
        else:
            durum = f"sıra {d['rank']}" if d["hit"] else "BULUNAMADI"
            etiket = "[poz]"
        ident = d["id"] if d["id"] is not None else "?"
        print(f"  #{str(ident):<3} {etiket} {durum:<12} {d['question'][:40]}")
    print("-" * 64)

    # Eşik taraması tablosu — kalibrasyonun özü.
    print("Eşik taraması (RETRIEVAL_MIN_SCORE kalibrasyonu):")
    print(f"  {'eşik':>6}  {'Recall@k':>9}  {'MRR':>7}  {'Negatif red':>12}")
    for row in run["sweep"]:
        print(
            f"  {row['threshold']:>6.2f}  {_fmt_pct(row['recall_at_k']):>9}  "
            f"{('  —  ' if row['mrr'] is None else f'{row['mrr']:7.4f}'):>7}  "
            f"{_fmt_pct(row['rejection_rate']):>12}"
        )
    print("-" * 64)

    recall = run["recall_at_k"]
    mrr = run["mrr"]
    if recall is not None:
        recall_ok = "✓" if recall >= RECALL_TARGET else "✗"
        print(
            f"Recall@{run['top_k']} : {recall:.2%}  "
            f"(hedef >= {RECALL_TARGET:.0%}) {recall_ok}"
        )
    if mrr is not None:
        mrr_ok = "✓" if mrr >= MRR_TARGET else "✗"
        print(f"MRR        : {mrr:.4f}  (hedef >= {MRR_TARGET:.2f}) {mrr_ok}")
    if run["rejection_rate"] is not None:
        print(f"Negatif red: {run['rejection_rate']:.2%}  (mevcut eşikte)")
    if run["recommended_min_score"] is not None:
        print(
            f"\n>> Önerilen RETRIEVAL_MIN_SCORE = {run['recommended_min_score']} "
            f"(Recall hedefini koruyup negatif reddi en yükseğe çıkarır)"
        )
    elif run["num_negative"] == 0:
        print(
            "\n>> Eşik önerisi için ground_truth.json'a negatif soru ekleyin "
            "(expected_source_doc: null)."
        )
    print("=" * 64)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Retrieval değerlendirme + eşik kalibrasyon runner'ı"
    )
    parser.add_argument(
        "--user", required=True, help="Dokümanların sahibi kullanıcının e-postası"
    )
    parser.add_argument(
        "--ground-truth",
        default="evaluation/ground_truth.json",
        help="Ground truth JSON yolu (varsayılan: evaluation/ground_truth.json)",
    )
    parser.add_argument(
        "--output",
        default="evaluation/results.json",
        help="Sonuç JSON yolu (varsayılan: evaluation/results.json)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=None,
        help="Sonuç sayısı (varsayılan: .env içindeki TOP_K)",
    )
    parser.add_argument(
        "--thresholds",
        default=None,
        help=(
            "Eşik taraması için virgülle ayrılmış aday değerler "
            f"(varsayılan: {','.join(str(t) for t in DEFAULT_THRESHOLDS)})"
        ),
    )
    args = parser.parse_args()

    _force_utf8_stdout()  # özetteki ✓/✗ sembolleri Windows konsolunda çökmesin

    gt_path = _resolve(args.ground_truth)
    out_path = _resolve(args.output)
    items = _load_ground_truth(gt_path)
    thresholds = _parse_thresholds(args.thresholds)

    # app importlarından ÖNCE backend/'e geç (config .env'i cwd'den okur).
    sys.path.insert(0, str(BACKEND_DIR))
    os.chdir(BACKEND_DIR)

    from app.config import settings

    top_k = args.top_k if args.top_k is not None else settings.TOP_K
    configured_min_score = settings.RETRIEVAL_MIN_SCORE

    records = _retrieve_all(items, args.user, top_k)
    run = _build_run(records, args.user, top_k, thresholds, configured_min_score)
    _append_run(out_path, run)
    _print_summary(run)
    print(f"\nSonuç yazıldı: {out_path}")

    # Kabul kriteri (pozitif Recall) sağlanmadıysa non-zero çık (CI/otomasyon).
    if run["recall_at_k"] is None:
        return 0  # yalnızca negatif soru: pozitif kabul kriteri uygulanmaz
    return 0 if run["recall_at_k"] >= RECALL_TARGET else 1


if __name__ == "__main__":
    raise SystemExit(main())
