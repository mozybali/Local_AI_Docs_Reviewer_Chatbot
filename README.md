# LocalDoc AI — Lokal AI Destekli Doküman Soru-Cevap Sistemi

LocalDoc AI; PDF/TXT dokümanları yükleyip bu dokümanlar üzerinden doğal dilde
soru sorabilmeyi sağlayan, **tamamen lokal çalışan** RAG tabanlı bir doküman
soru-cevap sistemidir. Bulut LLM API'sine ihtiyaç duymaz; gizlilik, düşük maliyet
ve offline çalışma hedefler.

> 📘 Ayrıntılı mimari, API referansı, veritabanı tasarımı ve haftalık plan için:
> **[README_final.md](README_final.md)** · Demo ve E2E test: **[DEMO.md](DEMO.md)**

## Özellikler

- JWT tabanlı kimlik doğrulama (kayıt / giriş), bcrypt ile şifre hash'leme
- Çok kullanıcılı izolasyon — her kullanıcı yalnızca kendi dokümanlarına erişir
- Rol bazlı yetkilendirme (`user` / `admin`) ve admin paneli
- PDF / TXT (opsiyonel DOCX) yükleme, async işleme, chunking
- Embedding + ChromaDB ile kullanıcı bazlı semantik arama (top-5)
- Lokal LLM (LM Studio) ile kaynaklı RAG cevap üretimi
- Bağlamda cevap yoksa uydurmaz: *"Bu bilgi yüklenen dokümanda bulunamadı."*
- Ground truth test seti + Recall@5 / MRR / Source Accuracy / No Hallucination ölçümü

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Backend | Python 3.14+, FastAPI |
| Frontend | Next.js (React, TypeScript) |
| Kimlik doğrulama | JWT (python-jose), bcrypt |
| Vektör veritabanı | ChromaDB |
| İlişkisel veritabanı | PostgreSQL |
| Lokal LLM | LM Studio |
| Embedding | sentence-transformers (`BAAI/bge-m3`, 1024 boyut) |

## Hızlı Başlangıç

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                              # değerleri düzenleyin
uvicorn app.main:app --reload                     # http://localhost:8000  (Swagger: /docs)

# Frontend
cd frontend
bun install
cp .env.example .env.local
bun run dev                                        # http://localhost:3000
```

İlk açılışta `.env` içindeki `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` ile
bir admin kullanıcı otomatik oluşturulur. LM Studio'yu açıp local server'ı
başlatmayı ve `LLM_API_URL` / `LLM_MODEL_NAME` değerlerini ayarlamayı unutmayın.

## Proje Yapısı

```text
backend/      FastAPI uygulaması (routers, services, models, utils, tests)
frontend/     Next.js web arayüzü (pages, components, context, lib)
evaluation/   Ground truth test seti + metrik runner'ları (run_eval, run_answer_eval)
ÖrnekPDFLER/  Demo/ground-truth için örnek YÖK/PAÜ yönetmelikleri
README_final.md  Tam proje spesifikasyonu
DEMO.md          Demo senaryosu + uçtan uca test kontrol listesi
```

## Testler

```bash
cd backend
.venv/Scripts/python.exe -m pytest -q     # birim + API/auth testleri
```

Kapsam: chunker, text extractor, embedding/vector store, retrieval, LLM service,
ve HTTP/yetkilendirme testleri (token yok → 401, başka kullanıcı dokümanı → 404,
admin olmayan → 403, pasif kullanıcı → 403).

## Metrik Ölçümü (Hafta 7)

```bash
# Retrieval: Recall@5, MRR + eşik kalibrasyonu (LLM gerektirmez)
python evaluation/run_eval.py --user <kullanıcı-email>

# Cevap kalitesi: Source Accuracy + No Hallucination Rate (LM Studio gerektirir)
python evaluation/run_answer_eval.py --user <kullanıcı-email>
```

Ground truth seti `evaluation/ground_truth.json` içindedir (15 pozitif + 6 negatif
soru, `ÖrnekPDFLER/` dokümanlarına dayalı). Ayrıntı: [evaluation/README.md](evaluation/README.md)
ve sonuç analizi: [RAPOR.md](RAPOR.md).

Örnek dokümanlarla ölçülen sonuçlar (`top_k=8`, embedding: `bge-m3`, LLM: `google/gemma-4-e4b`):

| Metrik | Hedef | Ölçülen |
|---|---|---|
| Recall@k | ≥ %70 | %100 ✅ |
| MRR | ≥ 0.50 | 0.88 ✅ |
| Source Accuracy | ≥ %80 | %100 ✅ |
| No Hallucination Rate | ≥ %80 | %100 ✅ |
