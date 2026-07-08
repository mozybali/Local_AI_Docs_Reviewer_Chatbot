"""Kimlik doğrulama iş mantığı.

Şifre hash'leme ve JWT üretimi `utils/security.py` içinde tanımlıdır; bu servis
kullanıcı oluşturma ve kimlik doğrulama (authenticate) işlemlerini yönetir.
HTTP hataları router katmanında üretilir.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.security import hash_password, verify_password

# Kullanıcı bulunamadığında da bcrypt maliyeti ödenir (timing eşitleme):
# aksi halde "e-posta yok" yanıtı, "şifre yanlış" yanıtından belirgin şekilde
# hızlı döner ve yanıt süresi e-posta varlığını sızdırır (user enumeration).
# Sabit, geçerli formatlı bir bcrypt hash'idir; hiçbir gerçek parolaya karşılık
# gelmesi beklenmez ve sonucu her zaman yok sayılır.
_TIMING_EQUALIZATION_HASH = (
    "$2b$12$tq.2jFlnfLKXP5/uQ5PE4uod6eYPbqzV5Ipk221rxQqyeLyYASQHG"
)


def get_user_by_email(db: Session, email: str) -> User | None:
    """E-posta adresine göre kullanıcıyı döner (yoksa None)."""
    normalized = email.strip().lower()
    return db.scalar(select(User).where(User.email == normalized))


def create_user(
    db: Session,
    email: str,
    password: str,
    role: str = "user",
    is_active: bool = True,
) -> User:
    """Yeni kullanıcı oluşturur. Şifre bcrypt ile hash'lenerek saklanır."""
    user = User(
        email=email.strip().lower(),
        hashed_password=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    try:
        db.commit()
    except Exception:
        # Örn. eş zamanlı kayıtta unique e-posta ihlali (IntegrityError):
        # oturum kullanılabilir kalsın diye rollback yapıp çağırana bırakılır
        # (router 409'a çevirir).
        db.rollback()
        raise
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """E-posta ve şifreyi doğrular.

    Kullanıcı yoksa veya şifre hatalıysa None döner. Saldırganın e-posta
    varlığını ayırt etmesini zorlaştırmak için her iki durumda da None dönülür.
    """
    user = get_user_by_email(db, email)
    if user is None:
        # Timing eşitleme: kullanıcı yokken de aynı bcrypt maliyeti ödenir.
        verify_password(password, _TIMING_EQUALIZATION_HASH)
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
