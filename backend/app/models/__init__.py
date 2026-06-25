"""ORM modelleri.

Modellerin buradan içe aktarılması, SQLAlchemy `Base.metadata` üzerinde
tablo tanımlarının kayıtlı olmasını ve ilişkilerin (relationship) string
referanslarının çözümlenebilmesini sağlar.
"""

from app.models.document import Document
from app.models.user import User

__all__ = ["User", "Document"]
