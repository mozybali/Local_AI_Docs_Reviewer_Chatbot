"""add page stats to documents and ocr metadata to chunks

Belge işleme pipeline'ının OCR/kalite-kontrol sürümü için:
- `documents`: sayfa bazlı işleme istatistikleri (`page_count`, `pages_ocr`,
  `pages_failed`) ve kısmi başarı uyarısı (`warning_msg`). Doküman `ready`
  olsa bile bazı sayfalar okunamadıysa kullanıcıya raporlanır.
- `chunks`: içerik kaynağı (`source_type`: native/ocr) ve OCR ortalama güveni
  (`ocr_confidence`). Retrieval kalite analizinde ve yeniden işleme
  kararlarında kullanılır.

Tüm kolonlar nullable olduğundan mevcut veriye dokunulmaz.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("warning_msg", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("documents", sa.Column("pages_ocr", sa.Integer(), nullable=True))
    op.add_column(
        "documents", sa.Column("pages_failed", sa.Integer(), nullable=True)
    )
    op.add_column("chunks", sa.Column("source_type", sa.String(), nullable=True))
    op.add_column(
        "chunks", sa.Column("ocr_confidence", sa.Float(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("chunks", "ocr_confidence")
    op.drop_column("chunks", "source_type")
    op.drop_column("documents", "pages_failed")
    op.drop_column("documents", "pages_ocr")
    op.drop_column("documents", "page_count")
    op.drop_column("documents", "warning_msg")
