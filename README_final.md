# LocalDoc AI — Lokal AI Destekli Doküman Soru-Cevap Sistemi

LocalDoc AI, kullanıcıların PDF, TXT ve isteğe bağlı olarak DOCX formatındaki dokümanları sisteme yükleyerek bu dokümanlar üzerinden doğal dilde soru sorabilmesini sağlayan, **tamamen lokal çalışan** bir RAG tabanlı doküman soru-cevap sistemidir.

Sistem; yüklenen dokümanlardan metin çıkarır, metni anlamlı parçalara böler, embedding vektörleri üretir ve bu vektörleri yerel bir vektör veritabanında saklar. Kullanıcı soru sorduğunda ilgili doküman parçaları semantik arama ile bulunur ve lokal çalışan büyük dil modeli yalnızca getirilen kaynaklara dayanarak cevap üretir.

Sistem çok kullanıcılı çalışır: kullanıcılar kayıt olup giriş yapar (JWT tabanlı kimlik doğrulama) ve her kullanıcı yalnızca kendi yüklediği dokümanları görüp sorgulayabilir. Ayrıca rol bazlı yetkilendirme (kullanıcı / admin) ile kullanıcı ve doküman yönetimi için bir admin paneli içerir.

Bu proje bulut tabanlı LLM API'lerine ihtiyaç duymaz. Amaç; gizlilik, düşük maliyet, offline çalışma ve lokal AI kullanımını bir staj projesi kapsamında uygulanabilir biçimde göstermektir.

---

## İçindekiler

- [Projenin Amacı](#projenin-amacı)
- [MVP Kapsamı](#mvp-kapsamı)
- [Kapsam Dışı](#kapsam-dışı)
- [Başarı ve Kabul Kriterleri](#başarı-ve-kabul-kriterleri)
- [Kullanıcı Rolleri ve Yetkiler](#kullanıcı-rolleri-ve-yetkiler)
- [Kullanılan Teknolojiler](#kullanılan-teknolojiler)
- [Teknik Kararlar](#teknik-kararlar)
- [Sistem Mimarisi](#sistem-mimarisi)
- [Temel Çalışma Akışı](#temel-çalışma-akışı)
- [Proje Klasör Yapısı](#proje-klasör-yapısı)
- [Veritabanı Tasarımı](#veritabanı-tasarımı)
- [API Referansı](#api-referansı)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Kurulum](#kurulum)
- [7 Haftalık Geliştirme Planı](#7-haftalık-geliştirme-planı)
- [Test Planı](#test-planı)
- [Performans Metrikleri](#performans-metrikleri)
- [Güvenlik ve Dosya Doğrulama](#güvenlik-ve-dosya-doğrulama)
- [Riskler ve Önlemler](#riskler-ve-önlemler)
- [Önceliklendirme](#önceliklendirme)
- [Teslim Çıktıları](#teslim-çıktıları)

---

## Projenin Amacı

Bu projenin amacı, lokal çalışan bir yapay zeka sistemiyle doküman tabanlı soru-cevap deneyimi oluşturmaktır.

Kullanıcı bir doküman yükler. Sistem bu dokümanı işler, aranabilir hale getirir ve kullanıcının sorularını yalnızca yüklenen dokümandan elde edilen bağlama göre cevaplar. Böylece modelin genel bilgisinden bağımsız, kaynak gösteren ve kontrol edilebilir bir RAG sistemi geliştirilmiş olur.

### Problem

Kullanıcılar uzun PDF, TXT veya DOCX dokümanları içinde belirli bilgilere hızlıca ulaşmakta zorlanır. Geleneksel anahtar kelime araması çoğu zaman anlamsal benzerliği yakalayamaz. Bulut tabanlı AI servisleri ise gizlilik, maliyet ve internet bağımlılığı gibi sorunlar doğurabilir.

### Çözüm

LocalDoc AI, dokümanları lokal ortamda işler ve lokal LLM kullanarak cevap üretir. Sistem:

- Dokümanları parçalara ayırır.
- Her parça için embedding üretir.
- Semantik arama ile soruya en yakın parçaları bulur.
- Lokal LLM'e yalnızca bu parçaları bağlam olarak verir.
- Cevapla birlikte kaynak doküman ve sayfa bilgisini gösterir.
- Bağlamda cevap yoksa bilgi uydurmaz.

---

## MVP Kapsamı

7 haftalık staj süresi için gerçekçi MVP kapsamı aşağıdaki gibidir:

- Kullanıcı kaydı ve girişi (JWT tabanlı kimlik doğrulama)
- Çok kullanıcılı yapı (her kullanıcı yalnızca kendi dokümanlarına erişir)
- Rol bazlı yetkilendirme (`user` ve `admin` rolleri)
- Admin paneli (kullanıcı ve doküman yönetimi)
- PDF ve TXT dosyası yükleme
- Yüklenen dosyalardan metin çıkarma
- Async doküman işleme
- Chunking
- Embedding üretme
- ChromaDB ile vektör kaydı (kullanıcı bazlı izolasyon)
- Semantik arama
- Lokal LLM ile RAG cevap üretimi
- Kaynak doküman adı ve sayfa numarası gösterme
- Web arayüzü (giriş, kayıt, doküman yönetimi, sohbet, admin paneli)
- En az 10-15 soruluk ground truth test seti
- Recall@5, MRR, Source Accuracy ve No Hallucination Rate ölçümü

### MVP'de Varsayılan Teknik Seçimler

| Alan | MVP Kararı |
|---|---|
| Backend | FastAPI |
| Frontend (web) | React veya Next.js |
| Kimlik doğrulama | JWT (python-jose) + bcrypt (passlib) |
| Vektör veritabanı | ChromaDB |
| İlişkisel veritabanı | PostgreSQL |
| Lokal LLM | LM Studio |
| Embedding modeli | `bge-m3` veya `paraphrase-multilingual-MiniLM-L12-v2` |
| Chunk stratejisi | 512 token, 50 token overlap |
| Dosya tipleri | PDF, TXT; zaman kalırsa DOCX |
| Rol modeli | `user`, `admin` (RBAC) |

---

## Kapsam Dışı

Bu proje kapsamında aşağıdaki özellikler geliştirilmeyecektir:

- Sosyal giriş / OAuth ile kimlik doğrulama (Google, GitHub vb.) — yalnızca e-posta + şifre desteklenir
- E-posta doğrulama, şifre sıfırlama ve iki faktörlü doğrulama
- Gelişmiş doküman paylaşımı ve grup/takım bazlı yetkilendirme (kullanıcılar arası doküman paylaşımı)
- Bulut tabanlı LLM servisleri
- Gerçek zamanlı ortak çalışma
- Üretim seviyesinde dağıtım ve ölçeklendirme

> Not: Kullanıcı hesabı, çok kullanıcılı yapı, rol bazlı yetkilendirme (`user` / `admin`) ve admin paneli **artık MVP kapsamına dâhildir**. Yukarıda kapsam dışı bırakılanlar yalnızca bu özelliklerin ileri/gelişmiş versiyonlarıdır.



---

## Başarı ve Kabul Kriterleri

Proje başarılı kabul edilmek için aşağıdaki kriterleri sağlamalıdır:

- Kullanıcı e-posta ve şifre ile kayıt olup giriş yapabilmeli ve geçerli bir JWT token alabilmelidir.
- Şifreler veritabanında düz metin değil, hash'lenmiş olarak saklanmalıdır.
- Korunan endpoint'ler geçerli token olmadan `401` dönmelidir.
- Her kullanıcı yalnızca kendi yüklediği dokümanları listeleyip sorgulayabilmelidir.
- Bir kullanıcı başka bir kullanıcının dokümanına erişmeye çalıştığında `403` veya `404` dönmelidir.
- `admin` rolündeki kullanıcı tüm kullanıcıları ve tüm dokümanları görüntüleyebilmelidir.
- Admin bir kullanıcıyı pasifleştirebilmeli ve herhangi bir dokümanı silebilmelidir.
- Pasifleştirilmiş kullanıcı giriş yapamamalıdır.
- Kullanıcı PDF ve TXT dosyası yükleyebilmelidir.
- Sistem yüklenen dokümandan metin çıkarabilmelidir.
- Dokümanlar chunk'lara ayrılıp veritabanına kaydedilmelidir.
- Her chunk için embedding oluşturulmalı ve ChromaDB'ye kaydedilmelidir.
- Kullanıcı soru sorduğunda sistem top-5 ilgili chunk'ı bulabilmelidir.
- Her arama sonucunda skor, dosya adı ve sayfa numarası gösterilmelidir.
- Lokal LLM yalnızca getirilen bağlama dayanarak cevap üretmelidir.
- Her cevapta en az bir kaynak gösterilmelidir.
- Dokümanda bulunmayan sorulara standart yanıt dönülmelidir: `Bu bilgi yüklenen dokümanda bulunamadı.`
- Doküman silindiğinde ilişkili PostgreSQL kayıtları, ChromaDB vektörleri ve fiziksel dosya silinmelidir.
- En az 10-15 soruluk ground truth test seti hazırlanmalıdır.
- Recall@5 ve MRR metrikleri hesaplanmalıdır.
- En az 5 negatif soru ile hallüsinasyon kontrolü yapılmalıdır.
- Proje README ve demo akışı ile teslim edilebilir durumda olmalıdır.

---

## Kullanıcı Rolleri ve Yetkiler

Sistemde iki rol bulunur. Roller `users` tablosundaki `role` alanında tutulur ve yetki kontrolü merkezi FastAPI dependency'leri (`get_current_user`, `require_admin`) ile yapılır.

| Rol | Açıklama |
|---|---|
| `user` | Standart kullanıcı. Yalnızca kendi dokümanları üzerinde işlem yapabilir. |
| `admin` | Yönetici. Tüm kullanıcıları ve tüm dokümanları yönetebilir. |

### Yetki Matrisi

| İşlem | Misafir (token yok) | `user` | `admin` |
|---|:---:|:---:|:---:|
| Kayıt olma / giriş yapma | ✅ | ✅ | ✅ |
| Doküman yükleme | ❌ | ✅ | ✅ |
| Kendi dokümanlarını listeleme / silme | ❌ | ✅ | ✅ |
| Kendi dokümanlarına soru sorma | ❌ | ✅ | ✅ |
| Başka kullanıcının dokümanına erişme | ❌ | ❌ | ✅ |
| Tüm kullanıcıları listeleme | ❌ | ❌ | ✅ |
| Kullanıcı pasifleştirme / rol değiştirme | ❌ | ❌ | ✅ |
| Tüm dokümanları görüntüleme / silme | ❌ | ❌ | ✅ |
| Sistem istatistiklerini görüntüleme | ❌ | ❌ | ✅ |

### İlk Admin Kullanıcı

Sistem ilk kez çalıştırıldığında, `.env` içindeki `DEFAULT_ADMIN_EMAIL` ve `DEFAULT_ADMIN_PASSWORD` değerlerinden bir admin kullanıcı (seed) oluşturulur. Kayıt (`/auth/register`) ile oluşturulan tüm kullanıcılar varsayılan olarak `user` rolüne sahiptir; rol yükseltme yalnızca admin tarafından yapılabilir.

---

| Katman | Teknoloji |
|---|---|
| Frontend (web) | React veya Next.js |
| Backend | Python 3.14+, FastAPI |
| Kimlik doğrulama | JWT (python-jose), passlib[bcrypt] |
| Async görev yönetimi | FastAPI BackgroundTasks |
| Lokal AI | LM Studio |
| Vektör veritabanı | ChromaDB |
| İlişkisel veritabanı | PostgreSQL |
| Dosya işleme | pypdf, pdfplumber, python-docx |
| Embedding | sentence-transformers, bge-m3, multilingual modeller |
| Ortam yönetimi | python-dotenv |
| Test | pytest, manuel ground truth değerlendirme |

---

## Teknik Kararlar

### Neden Lokal AI?

- Veriler dış servislere gönderilmez.
- İnternet bağlantısı olmadan çalışabilir.
- API maliyeti oluşmaz.
- Doküman gizliliği korunur.
- Staj projesinde lokal model kurulumu ve entegrasyonu gösterilebilir.

### Neden RAG?

LLM tek başına doküman içeriğini bilmez. RAG yaklaşımıyla önce ilgili doküman parçaları bulunur, sonra model yalnızca bu parçaları kullanarak cevap üretir. Böylece cevaplar daha denetlenebilir ve kaynak gösterilebilir olur.

### Neden ChromaDB?

Bu projede varsayılan vektör veritabanı **ChromaDB** olacaktır.

ChromaDB'nin tercih edilme nedenleri:

- Metadata'yı vektörlerle birlikte saklayabilir.
- Kurulumu FAISS'e göre daha basittir.
- Doküman adı, sayfa numarası, chunk index gibi bilgiler doğrudan tutulabilir.
- Silme, filtreleme ve kalıcı saklama işlemleri daha kolaydır.


### Chunking Kararı

| Parametre | Değer | Gerekçe |
|---|---|---|
| Chunk boyutu | 512 token | Bağlamı korurken embedding kalitesini dengeler |
| Overlap | 50 token | Chunk sınırlarında kopan anlamı azaltır |
| Retrieval sayısı | Top-5 | Ölçüm ve cevap üretimi için başlangıçta yeterli |

### Kimlik Doğrulama Kararı (JWT)

Kimlik doğrulama için **stateless JWT** yaklaşımı seçilmiştir.

- Sunucu tarafında oturum (session) tablosu tutulmaz; bu, FastAPI ile basit ve ölçeklenebilir bir çözümdür.
- Kullanıcı giriş yaptığında imzalı bir `access_token` üretilir ve sonraki isteklerde `Authorization: Bearer <token>` başlığıyla gönderilir.
- Şifreler **bcrypt** (passlib) ile hash'lenir; veritabanında hiçbir zaman düz metin saklanmaz.
- Token doğrulama, korunan tüm endpoint'lerde paylaşılan bir `get_current_user` dependency'si ile yapılır. Bu, yetki kontrolünün tek bir noktada toplanmasını sağlar.

### Rol Modeli (RBAC)

Basit ve staj kapsamında yönetilebilir olması için yalnızca iki rol tanımlanmıştır: `user` ve `admin`.

- Rol, JWT içine ve `users` tablosuna yazılır.
- Admin gerektiren endpoint'ler `require_admin` dependency'si ile korunur.
- Bu model ileride gerekirse yeni roller eklenerek genişletilebilir, ancak MVP'de iki rol yeterlidir.

### Çok Kullanıcılı İzolasyon

Her doküman bir kullanıcıya aittir. İzolasyon iki katmanda sağlanır:

- **PostgreSQL tarafında:** `documents` ve `conversations` tablolarına `user_id` foreign key eklenir. Tüm sorgular giriş yapmış kullanıcının `user_id` değeriyle filtrelenir.
- **ChromaDB tarafında:** Her vektörün metadata'sına `user_id` eklenir. Semantik arama yapılırken sorgu, kullanıcının `user_id` değerine göre `where` filtresiyle sınırlandırılır. Böylece bir kullanıcının sorusu asla başka kullanıcının chunk'larıyla eşleşmez.
- `admin` rolü bu filtreyi atlayarak tüm dokümanlara erişebilir (yalnızca admin endpoint'lerinde).

---

## Sistem Mimarisi

```text
            Web İstemci (React / Next.js)
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │            FastAPI Backend               │
        │                                          │
        │   Auth Middleware (JWT doğrulama)        │
        │   get_current_user / require_admin       │
        │                                          │
        │   ├── Auth Service (kayıt, giriş, rol)   │
        │   ├── Admin Service (kullanıcı/doküman)  │
        │   ├── File Service                       │
        │   ├── Text Extractor                     │
        │   ├── Chunker                            │
        │   ├── Embedding Service                  │
        │   ├── Vector Store Service               │
        │   ├── Retrieval Service                  │
        │   └── LLM Service                        │
        └─────────────────────────────────────────┘
                          ↓
        PostgreSQL Metadata DB (users, documents, chunks, conversations, messages)
                          ↓
        ChromaDB Vector Store (metadata: user_id, document_id, page ...)
                          ↓
        LM Studio Local LLM
                          ↓
                  Cevap + Kaynaklar
```

### RAG Akışı

```text
Doküman
  ↓
Metin çıkarma
  ↓
Chunking
  ↓
Embedding
  ↓
ChromaDB'ye kayıt
  ↓
Kullanıcı sorusu
  ↓
Soru embedding'i
  ↓
Top-5 semantik arama
  ↓
RAG prompt oluşturma
  ↓
Lokal LLM cevap üretimi
  ↓
Cevap + kaynak gösterimi
```

---

## Temel Çalışma Akışı

### 1. Kullanıcı Kaydı ve Giriş

1. Kullanıcı e-posta ve şifre ile kayıt olur (`/auth/register`).
2. Şifre bcrypt ile hash'lenir ve `users` tablosuna `user` rolüyle kaydedilir.
3. Kullanıcı giriş yapar (`/auth/login`); bilgiler doğruysa imzalı bir JWT `access_token` döner.
4. İstemci token'ı saklar ve sonraki tüm korumalı isteklerde `Authorization: Bearer <token>` başlığıyla gönderir.
5. Backend, korumalı endpoint'lerde `get_current_user` ile token'ı doğrular ve isteği yapan kullanıcıyı belirler.

### 2. Doküman Yükleme

1. Giriş yapmış kullanıcı PDF veya TXT dosyası yükler (token zorunludur).
2. Backend dosya türünü, MIME type değerini ve dosya boyutunu kontrol eder.
3. Dosya adı sanitize edilir ve `uploads/` klasörüne güvenli şekilde kaydedilir.
4. PostgreSQL `documents` tablosuna, dokümanı yükleyen kullanıcının `user_id` değeriyle birlikte kayıt atılır.
5. Doküman durumu `processing` yapılır.
6. Kullanıcıya `202 Accepted` ile `document_id` döner.

### 3. Async Doküman İşleme

1. Background task başlatılır.
2. Dosyadan metin çıkarılır.
3. Metin boşsa doküman `error` durumuna alınır.
4. Metin 512 token boyutunda ve 50 token overlap ile chunk'lara ayrılır.
5. Chunk kayıtları PostgreSQL'e yazılır.
6. Her chunk için embedding oluşturulur.
7. Embedding vektörleri metadata ile birlikte (doküman `user_id`'si dahil) ChromaDB'ye yazılır.
8. İşlem tamamlanınca doküman durumu `ready` yapılır.

### 4. Soru-Cevap

1. Giriş yapmış kullanıcı soru sorar (token zorunludur).
2. Soru embedding'e dönüştürülür.
3. ChromaDB içinde, kullanıcının `user_id` değerine göre filtrelenerek top-5 en yakın chunk aranır.
4. Chunk'lar skor ve metadata ile alınır.
5. RAG prompt oluşturulur.
6. Prompt lokal LLM'e gönderilir.
7. Model yalnızca verilen bağlama göre cevap üretir.
8. Cevap kaynak doküman adı ve sayfa numarasıyla döner.

### 5. Doküman Silme

Doküman silindiğinde, önce dokümanın isteği yapan kullanıcıya ait olduğu (veya kullanıcının admin olduğu) doğrulanır. Aksi halde `403`/`404` döner. Yetki doğrulandıktan sonra aşağıdaki işlemler birlikte yapılır:

- `documents` tablosundaki kayıt silinir.
- `chunks` tablosundaki ilişkili chunk'lar silinir.
- ChromaDB içindeki ilgili vektörler silinir.
- `uploads/` klasöründeki fiziksel dosya silinir.
- Silinen dokümandan artık arama sonucu dönmemelidir.

---

## Proje Klasör Yapısı

```text
localdoc-ai/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── seed.py                # İlk admin kullanıcıyı oluşturur
│   │   │
│   │   ├── routers/
│   │   │   ├── auth.py            # register, login, me
│   │   │   ├── admin.py           # kullanıcı ve doküman yönetimi
│   │   │   ├── documents.py
│   │   │   ├── search.py
│   │   │   └── chat.py
│   │   │
│   │   ├── services/
│   │   │   ├── auth_service.py    # şifre hash, JWT üretimi/doğrulama
│   │   │   ├── file_service.py
│   │   │   ├── text_extractor.py
│   │   │   ├── chunker.py
│   │   │   ├── embedding_service.py
│   │   │   ├── vector_store.py
│   │   │   ├── retrieval_service.py
│   │   │   └── llm_service.py
│   │   │
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── chunk.py
│   │   │   └── message.py
│   │   │
│   │   └── utils/
│   │       ├── security.py        # bcrypt + JWT yardımcıları
│   │       ├── dependencies.py    # get_current_user, require_admin
│   │       ├── file_validation.py
│   │       └── evaluation.py
│   │
│   ├── uploads/
│   ├── chroma_db/
│   ├── tests/
│   ├── .env
│   ├── .env.example
│   ├── requirements.txt
│   └── run.py
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   ├── upload.tsx
│   │   │   ├── documents.tsx
│   │   │   ├── chat.tsx
│   │   │   └── admin.tsx          # yalnızca admin erişimli
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.tsx    # token + kullanıcı durumu
│   │   │
│   │   └── components/
│   │       ├── ProtectedRoute.tsx
│   │       ├── FileUploader.tsx
│   │       ├── DocumentList.tsx
│   │       ├── ChatBox.tsx
│   │       ├── SourcePanel.tsx
│   │       ├── AdminPanel.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── .env.local
│   └── package.json
│
├── evaluation/
│   ├── ground_truth.json
│   └── results.json
│
└── README.md
```

---

## Veritabanı Tasarımı

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',  -- 'user' veya 'admin'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    filename    TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type   TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    status      TEXT DEFAULT 'uploaded',
    error_msg   TEXT,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chunks (
    id           SERIAL PRIMARY KEY,
    document_id  INTEGER NOT NULL,
    chunk_text   TEXT NOT NULL,
    page_number  INTEGER,
    chunk_index  INTEGER NOT NULL,
    vector_id    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE conversations (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    title      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

### Kullanıcı Rol Değerleri

| Rol | Anlamı |
|---|---|
| `user` | Standart kullanıcı; yalnızca kendi dokümanlarına erişir |
| `admin` | Yönetici; tüm kullanıcı ve dokümanları yönetebilir |

> `messages` tablosundaki `role` alanı sohbet rolünü (`user` / `assistant`) ifade eder ve `users.role` (yetki rolü) ile karıştırılmamalıdır.

### Status Değerleri

| Status | Anlamı |
|---|---|
| `uploaded` | Dosya yüklendi fakat işleme başlamadı |
| `processing` | Metin çıkarma, chunking veya embedding işlemi sürüyor |
| `ready` | Doküman soru-cevap için hazır |
| `error` | İşleme sırasında hata oluştu |

---

## API Referansı

> **Kimlik doğrulama:** `/auth/register` ve `/auth/login` dışındaki tüm endpoint'ler `Authorization: Bearer <token>` başlığı gerektirir. Token yoksa veya geçersizse `401` döner. Doküman, arama ve sohbet endpoint'leri yalnızca giriş yapmış kullanıcının kendi dokümanları üzerinde çalışır; `/admin/*` endpoint'leri ise yalnızca `admin` rolüyle erişilebilir.

### Kayıt Olma

```http
POST /auth/register
Content-Type: application/json
```

İstek:

```json
{
  "email": "user@example.com",
  "password": "gizli_sifre"
}
```

Örnek cevap:

```json
{
  "id": 2,
  "email": "user@example.com",
  "role": "user",
  "is_active": true
}
```

### Giriş Yapma

```http
POST /auth/login
Content-Type: application/json
```

İstek:

```json
{
  "email": "user@example.com",
  "password": "gizli_sifre"
}
```

Örnek cevap:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Mevcut Kullanıcı Bilgisi

```http
GET /auth/me
Authorization: Bearer <token>
```

Örnek cevap:

```json
{
  "id": 2,
  "email": "user@example.com",
  "role": "user",
  "is_active": true
}
```

### Doküman Yükleme

```http
POST /documents/upload
Content-Type: multipart/form-data
```

Örnek cevap:

```json
{
  "document_id": 1,
  "status": "processing"
}
```

### Doküman Durumu Sorgulama

```http
GET /documents/{document_id}/status
```

Örnek cevap:

```json
{
  "document_id": 1,
  "status": "ready",
  "error_msg": null
}
```

### Doküman Listeleme

```http
GET /documents
```

Örnek cevap:

```json
[
  {
    "id": 1,
    "filename": "personel_yonetmeligi.pdf",
    "file_type": "pdf",
    "status": "ready",
    "upload_date": "2026-06-24T12:00:00"
  }
]
```

### Doküman Silme

```http
DELETE /documents/{document_id}
```

Silme işlemi PostgreSQL, ChromaDB ve fiziksel dosyayı kapsamalıdır.

### Semantik Arama

```http
POST /search
Content-Type: application/json
```

İstek:

```json
{
  "question": "Yıllık izin kaç gün önce talep edilmelidir?",
  "document_ids": [1],
  "top_k": 5
}
```

Cevap:

```json
{
  "results": [
    {
      "text": "Yıllık izin talepleri en az 5 iş günü öncesinden yapılmalıdır.",
      "score": 0.91,
      "document_id": 1,
      "document": "personel_yonetmeligi.pdf",
      "page": 4,
      "chunk_index": 12
    }
  ]
}
```

### Soru-Cevap

```http
POST /chat/ask
Content-Type: application/json
```

İstek:

```json
{
  "question": "Yıllık izin kaç gün önce talep edilmelidir?",
  "document_ids": [1]
}
```

Cevap:

```json
{
  "answer": "Yıllık izin talebi en az 5 iş günü önce yapılmalıdır.",
  "sources": [
    {
      "document": "personel_yonetmeligi.pdf",
      "page": 4,
      "chunk_index": 12,
      "score": 0.91,
      "text": "Yıllık izin talepleri en az 5 iş günü öncesinden yapılmalıdır."
    }
  ]
}
```

### Admin — Kullanıcıları Listeleme

```http
GET /admin/users
Authorization: Bearer <admin_token>
```

Örnek cevap:

```json
[
  {
    "id": 1,
    "email": "admin@localdoc.ai",
    "role": "admin",
    "is_active": true,
    "document_count": 3
  },
  {
    "id": 2,
    "email": "user@example.com",
    "role": "user",
    "is_active": true,
    "document_count": 1
  }
]
```

### Admin — Kullanıcı Güncelleme (rol / aktiflik)

```http
PATCH /admin/users/{user_id}
Authorization: Bearer <admin_token>
Content-Type: application/json
```

İstek (rol değiştirme veya pasifleştirme):

```json
{
  "role": "admin",
  "is_active": false
}
```

### Admin — Tüm Dokümanları Listeleme

```http
GET /admin/documents
Authorization: Bearer <admin_token>
```

Tüm kullanıcılara ait dokümanları, sahibinin `user_id` ve e-postasıyla birlikte döner.

### Admin — Doküman Silme

```http
DELETE /admin/documents/{document_id}
Authorization: Bearer <admin_token>
```

Admin, sahibinden bağımsız olarak herhangi bir dokümanı silebilir. Silme işlemi PostgreSQL, ChromaDB ve fiziksel dosyayı kapsar.

### Admin — Sistem İstatistikleri

```http
GET /admin/stats
Authorization: Bearer <admin_token>
```

Örnek cevap:

```json
{
  "total_users": 2,
  "active_users": 2,
  "total_documents": 4,
  "documents_by_status": {
    "ready": 3,
    "processing": 1
  }
}
```

---

## Ortam Değişkenleri

`.env.example` dosyası:

```env
# Dosya yükleme
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=50
ALLOWED_EXTENSIONS=pdf,txt,docx

# Veritabanı
DATABASE_URL=postgresql+psycopg://localdoc:localdoc@localhost:5432/localdoc_ai

# Kimlik doğrulama (JWT)
JWT_SECRET_KEY=degistir_bu_degeri_uretimde
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# İlk admin kullanıcı (uygulama ilk açıldığında oluşturulur)
DEFAULT_ADMIN_EMAIL=admin@localdoc.ai
DEFAULT_ADMIN_PASSWORD=degistir_beni

# Lokal LLM
LLM_PROVIDER=lmstudio
LLM_API_URL=http://localhost:1234/v1
LLM_MODEL_NAME=local-model

# Vektör veritabanı
VECTOR_STORE=chromadb
CHROMA_PERSIST_DIR=./chroma_db
CHROMA_COLLECTION_NAME=localdoc_chunks

# Embedding
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

# Chunking
CHUNK_SIZE=512
CHUNK_OVERLAP=50
TOP_K=5

# İstemciler (CORS)
FRONTEND_ORIGIN=http://localhost:3000
```

> **Önemli:** `JWT_SECRET_KEY` güçlü ve gizli tutulmalı, üretimde mutlaka değiştirilmelidir. `DEFAULT_ADMIN_PASSWORD` ilk girişten sonra değiştirilmelidir.

`.env` dosyası Git'e eklenmemelidir.

`.gitignore` içinde en az aşağıdaki satırlar bulunmalıdır:

```gitignore
.env
__pycache__/
venv/
uploads/
chroma_db/
node_modules/
```

---

## Kurulum

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend (Web)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### İlk Admin Kullanıcı

Backend ilk kez başlatıldığında, `.env` içindeki `DEFAULT_ADMIN_EMAIL` ve `DEFAULT_ADMIN_PASSWORD` değerleriyle bir admin kullanıcı otomatik oluşturulur. Admin paneline bu hesapla giriş yapılabilir. İlk girişten sonra bu şifre değiştirilmelidir.


### LM Studio ile Lokal LLM

1. LM Studio uygulamasını açın.
2. Uygun bir instruct modeli indirin.
3. Local server'ı başlatın.
4. `.env` içindeki `LLM_API_URL` ve `LLM_MODEL_NAME` değerlerini LM Studio local server ayarlarınıza göre güncelleyin.

---

## 7 Haftalık Geliştirme Planı

## 1. Hafta — Proje Kurulumu, Kimlik Doğrulama ve Dosya Yükleme

### Amaç

Backend ve frontend başlangıç yapısını kurmak, JWT tabanlı kimlik doğrulamayı çalışır hale getirmek ve korumalı dosya yükleme akışını oluşturmak.

### Yapılacaklar

- FastAPI projesi oluşturulur.
- React veya Next.js frontend başlatılır.
- CORS ayarları yapılır.
- `.env` ve `.env.example` hazırlanır.
- PostgreSQL bağlantısı kurulur.
- `users` ve `documents` tabloları oluşturulur.
- Şifre hash'leme (bcrypt/passlib) ve JWT üretimi/doğrulama yardımcıları yazılır (`security.py`).
- `/auth/register`, `/auth/login` ve `/auth/me` endpoint'leri yazılır.
- `get_current_user` dependency'si yazılır.
- `.env` değerlerinden ilk admin kullanıcı (seed) oluşturulur.
- Korumalı PDF ve TXT yükleme endpoint'i yazılır; doküman yükleyen kullanıcının `user_id` değeriyle ilişkilendirilir.
- Dosya uzantısı, MIME type ve dosya boyutu kontrol edilir.
- PDF ve TXT için metin çıkarma servisi hazırlanır.
- Frontend'de giriş ve kayıt ekranları ile `AuthContext` (token saklama) yapılır.
- Basit dosya yükleme ekranı yapılır.

### Kabul Kriterleri

- Backend `uvicorn app.main:app --reload`, frontend `npm run dev` ile çalışmalıdır.
- Kullanıcı e-posta/şifre ile kayıt olup giriş yapabilmeli ve geçerli bir JWT alabilmelidir.
- Şifreler veritabanında hash'lenmiş olarak saklanmalıdır.
- Token olmadan yükleme endpoint'i `401` dönmelidir.
- Yüklenen doküman doğru `user_id` ile PostgreSQL'e kaydedilmelidir.
- Desteklenmeyen veya boş dosya için açıklayıcı hata dönmelidir.

### Hafta Sonu Çıktısı

- Çalışan kayıt/giriş akışı (JWT)
- `get_current_user` ile korunan endpoint'ler
- İlk admin kullanıcı seed'i
- Korumalı dosya yükleme + metin çıkarma prototipi
- Frontend giriş/kayıt/yükleme ekranları

---

## 2. Hafta — Async İşleme, Chunking ve Çok Kullanıcılı Doküman Yönetimi

### Amaç

Yüklenen dokümanları API isteğini bloke etmeden arka planda işlemek, chunk'lara ayırmak ve doküman yönetimini kullanıcı bazlı izole etmek.

### Yapılacaklar

- FastAPI `BackgroundTasks` ile async işleme eklenir.
- Doküman statüleri uygulanır: `uploaded`, `processing`, `ready`, `error`.
- `chunks` tablosu oluşturulur.
- Chunking servisi yazılır (512 token, 50 token overlap).
- Her chunk için sayfa numarası, doküman ID ve chunk index metadata'sı tutulur.
- Doküman durum sorgulama, listeleme ve silme endpoint'leri yazılır; **hepsi giriş yapmış kullanıcının `user_id` değeriyle filtrelenir.**
- Sahiplik kontrolü eklenir: kullanıcı başka birinin dokümanına erişmeye çalışırsa `403`/`404` döner.
- Frontend'de doküman listesi, durum göstergesi ve `ProtectedRoute` eklenir.
- Zaman kalırsa DOCX desteği eklenir.

### Kabul Kriterleri

- Dosya yükleme isteği uzun işlem beklemeden `202 Accepted` dönmelidir.
- İşleme süreci durum endpoint'iyle takip edilebilmelidir.
- Başarılı işlemede durum `ready`, hatada `error` ve `error_msg` olmalıdır.
- Chunk kayıtları PostgreSQL'e yazılmalıdır.
- Kullanıcı yalnızca kendi dokümanlarını listeleyebilmelidir.
- Başka kullanıcının dokümanına erişim `403`/`404` dönmelidir.
- Doküman silindiğinde ilişkili chunk'lar da silinmelidir.

### Hafta Sonu Çıktısı

- Async doküman işleme ve chunking sistemi
- Kullanıcı bazlı doküman listeleme, durum sorgulama ve silme
- Korumalı frontend doküman yönetimi ekranı

---

## 3. Hafta — Embedding ve ChromaDB Entegrasyonu (Kullanıcı İzolasyonlu)

### Amaç

Doküman chunk'larını embedding vektörlerine dönüştürmek, ChromaDB'ye kullanıcı bazlı izolasyonla kaydetmek ve semantik aramayı giriş yapmış kullanıcıyla sınırlamak.

### Yapılacaklar

- Embedding modeli seçilir ve projeye entegre edilir.
- Her chunk için embedding oluşturulur.
- ChromaDB bağlantısı kurulur.
- Vektörler metadata ile birlikte (`user_id`, `document_id`, `page`, `chunk_index`) ChromaDB'ye kaydedilir.
- `vector_id` alanı PostgreSQL'deki chunk kaydıyla ilişkilendirilir.
- Kullanıcı sorusu embedding'e dönüştürülür.
- ChromaDB `where` filtresiyle kullanıcının `user_id` değerine göre top-5 semantik arama yapılır.
- `/search` endpoint'i yazılır (korumalı ve kullanıcı bazlı).
- Arama sonuçlarında skor, doküman adı, sayfa numarası ve chunk index gösterilir.
- Manuel retrieval testleri yapılır.

### Kabul Kriterleri

- En az 3 farklı doküman sisteme yüklenip işlenebilmelidir (farklı kullanıcılarla da test edilir).
- Her doküman için chunk sayısı görüntülenebilmelidir.
- Kullanıcı sorusu için top-5 chunk listelenebilmelidir.
- Her sonuçta skor, dosya adı ve sayfa numarası bulunmalıdır.
- 10 manuel test sorusundan en az 7'sinde doğru kaynak ilk 5 sonuç içinde olmalıdır.
- Bir kullanıcının araması asla başka bir kullanıcının chunk'ını döndürmemelidir.
- Doküman silindiğinde ChromaDB içindeki ilgili vektörler de silinmelidir.

### Hafta Sonu Çıktısı

- Çalışan embedding pipeline'ı
- Kullanıcı izolasyonlu ChromaDB vektör kaydı
- Kullanıcı bazlı semantik arama endpoint'i

---

## 4. Hafta — Lokal LLM Entegrasyonu ve RAG Cevap Üretimi

### Amaç

Retrieval sonuçlarını lokal LLM'e bağlam olarak verip kaynaklı ve kontrollü cevap üretmek.

### Yapılacaklar

- LM Studio kurulumu yapılır.
- Lokal LLM modeli seçilir.
- `llm_service.py` yazılır.
- LLM bağlantısı test edilir.
- RAG prompt şablonu hazırlanır.
- Retrieval sonuçları prompt içine yerleştirilir.
- `/chat/ask` endpoint'i yazılır (korumalı; retrieval kullanıcının `user_id` değeriyle sınırlandırılır).
- Dokümanda bulunmayan sorular için standart cevap kuralı eklenir.
- Cevapla birlikte kaynaklar frontend'e gönderilir.
- Frontend'de chat ekranı oluşturulur.
- Manuel cevap kalitesi testleri yapılır.

### RAG Prompt Şablonu

```text
Sen lokal çalışan bir doküman soru-cevap asistanısın.

Kurallar:
1. Sadece aşağıdaki bağlamı kullan.
2. Bağlamda olmayan bilgiyi ekleme.
3. Emin değilsen tahmin yapma.
4. Cevabı Türkçe ve açık şekilde ver.
5. Cevap sonunda kullanılan kaynakları belirt.
6. Bağlamda cevap yoksa yalnızca şunu yaz:
   "Bu bilgi yüklenen dokümanda bulunamadı."

Bağlam:
{retrieved_chunks}

Soru:
{question}

Cevap:
```

### Kabul Kriterleri

- Backend lokal LLM'e istek atabilmelidir.
- Kullanıcı soru sorduğunda sistem önce retrieval yapmalıdır.
- LLM cevabı yalnızca getirilen chunk'lara dayanmalıdır.
- Kullanıcı yalnızca kendi dokümanlarından cevap alabilmelidir.
- Cevapla birlikte kaynak listesi dönmelidir.
- Dokümanda bulunmayan soruda standart yanıta dönmelidir.
- LLM çalışmıyorsa kullanıcıya anlaşılır hata mesajı gösterilmelidir.

### Hafta Sonu Çıktısı

- Çalışan RAG pipeline'ı
- Lokal LLM bağlantısı
- Kaynaklı cevap üretimi
- Basit chat ekranı

---

## 5. Hafta — Rol Bazlı Yetkilendirme ve Admin Paneli

### Amaç

Rol bazlı yetkilendirmeyi (RBAC) uygulamak ve kullanıcı ile doküman yönetimi için web admin panelini oluşturmak.

### Yapılacaklar

- `require_admin` dependency'si yazılır.
- Admin endpoint'leri yazılır: `GET /admin/users`, `PATCH /admin/users/{id}`, `GET /admin/documents`, `DELETE /admin/documents/{id}`, `GET /admin/stats`.
- Kullanıcı pasifleştirme ve rol değiştirme uygulanır.
- Pasif kullanıcının giriş yapması engellenir.
- Admin'in, sahibinden bağımsız olarak herhangi bir dokümanı silebilmesi sağlanır.
- Frontend'de admin paneli (`admin.tsx`, `AdminPanel.tsx`) yalnızca admin erişimiyle eklenir.
- Yetkilendirme testleri yazılır.

### Kabul Kriterleri

- Admin tüm kullanıcıları ve tüm dokümanları görüntüleyebilmelidir.
- Admin olmayan kullanıcı `/admin/*` endpoint'lerine eriştiğinde `403` dönmelidir.
- Admin bir kullanıcıyı pasifleştirebilmeli; pasif kullanıcı giriş yapamamalıdır.
- Admin herhangi bir kullanıcının dokümanını silebilmelidir.
- Rol değişiklikleri kalıcı olmalı ve yeni token'a yansımalıdır.

### Hafta Sonu Çıktısı

- RBAC altyapısı (`require_admin`)
- Admin endpoint'leri (kullanıcı/doküman/istatistik)
- Web admin paneli

---

## 6. Hafta — Web Frontend Tamamlama ve İyileştirme

### Amaç

Web arayüzünü tamamlamak, tüm akışları cilalamak ve hata yönetimini iyileştirmek.

### Yapılacaklar

- Chat ekranı tamamlanır ve kaynak gösterme paneli eklenir.
- Doküman yükleme ve listeleme ekranları iyileştirilir.
- Admin paneli iyileştirilir.
- Kullanıcı dostu hata mesajları eklenir (`401`, `403`, pasif hesap, LLM kapalı vb.).
- Yükleme ve işleme durumu göstergeleri iyileştirilir.
- Sohbet geçmişi zaman kalırsa eklenir.
- Responsive (mobil uyumlu) düzen gözden geçirilir.

### Kabul Kriterleri

- Tüm ana akışlar (giriş, kayıt, yükleme, sohbet, admin) web'de sorunsuz çalışmalıdır.
- Hata durumları anlaşılır mesajlarla gösterilmelidir.
- Cevaplarda kaynak paneli görünmelidir.
- Yetkisiz sayfalara erişim giriş ekranına yönlendirmelidir.

### Hafta Sonu Çıktısı

- Tamamlanmış web arayüzü
- Tutarlı ve kullanıcı dostu hata yönetimi
- İyileştirilmiş admin paneli

---

## 7. Hafta — Test, Metrik Ölçümü ve Sunum

### Amaç

Projeyi teslim edilebilir hale getirmek, test setiyle ölçüm yapmak ve demo akışını hazırlamak.

### Yapılacaklar

- Ground truth test seti hazırlanır (en az 10-15 pozitif ve 5 negatif soru).
- Recall@5, MRR, Source Accuracy ve No Hallucination Rate hesaplanır.
- Kimlik doğrulama ve yetkilendirme testleri yapılır (token yok → `401`, başka kullanıcı dokümanı → `403`/`404`, admin olmayan → `403`).
- Web için uçtan uca test yapılır.
- Demo senaryosu hazırlanır.
- README son haline getirilir.
- Proje raporu veya sunum notları oluşturulur.

### Kabul Kriterleri

- Kullanıcı dosya yükleyip soru sorabilmeli ve cevaplarda kaynak paneli görünmelidir.
- Ground truth test seti repoda bulunmalıdır.
- Metrik sonuçları `evaluation/results.json` veya README içinde raporlanmalıdır.
- Yetkilendirme senaryoları beklenen HTTP kodlarını dönmelidir.
- En az bir demo dokümanı ile uçtan uca web senaryosu çalışmalıdır.
- Proje kurulum adımları başka bir geliştirici tarafından takip edilebilir olmalıdır.

### Hafta Sonu Çıktısı

- Teslim edilebilir uygulama (web + admin paneli)
- Test seti ve metrik sonuçları
- Demo akışı
- Güncel README

---

## Test Planı

### Birim Testler

| Modül | Test |
|---|---|
| `auth_service.py` | Şifre hash'leme/doğrulama ve JWT üretimi/çözümü doğru çalışıyor mu? |
| `security.py` / `dependencies.py` | Geçersiz veya süresi dolmuş token reddediliyor mu? `require_admin` admin olmayanı engelliyor mu? |
| `file_validation.py` | Desteklenen ve desteklenmeyen dosya türleri doğru ayrılıyor mu? |
| `text_extractor.py` | PDF, TXT ve varsa DOCX metni doğru çıkarılıyor mu? |
| `chunker.py` | Chunk boyutu ve overlap doğru çalışıyor mu? |
| `embedding_service.py` | Embedding boyutu beklenen değerle eşleşiyor mu? |
| `vector_store.py` | Vektör ekleme, `user_id` filtreli arama ve silme çalışıyor mu? |
| `retrieval_service.py` | Top-k sonuçları skorla ve kullanıcı bazlı döndürüyor mu? |
| `llm_service.py` | Lokal LLM bağlantı hataları yönetiliyor mu? |

### Uçtan Uca Test Senaryoları

| Senaryo | Beklenen Sonuç |
|---|---|
| Kayıt ol → giriş yap | Geçerli bir JWT token döner |
| Token olmadan doküman yükle | `401` döner |
| Geçersiz/expired token ile istek | `401` döner |
| Başka kullanıcının dokümanını sorgula/sil | `403` veya `404` döner |
| Admin tüm dokümanları listele | Tüm kullanıcıların dokümanları döner |
| Admin olmayan `/admin/*` erişimi | `403` döner |
| Admin kullanıcıyı pasifleştir → o kullanıcı giriş yap | Giriş reddedilir |
| PDF yükle → soru sor | Doğru cevap ve kaynak döner |
| TXT yükle → soru sor | Doğru metin üzerinden cevap döner |
| DOCX yükle → soru sor | DOCX desteği eklenmişse cevap döner |
| Dokümanda olmayan soru sor | `Bu bilgi yüklenen dokümanda bulunamadı.` döner |
| İki doküman yükle → soru sor | Doğru dokümandan kaynak gösterilir |
| Doküman sil → aynı soruyu sor | Silinen dokümandan sonuç dönmez |
| Büyük PDF yükle | API kilitlenmez, durum `processing` olarak takip edilir |
| LLM kapalıyken soru sor | Açıklayıcı hata mesajı gösterilir |
| Bozuk PDF yükle | Doküman `error` durumuna alınır |
| Çok büyük dosya yükle | Dosya reddedilir |

### Ground Truth Test Seti

`evaluation/ground_truth.json` örneği:

```json
[
  {
    "id": 1,
    "question": "Yıllık izin kaç gün önce talep edilmelidir?",
    "expected_answer": "En az 5 iş günü önce",
    "expected_source_doc": "personel_yonetmeligi.pdf",
    "expected_page": 4
  },
  {
    "id": 2,
    "question": "Fazla mesai ücreti nasıl hesaplanır?",
    "expected_answer": "Dokümanda belirtilen fazla mesai katsayısına göre hesaplanır.",
    "expected_source_doc": "personel_yonetmeligi.pdf",
    "expected_page": 7
  }
]
```

---

## Performans Metrikleri

### Retrieval Metrikleri

| Metrik | Açıklama | Hedef |
|---|---|---|
| Recall@5 | Beklenen kaynak ilk 5 sonuç içinde mi? | >= %70 |
| MRR | Beklenen kaynak kaçıncı sırada geliyor? | >= 0.50 |
| Avg. Retrieval Time | Semantik arama süresi | < 1 saniye |

### Cevap Kalitesi Metrikleri

| Metrik | Açıklama | Hedef |
|---|---|---|
| Source Accuracy | Cevap gösterilen kaynak tarafından destekleniyor mu? | >= %80 |
| No Hallucination Rate | Negatif sorularda bilgi uydurmama oranı | >= %80 |
| Answer Completeness | Cevap beklenen bilgiyi içeriyor mu? | Manuel değerlendirme |

### Sistem Performansı

| Metrik | Açıklama | Hedef |
|---|---|---|
| Avg. Response Time | Soru-cevap toplam süresi | Donanıma göre raporlanır |
| Doc Processing Time | Doküman indeksleme süresi | Sayfa sayısıyla birlikte raporlanır |
| Chunk Count | Doküman başına üretilen chunk sayısı | Raporlanır |

### Metrik Hesaplama Yöntemi

1. Her test sorusu için beklenen kaynak doküman ve sayfa numarası belirlenir.
2. Sistemden top-5 retrieval sonucu alınır.
3. Beklenen kaynak ilk 5 sonuçta varsa Recall@5 için başarılı kabul edilir.
4. Beklenen kaynak kaçıncı sıradaysa MRR için `1 / rank` değeri hesaplanır.
5. Beklenen kaynak ilk 5 içinde yoksa MRR değeri `0` kabul edilir.
6. Dokümanda cevabı olmayan en az 5 negatif soru sorulur.
7. Model bu sorulara standart cevap dönerse No Hallucination Rate için başarılı kabul edilir.
8. Kaynak doğruluğu manuel olarak kontrol edilir.

### Örnek MRR Hesabı

| Soru | Doğru Kaynak Sırası | MRR Katkısı |
|---|---:|---:|
| 1 | 1 | 1.00 |
| 2 | 2 | 0.50 |
| 3 | 5 | 0.20 |
| 4 | Yok | 0.00 |

Ortalama MRR:

```text
(1.00 + 0.50 + 0.20 + 0.00) / 4 = 0.425
```

---

## Güvenlik ve Dosya Doğrulama

Dosya yükleyen ve çok kullanıcılı sistemlerde minimum güvenlik kontrolleri yapılmalıdır.

### Kimlik Doğrulama ve Yetkilendirme Kontrolleri

- Şifreler bcrypt ile hash'lenmeli, asla düz metin saklanmamalıdır.
- `JWT_SECRET_KEY` güçlü olmalı, `.env` ile yönetilmeli ve repoya eklenmemelidir.
- Token expire süresi makul tutulmalıdır (varsayılan 24 saat).
- `/auth/*` dışındaki endpoint'ler geçerli `Authorization: Bearer` token gerektirmelidir.
- Her kullanıcı yalnızca kendi kaynaklarına (doküman, sohbet, arama) erişebilmelidir; yetki kontrolü her endpoint'te zorunludur.
- Admin endpoint'leri yalnızca `admin` rolüyle erişilebilir olmalıdır (`require_admin`).
- Pasifleştirilmiş kullanıcılar giriş yapamamalı ve token üretememelidir.
- Yetki kontrolü dağıtık değil, merkezi dependency'lerde (`get_current_user`, `require_admin`) toplanmalıdır.

### Zorunlu Dosya Kontrolleri

- Dosya uzantısı kontrol edilmelidir.
- MIME type kontrol edilmelidir.
- Maksimum dosya boyutu sınırı uygulanmalıdır.
- Dosya adı sanitize edilmelidir.
- Path traversal engellenmelidir.
- Boş dosya reddedilmelidir.
- Bozuk veya şifreli PDF'ler `error` durumuna alınmalıdır.
- `uploads/` klasörü doğrudan public olarak servis edilmemelidir.
- `.env` dosyası Git'e eklenmemelidir.

### Kullanıcıya Gösterilecek Hata Mesajları

| Durum | Mesaj |
|---|---|
| Desteklenmeyen dosya türü | Yalnızca PDF, TXT ve DOCX dosyaları desteklenmektedir. |
| Dosya çok büyük | Maksimum dosya boyutu 50 MB'tır. |
| Boş dosya | Yüklenen dosya boş görünüyor. |
| Bozuk veya şifreli PDF | Bu PDF okunamadı. Şifreli veya bozuk olabilir. |
| LLM bağlantı hatası | Lokal AI modeli çalışmıyor. LM Studio local server'ını başlatın. |
| Embedding hatası | Embedding modeli yüklenemedi. Lütfen tekrar deneyin. |
| Doküman hazır değil | Bu doküman henüz işleniyor. Lütfen işlem tamamlandıktan sonra tekrar deneyin. |
| Geçersiz kimlik bilgileri | E-posta veya şifre hatalı. |
| Yetkisiz erişim (401) | Bu işlem için giriş yapmanız gerekiyor. |
| Yetersiz yetki (403) | Bu işlem için yetkiniz yok. |
| Pasif hesap | Hesabınız pasifleştirilmiş. Lütfen yönetici ile iletişime geçin. |

---

## Riskler ve Önlemler

| Risk | Etki | Önlem |
|---|---|---|
| Lokal LLM yavaş çalışabilir | Cevap süresi artar | Daha küçük model seçilir, top-k düşük tutulur |
| Büyük PDF işleme uzun sürebilir | Kullanıcı bekler | Async processing ve durum endpoint'i kullanılır |
| PDF metni düzgün çıkarılamayabilir | Cevap kalitesi düşer | pdfplumber alternatifi eklenir, hata mesajı verilir |
| Embedding modeli Türkçe'de zayıf kalabilir | Retrieval kalitesi düşer | bge-m3 veya multilingual model denenir |
| Model bilgi uydurabilir | Yanlış cevap üretir | Sıkı RAG prompt ve negatif test soruları kullanılır |
| Silinen doküman aramada çıkabilir | Yanlış kaynak döner | PostgreSQL ve ChromaDB silme işlemleri birlikte yapılır |
| Kapsam büyüyebilir | Proje yetişmez | MVP ve kapsam dışı maddeler korunur |
| Donanım yetersiz olabilir | Model çalışmayabilir | 3B/4B model veya quantized model kullanılır |
| Kimlik doğrulama kapsamı genişleyebilir | Auth işi büyür, plan sarkar | OAuth, sosyal giriş, şifre sıfırlama kapsam dışı tutulur; yalnızca e-posta/şifre + JWT yapılır |
| Yetki kontrolü atlanabilir, veri sızabilir | Kullanıcı başkasının dokümanını görür | Merkezi `get_current_user` ve `require_admin` bağımlılıkları tüm korumalı endpoint'lerde zorunlu kılınır, çapraz erişim testleri yazılır |
| JWT secret sızabilir | Token'lar taklit edilebilir | Secret yalnızca `.env` içinde tutulur, repoya konmaz, örnek değerle paylaşılır |

---

## Önceliklendirme

### Mutlaka Yapılması Gerekenler

- PDF ve TXT yükleme
- Metin çıkarma
- Async doküman işleme
- Chunking
- Embedding oluşturma
- ChromaDB ile vektör kaydı
- Semantik arama
- Lokal LLM ile RAG cevap üretimi
- Kaynak gösterme
- Kullanıcı kaydı ve girişi (JWT ile kimlik doğrulama)
- Çok kullanıcılı izolasyon (her kullanıcı yalnızca kendi dokümanlarını görür)
- Rol bazlı yetkilendirme (user / admin)
- Temel admin paneli (kullanıcı ve doküman yönetimi)
- Basit frontend
- Ground truth test seti
- Temel metrik hesaplama

### Zaman Kalırsa

- DOCX desteği
- Sohbet geçmişi
- Daha iyi frontend tasarımı
- Daha gelişmiş admin istatistik ekranı
- Docker kurulumu
- Farklı embedding modellerini karşılaştırma
- FAISS alternatifinin dokümante edilmesi

### En Son Yapılacaklar

- Gelişmiş doküman paylaşımı ve grup bazlı yetkilendirme
- OAuth / sosyal giriş (Google, GitHub vb.)
- Şifre sıfırlama ve e-posta doğrulama
- Gelişmiş analitik ekranı
- Çok dilli arayüz

---

## Teslim Çıktıları

Proje sonunda aşağıdaki çıktılar teslim edilmelidir:

- Çalışan backend uygulaması
- Çalışan frontend uygulaması
- Kimlik doğrulama ve admin paneli
- `.env.example` dosyası
- Güncel README
- Ground truth test seti
- Metrik sonuçları
- Demo dokümanı veya örnek veri
- Demo senaryosu
- Kısa proje raporu veya sunum notları

---

## Haftalık Özet

| Hafta | Ana Odak | Kritik Çıktı | Kabul Göstergesi |
|---|---|---|---|
| 1 | Kurulum, kimlik doğrulama ve dosya yükleme | Backend, PostgreSQL, JWT auth, upload endpoint | Kullanıcı kayıt/giriş yapar, token ile PDF/TXT yükler |
| 2 | Async işleme, chunking ve çok kullanıcılı dokümanlar | BackgroundTasks, chunk tablosu, `user_id` ile izolasyon | Doküman `ready` durumuna geçer, kullanıcı yalnızca kendi dokümanını görür |
| 3 | Embedding ve retrieval | ChromaDB, `user_id` filtreli top-5 semantik arama | Doğru kaynak ilk 5 sonuçta, sadece kullanıcının kendi dokümanlarından bulunur |
| 4 | Lokal LLM ve RAG | `/chat/ask`, prompt, kaynaklı cevap | Dokümandan cevap üretir, kaynak gösterir |
| 5 | Rol bazlı yetkilendirme ve admin paneli | `require_admin`, `/admin/*` endpoint'leri, admin ekranı | Admin tüm kullanıcı/dokümanları yönetir, yetkisiz erişim 403 döner |
| 6 | Web frontend tamamlama | Giriş/kayıt, doküman ve sohbet arayüzü, korumalı rotalar | Web arayüzü tüm akışları uçtan uca destekler |
| 7 | Test, metrik ve teslim | Metrikler, uçtan uca testler, demo | Proje uçtan uca sunulabilir, metrikler raporlanır |
