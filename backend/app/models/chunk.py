"""Chunk ORM modeli.

Async işleme sırasında her doküman, ~512 token boyutunda ve 50 token overlap'li
parçalara (chunk) bölünür. Her chunk; kaynak gösterimi için sayfa numarasını ve
doküman içindeki sırasını (`chunk_index`) saklar. `vector_id` alanı (Hafta 3)
ChromaDB vektörüyle ilişkilendirilir (ör. `doc{document_id}_chunk{chunk_index}`).

Foreign key `ON DELETE CASCADE` ile tanımlıdır; ayrıca `Document.chunks`
ilişkisindeki `cascade="all, delete-orphan"` sayesinde doküman ORM üzerinden
silindiğinde ilişkili chunk'lar da silinir.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.document import Document


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    vector_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    document: Mapped["Document"] = relationship(back_populates="chunks")

    def __repr__(self) -> str:  # pragma: no cover - hata ayıklama yardımcısı
        return (
            f"<Chunk id={self.id} document_id={self.document_id} "
            f"index={self.chunk_index} page={self.page_number}>"
        )
