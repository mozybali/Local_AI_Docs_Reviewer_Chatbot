"""PostgreSQL <-> ChromaDB tutarlılık (reconcile) ve yeniden indeksleme aracı.

İki ayrı veri deposuna (PostgreSQL + ChromaDB) transactional yazamadığımız için,
kısmi hatalarda (ör. yeniden işlemede Chroma yazımı yarıda kalması, ya da silmede
DB silindikten sonra Chroma temizliğinin patlaması) iki depo arasında drift
oluşabilir. Bu betik drift'i raporlar ve `process_document` ile onarır.

Drift tespiti, doküman bazında PostgreSQL chunk sayısı ile ChromaDB vektör
sayısının karşılaştırılmasıyla yapılır. Ek olarak, PG'de karşılığı olmayan
"yetim" ChromaDB vektörleri de raporlanır/temizlenir.

Kullanım (backend sanal ortamı aktifken, backend/ dizininden):
    python scripts/reindex.py --check                 # yalnızca raporla
    python scripts/reindex.py --fix                    # tutarsız/error dokümanları yeniden işle + yetimleri temizle
    python scripts/reindex.py --document-id 12         # tek dokümanı yeniden işle
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# backend/ dizinini import yoluna ekle (scripts/ -> backend/).
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import func, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.chunk import Chunk  # noqa: E402
from app.models.document import Document  # noqa: E402
from app.services import vector_store  # noqa: E402
from app.services.document_processor import process_document  # noqa: E402


def _pg_chunk_counts(db) -> dict[int, int]:
    """document_id -> PostgreSQL chunk sayısı."""
    rows = db.execute(
        select(Chunk.document_id, func.count(Chunk.id)).group_by(Chunk.document_id)
    ).all()
    return {doc_id: count for doc_id, count in rows}


def _diagnose(db) -> list[dict]:
    """Her doküman için PG ve Chroma sayımlarını karşılaştırır."""
    documents = db.scalars(select(Document)).all()
    pg_counts = _pg_chunk_counts(db)

    report: list[dict] = []
    for doc in documents:
        pg_count = pg_counts.get(doc.id, 0)
        chroma_count = vector_store.count_by_document(doc.id)
        consistent = (
            doc.status == "ready"
            and pg_count > 0
            and pg_count == chroma_count
        )
        report.append(
            {
                "document_id": doc.id,
                "user_id": doc.user_id,
                "filename": doc.original_filename,
                "status": doc.status,
                "pg_chunks": pg_count,
                "chroma_vectors": chroma_count,
                "consistent": consistent,
            }
        )
    return report


def _orphan_document_ids(db) -> list[int]:
    """ChromaDB'de olup PostgreSQL'de karşılığı olmayan document_id'ler."""
    collection = vector_store.get_collection()
    try:
        result = collection.get(include=["metadatas"])
    except Exception as exc:  # pragma: no cover - Chroma erişilemezse
        raise vector_store.VectorStoreError("ChromaDB okunamadı.") from exc

    chroma_doc_ids = {
        int(m.get("document_id"))
        for m in (result.get("metadatas") or [])
        if m and m.get("document_id") is not None
    }
    existing = set(db.scalars(select(Document.id)).all())
    return sorted(chroma_doc_ids - existing)


def _print_report(report: list[dict], orphans: list[int]) -> None:
    print(f"{'docId':>6}  {'durum':<10} {'PG':>5} {'Chroma':>7}  tutarlı  dosya")
    print("-" * 72)
    for r in report:
        mark = "✓" if r["consistent"] else "✗"
        print(
            f"{r['document_id']:>6}  {r['status']:<10} {r['pg_chunks']:>5} "
            f"{r['chroma_vectors']:>7}  {mark:^7}  {r['filename']}"
        )
    if orphans:
        print("-" * 72)
        print(f"Yetim ChromaDB document_id'leri (PG'de yok): {orphans}")


def main() -> int:
    parser = argparse.ArgumentParser(description="PG<->Chroma reconcile / reindex")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--check", action="store_true", help="Yalnızca drift raporu yazdır"
    )
    group.add_argument(
        "--fix",
        action="store_true",
        help="Tutarsız/error dokümanları yeniden işle ve yetim vektörleri temizle",
    )
    group.add_argument(
        "--document-id", type=int, help="Yalnızca bu dokümanı yeniden işle"
    )
    args = parser.parse_args()

    if args.document_id is not None:
        print(f"Doküman yeniden işleniyor: id={args.document_id}")
        process_document(args.document_id)
        print("Bitti.")
        return 0

    db = SessionLocal()
    try:
        report = _diagnose(db)
        orphans = _orphan_document_ids(db)
        _print_report(report, orphans)

        if args.check:
            inconsistent = [r for r in report if not r["consistent"]]
            print(
                f"\nTutarsız doküman: {len(inconsistent)} / {len(report)}, "
                f"yetim document_id: {len(orphans)}"
            )
            return 0 if not inconsistent and not orphans else 1

        # --fix
        to_reindex = [r["document_id"] for r in report if not r["consistent"]]
        print(f"\nYeniden işlenecek doküman sayısı: {len(to_reindex)}")
        for doc_id in to_reindex:
            print(f"  -> reindex document_id={doc_id}")
            process_document(doc_id)

        if orphans:
            print(f"Yetim vektörler temizleniyor: {orphans}")
            for doc_id in orphans:
                vector_store.delete_by_document(doc_id)

        print("Reconcile tamamlandı.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
