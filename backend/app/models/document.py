"""Doküman ORM modeli.

Her doküman bir kullanıcıya (`user_id`) aittir; bu sayede çok kullanıcılı
izolasyon PostgreSQL tarafında foreign key ile garanti altına alınır.
`status` alanı doküman işleme yaşam döngüsünü temsil eder:
`uploaded`, `processing`, `ready`, `error`.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.chunk import Chunk
    from app.models.user import User


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String, nullable=False)
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(
        String, default="uploaded", server_default="uploaded"
    )
    error_msg: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    upload_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover - hata ayıklama yardımcısı
        return (
            f"<Document id={self.id} user_id={self.user_id} "
            f"filename={self.filename!r} status={self.status!r}>"
        )
