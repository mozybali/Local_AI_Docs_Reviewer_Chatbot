"""Uygulama ayarları.

Tüm konfigürasyon `.env` dosyasından (pydantic-settings ile) okunur.
Değerler `.env.example` dosyasındaki anahtarlarla birebir eşleşir.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """`.env` dosyasından okunan uygulama ayarları."""

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
    LLM_MAX_TOKENS: int = 130000
    # Lokal model yavaş olabileceğinden istek zaman aşımı geniş tutulur (saniye).
    LLM_TIMEOUT: int = 500

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


@lru_cache
def get_settings() -> Settings:
    """Ayarların tekil (singleton) örneğini döner."""
    return Settings()


settings = get_settings()
