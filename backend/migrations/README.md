# Veritabanı Migration'ları (Alembic)

Şema artık `Base.metadata.create_all` ile değil, Alembic migration'ları ile
yönetilir. Tüm komutlar **`backend/`** dizininden çalıştırılır.

## Sık kullanılan komutlar

```bash
# Şemayı en güncel sürüme getir (tabloları oluşturur/günceller)
alembic upgrade head

# Geçmişi ve mevcut sürümü gör
alembic history --verbose
alembic current

# Model değişikliğinden otomatik migration üret (sonra dosyayı gözden geçir!)
alembic revision --autogenerate -m "açıklama"

# Bir adım geri al
alembic downgrade -1

# Hiç DB'ye dokunmadan üretilecek SQL'i gör (offline)
alembic upgrade head --sql
```

## Senaryolar

> Önce mevcut durumu gör: `alembic current` ve veritabanındaki tablolara bak.
> `stamp` komutu **DDL çalıştırmaz**, yalnızca `alembic_version` değerini set eder;
> bu yüzden DB şeması ile işaretlediğin revision'ın eşleştiğinden emin ol.

**Temiz/yeni veritabanı (hiç tablo yok):**
```bash
alembic upgrade head
```
`0001` (users + documents) ve `0002` (chunks) sırayla uygulanır.

**`create_all` ile TÜM tabloları (users + documents + chunks) zaten oluşturmuş mevcut DB:**
```bash
alembic stamp head    # DB zaten 0002 şemasında; sadece sürümü işaretle, DDL yok
```
> ⚠️ Bu durumda `upgrade head` çalıştırma — `CREATE TABLE chunks` "already exists"
> hatası verir. Şema zaten yerinde olduğu için yalnızca `stamp head` gerekir.

**`create_all` ile yalnızca users + documents oluşmuş, chunks henüz YOK olan DB:**
```bash
alembic stamp 0001    # mevcut şemayı baseline olarak işaretle (DDL çalıştırmaz)
alembic upgrade head  # yalnızca eksik 'chunks' tablosunu ekler — veri kaybı yok
```

## Sürümler

| Revision | İçerik |
|----------|--------|
| `0001`   | `users`, `documents` tabloları (1. hafta) |
| `0002`   | `chunks` tablosu (2. hafta) |

> DB URL'i `alembic.ini` içinde tutulmaz; `migrations/env.py`,
> `app.config.settings.DATABASE_URL` (yani `.env`) değerini kullanır.
