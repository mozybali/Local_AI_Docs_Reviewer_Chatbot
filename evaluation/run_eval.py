"""Retrieval değerlendirme runner'ı (Hafta 3 kabul kriteri).

`evaluation/ground_truth.json` içindeki soruları sistemin GERÇEK retrieval
hattından (`retrieval_service.search_chunks`) geçirir ve pozitif retrieval
metriklerini hesaplar:

- Recall@k : Beklenen kaynak doküman ilk k sonuç içinde mi?  (hedef >= %70)
- MRR      : Beklenen kaynağın ilk geldiği sıranın tersi (1/rank); hiç gelmezse 0.

Bu sayede README'deki "10 manuel test sorusundan en az 7'sinde doğru kaynak ilk
5 sonuç içinde olmalı" (Recall@5 >= %70) kabul kriteri ÖLÇÜLEBİLİR ve sonuç
`results.json`'a yazılır.

KAPSAM NOTU: Negatif soru / hallucination ölçümü ve cevap doğruluğu (Source
Accuracy) bu runner'ın kapsamında DEĞİLDİR; bunlar LLM cevap üretimini gerektirir
ve Hafta 4/7'ye aittir. Buradaki odak yalnızca pozitif retrieval'dır.

ÖNKOŞUL: Değerlendirilecek dokümanlar `--user` ile verilen hesapla yüklenmiş ve
durumları `ready` olmalıdır (PostgreSQL'de chunk + ChromaDB'de vektör mevcut).
Aksi halde tüm skorlar 0 çıkar.

Kullanım (backend sanal ortamı aktifken):
    python evaluation/run_eval.py --user user@example.com
    python evaluation/run_eval.py --user user@example.com --top-k 5 \
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


def _evaluate(items: list[dict], user_email: str, top_k: int) -> dict:
    """Her soru için retrieval yapar ve metrikleri toplar."""
    # app importları cwd backend/ yapıldıktan sonra güvenli.
    from app.database import SessionLocal
    from app.models.user import User
    from app.services import retrieval_service
    from sqlalchemy import select

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == user_email))
        if user is None:
            sys.exit(f"Kullanıcı bulunamadı: {user_email}")

        details: list[dict] = []
        hits = 0
        reciprocal_sum = 0.0

        for item in items:
            question = item.get("question", "")
            expected_doc = item.get("expected_source_doc")
            expected_page = item.get("expected_page")

            results = retrieval_service.search_chunks(
                db=db,
                user_id=user.id,
                question=question,
                document_ids=None,
                top_k=top_k,
            )

            rank: int | None = None
            page_hit = False
            for index, r in enumerate(results, start=1):
                if expected_doc is not None and r.document == expected_doc:
                    rank = index
                    page_hit = (
                        expected_page is not None and r.page == expected_page
                    )
                    break

            hit = rank is not None
            reciprocal = (1.0 / rank) if rank else 0.0
            if hit:
                hits += 1
            reciprocal_sum += reciprocal

            details.append(
                {
                    "id": item.get("id"),
                    "question": question,
                    "expected_source_doc": expected_doc,
                    "expected_page": expected_page,
                    "hit": hit,
                    "rank": rank,
                    "reciprocal_rank": round(reciprocal, 4),
                    "page_hit": page_hit,
                    "retrieved": [
                        {
                            "document": r.document,
                            "page": r.page,
                            "score": r.score,
                        }
                        for r in results
                    ],
                }
            )

        total = len(items)
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": user_email,
            "top_k": top_k,
            "num_questions": total,
            "recall_at_k": round(hits / total, 4) if total else 0.0,
            "mrr": round(reciprocal_sum / total, 4) if total else 0.0,
            "targets": {"recall_at_k": RECALL_TARGET, "mrr": MRR_TARGET},
            "details": details,
        }
    finally:
        db.close()


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


def _print_summary(run: dict) -> None:
    print("\n=== Retrieval Değerlendirme Özeti ===")
    print(f"Kullanıcı     : {run['user']}")
    print(f"Soru sayısı   : {run['num_questions']}")
    print(f"top_k         : {run['top_k']}")
    print("-" * 60)
    for d in run["details"]:
        durum = f"sıra {d['rank']}" if d["hit"] else "BULUNAMADI"
        print(f"  #{d['id']:<3} {durum:<12} {d['question'][:45]}")
    print("-" * 60)
    recall = run["recall_at_k"]
    mrr = run["mrr"]
    recall_ok = "✓" if recall >= RECALL_TARGET else "✗"
    mrr_ok = "✓" if mrr >= MRR_TARGET else "✗"
    print(f"Recall@{run['top_k']} : {recall:.2%}  (hedef >= {RECALL_TARGET:.0%}) {recall_ok}")
    print(f"MRR        : {mrr:.4f}  (hedef >= {MRR_TARGET:.2f}) {mrr_ok}")
    print("=" * 60)


def main() -> int:
    parser = argparse.ArgumentParser(description="Retrieval değerlendirme runner'ı")
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
    args = parser.parse_args()

    gt_path = _resolve(args.ground_truth)
    out_path = _resolve(args.output)
    items = _load_ground_truth(gt_path)

    # app importlarından ÖNCE backend/'e geç (config .env'i cwd'den okur).
    sys.path.insert(0, str(BACKEND_DIR))
    os.chdir(BACKEND_DIR)

    from app.config import settings

    top_k = args.top_k if args.top_k is not None else settings.TOP_K

    run = _evaluate(items, args.user, top_k)
    _append_run(out_path, run)
    _print_summary(run)
    print(f"\nSonuç yazıldı: {out_path}")

    # Kabul kriteri sağlanmadıysa non-zero çık (CI/otomasyon için).
    return 0 if run["recall_at_k"] >= RECALL_TARGET else 1


if __name__ == "__main__":
    raise SystemExit(main())
