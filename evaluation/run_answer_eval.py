"""Cevap kalitesi değerlendirme runner'ı — Source Accuracy + No Hallucination (Hafta 7).

`run_eval.py` yalnızca **retrieval** katmanını ölçer (Recall@k, MRR, eşik
kalibrasyonu). Bu betik ise **uçtan uca RAG hattını** çalıştırır: her ground
truth sorusu için gerçek retrieval + lokal LLM cevabı üretir
(`retrieval_service.search_chunks` + `llm_service.generate_answer`) ve README
"Cevap Kalitesi Metrikleri" tablosundaki iki metriği hesaplar:

- **Source Accuracy** (hedef >= %80): Pozitif sorularda model gerçek bir cevap
  üretmiş VE gösterdiği kaynaklar arasında beklenen doküman (`expected_source_doc`)
  yer alıyor mu? Yani cevap, doğru kaynağa dayandırılmış mı?
- **No Hallucination Rate** (hedef >= %80): Negatif (cevabı dokümanlarda olmayan)
  sorularda model bilgi uydurmayıp standart `NO_ANSWER` cevabını mı döndürüyor?

Ek olarak her soru için üretilen cevap metni `answer_results.json`'a yazılır;
böylece **Answer Completeness** (cevabın beklenen bilgiyi içermesi) manuel olarak
değerlendirilebilir. Kolaylık olsun diye `expected_answer` ile cevap arasında
basit bir anahtar-kelime örtüşmesi de raporlanır (yalnızca ipucu; manuel kontrol
yerine geçmez).

ÖNKOŞULLAR:
- Değerlendirilecek dokümanlar `--user` ile verilen hesapla yüklenmiş ve
  durumları `ready` olmalı (PostgreSQL chunk + ChromaDB vektör).
- **LM Studio local server ÇALIŞIYOR olmalı** (`.env` içindeki `LLM_API_URL`).
  Aksi halde betik anlaşılır bir hata ile durur (retrieval-only ölçüm için
  `run_eval.py` kullanın).

Kullanım (backend sanal ortamı aktifken, repo kökünden):
    python evaluation/run_answer_eval.py --user user@example.com
    python evaluation/run_answer_eval.py --user user@example.com \
        --ground-truth evaluation/ground_truth.json \
        --output evaluation/answer_results.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
REPO_ROOT = EVAL_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"

# README "Cevap Kalitesi Metrikleri" hedefleri.
SOURCE_ACCURACY_TARGET = 0.80
NO_HALLUCINATION_TARGET = 0.80

# Anahtar kelime örtüşmesi için anlamsız (stop) kelimeler — completeness ipucu
# gürültüsünü azaltır. Tam liste değil; yalnızca sık geçen bağlaçlar/edatlar.
_STOPWORDS = {
    "ve", "veya", "ile", "için", "bir", "bu", "da", "de", "en", "az", "olan",
    "olarak", "gibi", "göre", "kadar", "the", "of",
}
_WORD_RE = re.compile(r"[0-9a-zçğıöşü]+", re.IGNORECASE)


def _force_utf8_stdout() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
        except (AttributeError, ValueError):
            pass


def _resolve(path_str: str) -> Path:
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
        sys.exit(f"Ground truth boş veya liste değil: {path}")
    return data


def _is_negative(item: dict) -> bool:
    if item.get("negative") is True:
        return True
    return item.get("expected_source_doc") in (None, "")


def _keywords(text: str) -> set[str]:
    return {
        w.lower()
        for w in _WORD_RE.findall(text or "")
        if len(w) > 2 and w.lower() not in _STOPWORDS
    }


def _keyword_overlap(expected: str, answer: str) -> float | None:
    """`expected_answer` kelimelerinin cevapta görülme oranı (0..1) — completeness ipucu."""
    exp = _keywords(expected)
    if not exp:
        return None
    found = exp & _keywords(answer)
    return round(len(found) / len(exp), 3)


def _evaluate(items: list[dict], user_email: str, top_k: int) -> list[dict]:
    """Her soru için uçtan uca RAG cevabı üretir ve metrik kayıtları döndürür."""
    from app.database import SessionLocal
    from app.models.user import User
    from app.services import llm_service, retrieval_service
    from app.services.llm_service import NO_ANSWER, LLMServiceError
    from sqlalchemy import select

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == user_email))
        if user is None:
            sys.exit(f"Kullanıcı bulunamadı: {user_email}")

        records: list[dict] = []
        for item in items:
            question = item.get("question", "")
            chunks = retrieval_service.search_chunks(
                db=db,
                user_id=user.id,
                question=question,
                document_ids=None,
                top_k=top_k,
            )
            try:
                answer = llm_service.generate_answer(question, chunks)
            except LLMServiceError as exc:
                sys.exit(
                    "LLM cevabı üretilemedi: "
                    f"{exc}\n>> LM Studio local server'ının çalıştığından ve "
                    ".env içindeki LLM_API_URL/LLM_MODEL_NAME değerlerinin doğru "
                    "olduğundan emin olun. (Yalnızca retrieval ölçümü için "
                    "evaluation/run_eval.py kullanın.)"
                )

            sources = [
                {"document": c.document, "page": c.page, "score": round(c.score, 4)}
                for c in chunks
            ]
            source_docs = {c.document for c in chunks}
            is_no_answer = answer.strip() == NO_ANSWER
            negative = _is_negative(item)

            rec: dict = {
                "id": item.get("id"),
                "question": question,
                "negative": negative,
                "answer": answer,
                "no_answer": is_no_answer,
                "sources": sources,
            }
            if negative:
                # Doğru davranış: bilgi uydurmamak -> NO_ANSWER (kaynak yok).
                rec["no_hallucination"] = is_no_answer
            else:
                expected = item.get("expected_source_doc")
                rec["expected_source_doc"] = expected
                rec["expected_answer"] = item.get("expected_answer")
                # Source Accuracy: gerçek cevap + doğru kaynak gösterimi.
                rec["source_correct"] = (not is_no_answer) and (expected in source_docs)
                rec["answered"] = not is_no_answer
                rec["answer_keyword_overlap"] = _keyword_overlap(
                    item.get("expected_answer", ""), answer
                )
            records.append(rec)
        return records
    finally:
        db.close()


def _summarize(records: list[dict], user_email: str, top_k: int) -> dict:
    positives = [r for r in records if not r["negative"]]
    negatives = [r for r in records if r["negative"]]

    pos_total = len(positives)
    source_hits = sum(1 for r in positives if r["source_correct"])
    answered = sum(1 for r in positives if r["answered"])

    neg_total = len(negatives)
    no_hallu = sum(1 for r in negatives if r["no_hallucination"])

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user_email,
        "top_k": top_k,
        "num_questions": len(records),
        "num_positive": pos_total,
        "num_negative": neg_total,
        "source_accuracy": round(source_hits / pos_total, 4) if pos_total else None,
        "answer_rate": round(answered / pos_total, 4) if pos_total else None,
        "no_hallucination_rate": round(no_hallu / neg_total, 4) if neg_total else None,
        "targets": {
            "source_accuracy": SOURCE_ACCURACY_TARGET,
            "no_hallucination_rate": NO_HALLUCINATION_TARGET,
        },
        "details": records,
    }


def _append_run(output_path: Path, run: dict) -> None:
    existing: dict = {"runs": []}
    if output_path.exists() and output_path.stat().st_size > 0:
        try:
            loaded = json.loads(output_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict) and isinstance(loaded.get("runs"), list):
                existing = loaded
        except json.JSONDecodeError:
            pass
    existing["runs"].append(run)
    output_path.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _fmt_pct(value: float | None) -> str:
    return "  —  " if value is None else f"{value:6.1%}"


def _print_summary(run: dict) -> None:
    print("\n=== Cevap Kalitesi Değerlendirme Özeti ===")
    print(f"Kullanıcı     : {run['user']}")
    print(
        f"Soru sayısı   : {run['num_questions']} "
        f"(pozitif {run['num_positive']}, negatif {run['num_negative']})"
    )
    print(f"top_k         : {run['top_k']}")
    print("-" * 70)
    for d in run["details"]:
        ident = d["id"] if d["id"] is not None else "?"
        if d["negative"]:
            durum = "RED ✓" if d["no_hallucination"] else "UYDURDU ✗"
            etiket = "[neg]"
        else:
            durum = "KAYNAK ✓" if d["source_correct"] else "KAYNAK ✗"
            etiket = "[poz]"
        print(f"  #{str(ident):<3} {etiket} {durum:<11} {d['question'][:42]}")
    print("-" * 70)

    sa = run["source_accuracy"]
    nh = run["no_hallucination_rate"]
    if sa is not None:
        ok = "✓" if sa >= SOURCE_ACCURACY_TARGET else "✗"
        print(
            f"Source Accuracy      : {sa:.1%}  "
            f"(hedef >= {SOURCE_ACCURACY_TARGET:.0%}) {ok}"
        )
    if run["answer_rate"] is not None:
        print(f"Cevap verme oranı    : {run['answer_rate']:.1%}  (pozitif sorular)")
    if nh is not None:
        ok = "✓" if nh >= NO_HALLUCINATION_TARGET else "✗"
        print(
            f"No Hallucination Rate: {nh:.1%}  "
            f"(hedef >= {NO_HALLUCINATION_TARGET:.0%}) {ok}"
        )
    print("=" * 70)
    print(
        "Not: Answer Completeness manuel değerlendirilir; her cevap metni ve "
        "anahtar-kelime örtüşmesi answer_results.json içindedir."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Cevap kalitesi (Source Accuracy + No Hallucination) runner'ı"
    )
    parser.add_argument("--user", required=True, help="Dokümanların sahibi kullanıcı e-postası")
    parser.add_argument("--ground-truth", default="evaluation/ground_truth.json")
    parser.add_argument("--output", default="evaluation/answer_results.json")
    parser.add_argument("--top-k", type=int, default=None, help="Varsayılan: .env TOP_K")
    args = parser.parse_args()

    _force_utf8_stdout()

    gt_path = _resolve(args.ground_truth)
    out_path = _resolve(args.output)
    items = _load_ground_truth(gt_path)

    sys.path.insert(0, str(BACKEND_DIR))
    os.chdir(BACKEND_DIR)

    from app.config import settings

    top_k = args.top_k if args.top_k is not None else settings.TOP_K

    records = _evaluate(items, args.user, top_k)
    run = _summarize(records, args.user, top_k)
    _append_run(out_path, run)
    _print_summary(run)
    print(f"\nSonuç yazıldı: {out_path}")

    # Kabul kriteri: her iki cevap-kalitesi hedefi de sağlanmalı.
    sa_ok = run["source_accuracy"] is None or run["source_accuracy"] >= SOURCE_ACCURACY_TARGET
    nh_ok = (
        run["no_hallucination_rate"] is None
        or run["no_hallucination_rate"] >= NO_HALLUCINATION_TARGET
    )
    return 0 if (sa_ok and nh_ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
