"""Uygulama ayarları.

Tüm konfigürasyon `.env` dosyasından (pydantic-settings ile) okunur.
Değerler `.env.example` dosyasındaki anahtarlarla birebir eşleşir.
"""

from functools import lru_cache
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

# Güvensiz (placeholder) secret değerleri: `.env.example` ile birebir aynı
# bırakılmış kurulumları yakalamak için kullanılır.
_INSECURE_JWT_SECRETS = {"", "degistir_bu_degeri_uretimde", "secret", "changeme"}
_INSECURE_ADMIN_PASSWORDS = {"", "degistir_beni", "admin", "changeme"}

# Yalnızca simetrik HMAC ailesine izin verilir. `none` veya asimetrik/karışık
# algoritmalara izin vermek, tek secret'lı bu kurulumda imza doğrulamasını
# zayıflatabilir (alg confusion).
_ALLOWED_JWT_ALGORITHMS = {"HS256", "HS384", "HS512"}

_LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


class Settings(BaseSettings):
    """`.env` dosyasından okunan uygulama ayarları."""

    # Ortam: "development" veya "production". Production'da güvensiz varsayılan
    # secret'larla başlatma reddedilir ve OpenAPI/docs kapatılır.
    ENVIRONMENT: str = "development"

    # Dosya yükleme
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 50
    # Hafta 2: PDF, TXT ve DOCX desteklenir (text_extractor python-docx kullanır).
    ALLOWED_EXTENSIONS: str = "pdf,txt,docx"

    # Veritabanı
    DATABASE_URL: str = (
        "postgresql+psycopg://localdoc:localdoc@localhost:5432/localdoc_ai"
    )

    # Kimlik doğrulama (JWT)
    JWT_SECRET_KEY: str = "degistir_bu_degeri_uretimde"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # İlk admin kullanıcı (uygulama ilk açıldığında oluşturulur)
    DEFAULT_ADMIN_EMAIL: str = "admin@localdoc.ai"
    DEFAULT_ADMIN_PASSWORD: str = "degistir_beni"

    # Lokal LLM (Hafta 4)
    LLM_PROVIDER: str = "lmstudio"
    LLM_API_URL: str = "http://localhost:1234/v1"
    LLM_MODEL_NAME: str = "local-model"
    # LLM üretim parametreleri (opsiyonel; .env'de yoksa varsayılanlar kullanılır).
    # Düşük sıcaklık, bağlama sadık ve daha az "uyduran" cevaplar üretir.
    LLM_TEMPERATURE: float = 0.2
    # ÇIKTI token limiti (max_tokens). Bağlam penceresi DEĞİLDİR; bağlam
    # penceresi için LLM_CONTEXT_WINDOW / model tanımındaki context_window
    # kullanılır (Hafta 6). Bu iki kavram karıştırılmamalıdır.
    LLM_MAX_TOKENS: int = 130000
    # Varsayılan (legacy) modelin bağlam penceresi (token). LLM_ALLOWED_MODELS
    # tanımlı değilken tek varsayılan model bu değerle üretilir. Varsayılan,
    # LLM_MAX_TOKENS'ın eski yüksek varsayılanını da barındıracak genişliktedir.
    LLM_CONTEXT_WINDOW: int = 131072
    # Lokal model yavaş olabileceğinden istek zaman aşımı geniş tutulur (saniye).
    LLM_TIMEOUT: int = 500
    # Model allowlist (Hafta 6): kullanıcıların seçebileceği modellerin JSON
    # listesi. Boş bırakılırsa yukarıdaki LLM_MODEL_NAME/LLM_TEMPERATURE/
    # LLM_MAX_TOKENS/LLM_CONTEXT_WINDOW değerlerinden tek varsayılan model
    # üretilir (geriye uyumluluk). Ayrıştırma ve doğrulama
    # `app.services.model_registry` içindedir; context_window ve
    # max_output_tokens YALNIZCA buradaki sunucu tarafı tanımdan gelir,
    # istemciden asla kabul edilmez.
    LLM_ALLOWED_MODELS: str = ""

    # Vektör veritabanı (Hafta 3)
    VECTOR_STORE: str = "chromadb"
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "localdoc_chunks"

    # Embedding (Hafta 3)
    EMBEDDING_MODEL: str = (
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    # Chunking (Hafta 2-3)
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50
    TOP_K: int = 5
    # Retrieval skor eşiği (Hafta 4): kosinüs benzerlik skoru (1.0 = en benzer)
    # bu değerin altında kalan eşleşmeler bağlama alınmaz. Böylece soru
    # dokümanlarla alakasızken (negatif soru) zayıf/alakasız chunk'lar LLM'e
    # gitmez ve cevap deterministik olarak NO_ANSWER'a döner (hallucination
    # önlemi). Varsayılan 0.0: yalnızca dik/zıt (skor < 0) alakasız eşleşmeleri
    # eler; gerçek değerlendirmeyle (evaluation/) daha yükseğe çekilebilir.
    RETRIEVAL_MIN_SCORE: float = 0.0

    # İstemciler (CORS)
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # Brute-force koruması (login/register): sabit pencere içinde izin verilen
    # deneme sayısı. Login limiti yalnızca BAŞARISIZ denemeleri sayar.
    LOGIN_RATE_LIMIT_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300
    REGISTER_RATE_LIMIT_ATTEMPTS: int = 20
    REGISTER_RATE_LIMIT_WINDOW_SECONDS: int = 3600

    # Chat rate limit (Hafta 6): kullanıcı + IP + mod (rag/general) başına
    # pencere içinde izin verilen istek sayısı. LLM çağrıları maliyetli olduğu
    # için login limitinden daha geniş ama yine de sınırlı tutulur.
    CHAT_RATE_LIMIT_ATTEMPTS: int = 30
    CHAT_RATE_LIMIT_WINDOW_SECONDS: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @property
    def allowed_extensions_set(self) -> set[str]:
        """`ALLOWED_EXTENSIONS` değerini normalize edilmiş bir kümeye çevirir."""
        return {
            ext.strip().lower().lstrip(".")
            for ext in self.ALLOWED_EXTENSIONS.split(",")
            if ext.strip()
        }

    @property
    def max_file_size_bytes(self) -> int:
        """Maksimum dosya boyutunu byte cinsinden döner."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        """Ortamın production olup olmadığını döner."""
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}


def validate_security_settings(s: "Settings") -> list[str]:
    """Güvenlik açısından kritik ayarları denetler.

    - `JWT_ALGORITHM` izin verilen HMAC algoritmalarından biri değilse her
      ortamda `RuntimeError` fırlatır (imzasız/alg-confusion token riskine
      karşı asla tolere edilmez).
    - `JWT_SECRET_KEY` veya `DEFAULT_ADMIN_PASSWORD` placeholder değerde
      bırakılmışsa: development'ta uyarı listesi döner (çağıran loglar),
      production'da `RuntimeError` fırlatır (uygulama başlatılmaz).
    - `LLM_API_URL` lokal olmayan bir hosta işaret ediyorsa uyarı üretir
      (doküman içeriği dış servise gider; bilinçli bir tercih olmalıdır).
    """
    if s.JWT_ALGORITHM not in _ALLOWED_JWT_ALGORITHMS:
        raise RuntimeError(
            "Geçersiz JWT_ALGORITHM: "
            f"{s.JWT_ALGORITHM!r}. İzin verilenler: "
            f"{', '.join(sorted(_ALLOWED_JWT_ALGORITHMS))}."
        )

    problems: list[str] = []
    if s.JWT_SECRET_KEY in _INSECURE_JWT_SECRETS or len(s.JWT_SECRET_KEY) < 16:
        problems.append(
            "JWT_SECRET_KEY varsayılan/zayıf bırakılmış. Güçlü ve gizli bir "
            "değerle değiştirin (örn. `openssl rand -hex 32`)."
        )
    if s.DEFAULT_ADMIN_PASSWORD in _INSECURE_ADMIN_PASSWORDS:
        problems.append(
            "DEFAULT_ADMIN_PASSWORD varsayılan bırakılmış. İlk kurulumdan "
            "önce .env içinde güçlü bir değerle değiştirin."
        )

    if s.is_production and problems:
        raise RuntimeError(
            "Production ortamında güvensiz konfigürasyonla başlatma reddedildi: "
            + " | ".join(problems)
        )

    warnings = list(problems)
    llm_host = urlparse(s.LLM_API_URL).hostname
    if llm_host and llm_host.lower() not in _LOCAL_HOSTNAMES:
        warnings.append(
            f"LLM_API_URL lokal olmayan bir hosta işaret ediyor: {llm_host}. "
            "Doküman içeriği bu hosta gönderilecektir; bunun bilinçli bir "
            "tercih olduğundan emin olun."
        )
    return warnings


@lru_cache
def get_settings() -> Settings:
    """Ayarların tekil (singleton) örneğini döner."""
    return Settings()


settings = get_settings()
