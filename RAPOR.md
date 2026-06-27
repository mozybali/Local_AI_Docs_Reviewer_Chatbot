# LocalDoc AI — Proje Raporu ve Sunum Notları (Hafta 7)

## 1. Özet

LocalDoc AI, kullanıcıların PDF/TXT dokümanları yükleyip bu dokümanlar üzerinden
doğal dilde soru sorabildiği, **tamamen lokal çalışan** RAG (Retrieval-Augmented
Generation) tabanlı bir doküman soru-cevap sistemidir. Bulut LLM servisleri
kullanılmaz; tüm işleme (metin çıkarma, embedding, vektör arama, cevap üretimi)
yerel ortamda yapılır. Amaç: gizlilik, düşük maliyet, offline çalışma.

Sistem çok kullanıcılıdır (JWT kimlik doğrulama), rol bazlı yetkilendirme
(`user` / `admin`) ve bir admin paneli içerir. Her kullanıcı yalnızca kendi
dokümanlarına erişir.

## 2. Mimari (özet)

```
Web (Next.js) → FastAPI Backend → PostgreSQL (metadata: users, documents, chunks)
                                 → ChromaDB (vektörler; metadata: user_id, document_id, page)
                                 → LM Studio (lokal LLM)
```

RAG akışı: Doküman → metin çıkarma → chunking (512 token / 50 overlap) →
embedding → ChromaDB. Soru → embedding → `user_id` filtreli top-5 semantik arama
→ RAG prompt → lokal LLM → kaynaklı cevap. Bağlam yoksa LLM çağrılmadan
deterministik `NO_ANSWER` döner.

Detaylı mimari: [README_final.md](README_final.md).

## 3. Tamamlanan İş (haftalık)

| Hafta | Çıktı |
|---|---|
| 1 | FastAPI + Next.js iskeleti, JWT auth, korumalı dosya yükleme, metin çıkarma |
| 2 | Async işleme (BackgroundTasks), chunking, kullanıcı bazlı doküman yönetimi |
| 3 | Embedding + ChromaDB (kullanıcı izolasyonlu), `/search`, PG↔Chroma tutarlılık, reindex |
| 4 | LM Studio entegrasyonu, RAG prompt, `/chat/ask`, kaynaklı cevap, NO_ANSWER |
| 5 | RBAC (`require_admin`), admin endpoint'leri, web admin paneli |
| 6 | Web arayüzü tamamlama, hata yönetimi, durum göstergeleri, 404 sayfası |
| 7 | **Ground truth seti, metrik ölçüm araçları, auth/E2E testleri, demo, README** |

## 4. Hafta 7 — Test ve Metrik Ölçümü

### 4.1 Ground Truth Test Seti

`evaluation/ground_truth.json` — `ÖrnekPDFLER/` içindeki dört YÖK/PAÜ yönetmeliğine
dayalı **15 pozitif + 6 negatif = 21 soru**.

- **Pozitif sorular**: cevabı dokümanlarda olan, beklenen kaynak doküman ve sayfa
  numarası işaretli sorular (örn. *"Sınavlarda kopya çekmek hangi disiplin
  cezasını gerektirir?"* → bir yarıyıl uzaklaştırma).
- **Negatif sorular**: cevabı dokümanlarda **olmayan** sorular (örn. *"Üniversite
  yemekhanesinde öğle yemeği ücreti ne kadardır?"*). Doğru davranış: `NO_ANSWER`.

### 4.2 Metrik Araçları

| Araç | Ölçtüğü | LLM gerekir mi? |
|---|---|---|
| `evaluation/run_eval.py` | Recall@5, MRR + eşik (RETRIEVAL_MIN_SCORE) kalibrasyonu | Hayır |
| `evaluation/run_answer_eval.py` | Source Accuracy, No Hallucination Rate | **Evet** |

Her iki araç da gerçek üretim hattını (`retrieval_service` / `llm_service`)
kullanır; sonuçları `evaluation/results.json` ve `evaluation/answer_results.json`
dosyalarına yazar.

### 4.3 Metrik Tanımları ve Hedefler

| Metrik | Tanım | Hedef |
|---|---|---|
| Recall@5 | Beklenen kaynak ilk 5 sonuçta mı? | ≥ %70 |
| MRR | Beklenen kaynağın sırasının tersi (1/rank) ortalaması | ≥ 0.50 |
| Source Accuracy | Cevap doğru kaynağa dayandırılmış mı? (pozitif) | ≥ %80 |
| No Hallucination Rate | Negatif sorularda NO_ANSWER dönme oranı | ≥ %80 |

### 4.4 Sonuçlar

Ölçüm, `ÖrnekPDFLER/` içindeki dört PDF `user@example.com` hesabına yüklenip
`ready` duruma getirildikten sonra yapıldı (21 soru: 15 pozitif + 6 negatif).
İyileştirme iki adımda yapıldı: (1) retrieval derinliği `top_k` 5→8; (2) embedding
modeli `paraphrase-multilingual-MiniLM-L12-v2` (384 boyut) → **`BAAI/bge-m3`
(1024 boyut)**. Nihai konfigürasyon: `top_k=8`, `bge-m3`.

| Metrik | MiniLM, k=5 | MiniLM, k=8 | **bge-m3, k=8 (nihai)** | Hedef | Durum |
|---|---|---|---|---|---|
| Recall@k | %80.0 | %93.3 | **%100** (15/15) | ≥ %70 | ✅ |
| MRR | 0.6833 | 0.7056 | **0.8778** | ≥ 0.50 | ✅ |
| Source Accuracy | %73.3 | %93.3 | **%100** (15/15) | ≥ %80 | ✅ |
| No Hallucination Rate | %100 | %100 | **%100** (6/6) | ≥ %80 | ✅ |

Retrieval çıktısı `evaluation/results.json`, cevap kalitesi çıktısı
`evaluation/answer_results.json` içindedir (LLM: `google/gemma-4-e4b`).
**Dört metrik de hedefin oldukça üzerinde:** 15 pozitif sorunun tamamı doğru
kaynağa dayandırıldı, 6 negatif sorunun tamamı `NO_ANSWER` döndü.

**Bulgular:**
- **bge-m3 #8'i çözdü:** "Dikey geçiş kontenjanı en az ne kadar" sorusunda Dikey
  dokümanının kontenjan chunk'ı, MiniLM ile #20 (skor 0.31) iken bge-m3 ile **#3'e
  (skor 0.65)** çıktı. Böylece Recall %93.3→%100, MRR 0.71→0.88 oldu. bge-m3'ün
  Türkçe ve yakın bağlamları ayırt etme gücü belirgin biçimde daha yüksek.
- **`top_k` 5→8 etkisi (MiniLM):** Recall %80→%93.3, Source Accuracy %73.3→%93.3;
  ayrıca top_k=5'teki tek LLM over-refusal (#5) düzelmişti.
- **Source Accuracy %100 / No Hallucination Rate %100 (bge-m3):** 15 pozitif
  sorunun tamamı doğru kaynağa dayandırıldı; 6 negatif sorunun tamamında model
  `NO_ANSWER` döndü. Varsayılan eşikte (`RETRIEVAL_MIN_SCORE=0.0`) retrieval
  negatifleri elemediği halde **LLM'in RAG prompt kuralıyla bilgi uydurmaması**
  dikkat çekici — hallucination iki katmanda da kontrol altında.
- **Eşik kalibrasyonu:** Eşik taraması bge-m3 ile de `RETRIEVAL_MIN_SCORE=0.5`
  öneriyor (pozitif Recall'ı düşürmeden negatif retrieval reddini artırır).
- **Not:** `user@example.com` hesabında disiplin yönetmeliğinin iki kopyası var
  (önceden yüklü tarihli sürüm + örnek set sürümü).

Çalıştırma:
```bash
python evaluation/run_eval.py --user user@example.com          # Recall@k, MRR
python evaluation/run_answer_eval.py --user user@example.com   # Source Acc., No Hallucination
```

### 4.5 Otomatik Testler

`cd backend && pytest -q` → **85 test geçiyor**. Kapsam:

- Birim: chunker, text_extractor, embedding/vector_store, retrieval, llm_service
- API/Yetkilendirme: token yok → 401, geçersiz/expired token → 401, **başka
  kullanıcının dokümanı → 404**, admin olmayan `/admin/*` → 403, pasif kullanıcı
  → 403, NO_ANSWER kısa devresi, alt servis hataları → 503

## 5. Güvenlik

- Şifreler bcrypt ile hash'lenir; JWT secret yalnızca `.env`'de tutulur.
- Yetki kontrolü merkezi dependency'lerde (`get_current_user`, `require_admin`).
- Dosya doğrulama: uzantı, magic byte, boyut sınırı, dosya adı sanitize, path
  traversal engeli, boş/bozuk dosya reddi.
- Çok kullanıcılı izolasyon hem PostgreSQL (`user_id` filtre) hem ChromaDB
  (`where` filtre) katmanında uygulanır.

## 6. Bilinen Sınırlar / Notlar

- `RETRIEVAL_MIN_SCORE` varsayılanı `0.0`. Negatif soruların retrieval seviyesinde
  reddedilmesi için `run_eval.py` eşik taramasıyla kalibre edilip `.env`'e
  yazılmalıdır (No Hallucination'ı güçlendirir). Bu olmadan da boş bağlam →
  NO_ANSWER kısa devresi çalışır.
- Türkçe retrieval kalitesi embedding modeline bağlı. Başlangıçtaki
  `paraphrase-multilingual-MiniLM-L12-v2` (384 boyut) yerine **`BAAI/bge-m3`
  (1024 boyut)** kullanıldı; Recall %93.3→%100, MRR 0.71→0.88 oldu. bge-m3 daha
  ağır (~2.3GB indirme, daha çok RAM/CPU) olduğundan donanımı kısıtlı ortamlarda
  MiniLM hâlâ makul bir alternatiftir.
- Cevap tamlığı (Answer Completeness) manuel değerlendirilir; `answer_results.json`
  her cevabın metnini ve anahtar-kelime örtüşmesini içerir.

## 7. Demo

Adım adım demo akışı ve uçtan uca test kontrol listesi: [DEMO.md](DEMO.md).
