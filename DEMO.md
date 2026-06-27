# LocalDoc AI — Demo Senaryosu ve Uçtan Uca Test (Hafta 7)

Bu belge, projeyi sıfırdan ayağa kaldırıp uçtan uca göstermek için adım adım bir
demo akışı ve manuel uçtan uca (E2E) web test kontrol listesi sağlar. Mimari ve
ayrıntılar için bkz. [README_final.md](README_final.md).

Demo, `ÖrnekPDFLER/` klasöründeki dört YÖK/PAÜ yönetmeliğini kullanır:

| Dosya (yükleme adı sanitize edilince) | İçerik |
|---|---|
| `Dikey_Gecis_Yonetmeligi_YOK_.pdf` | Dikey geçiş (DGS) yönetmeliği |
| `Yatay_Gecis_Yonetmeligi_YOK_-_18.03.2016_degisiklikleri_ile_.pdf` | Yatay geçiş, ÇAP, yandal |
| `PAU_Onlisans_Lisans_Egitim_ve_Ogretim_Yonetmeligi_03.01.2017_.pdf` | PAÜ önlisans/lisans eğitim-öğretim |
| `Yuksekogretim_Kurumlar_Ogrenci_Disiplin_Yonetmeligi.pdf` | Öğrenci disiplin yönetmeliği |

> Not: Yükleme sırasında dosya adı ASCII'ye sanitize edilir (Türkçe karakterler
> sadeleşir, boşluk/özel karakterler `_` olur). Yukarıdaki sağ sütun, sistemde
> saklanan ve kaynak panelinde görünen addır; `evaluation/ground_truth.json`
> içindeki `expected_source_doc` değerleri bu adlarla birebir eşleşir.

---

## 1. Önkoşullar

- **PostgreSQL** çalışıyor ve `.env` içindeki `DATABASE_URL` ile erişilebilir.
- **LM Studio** açık, bir instruct model yüklü ve local server başlatılmış
  (`.env` → `LLM_API_URL=http://localhost:1234/v1`, `LLM_MODEL_NAME`).
  *LLM kapalıyken doküman yükleme/arama çalışır; yalnızca `/chat/ask` cevabı 503 döner.*
- Embedding modeli (`BAAI/bge-m3`, ~2.3GB) ilk çalıştırmada otomatik indirilir;
  embedding boyutu 1024'tür.
- Python 3.14+ ve Node/bun (frontend için).

## 2. Çalıştırma

```bash
# Backend (repo kökünden)
cd backend
.venv/Scripts/activate           # Windows;  source .venv/bin/activate  (Linux/macOS)
uvicorn app.main:app --reload    # http://localhost:8000  (Swagger: /docs)

# Frontend (ayrı terminal)
cd frontend
bun install                      # ilk kez
bun run dev                      # http://localhost:3000
```

İlk başlatmada `.env` içindeki `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`
ile bir **admin** kullanıcı otomatik oluşturulur (seed).

| Rol | E-posta | Şifre |
|---|---|---|
| admin | `admin@localdoc.ai` | `.env` → `DEFAULT_ADMIN_PASSWORD` |
| user | demoda kayıt ile oluşturulur | — |

---

## 3. Demo Akışı (web arayüzü)

1. **Kayıt / Giriş** — `http://localhost:3000/register` üzerinden yeni bir
   kullanıcı (`demo@ornek.com`) oluşturun, ardından giriş yapın. JWT saklanır ve
   sonraki isteklerde `Authorization: Bearer` ile gönderilir.
2. **Doküman yükleme** — `Upload` ekranından `ÖrnekPDFLER/` içindeki dört PDF'i
   yükleyin. Her doküman `uploaded → processing → ready` durumlarından geçer.
3. **İşleme takibi** — `Documents` ekranında durum rozetlerinin `ready` olmasını
   bekleyin (chunk sayıları görünür).
4. **Soru-cevap (pozitif)** — `Chat` ekranında örnek sorular sorun:
   - "Sınavlarda kopya çekmek hangi disiplin cezasını gerektirir?"
     → *bir yarıyıl uzaklaştırma*; kaynak: disiplin yönetmeliği.
   - "Dikey geçiş sınavı kılavuzunu hangi kurum hazırlar?" → *ÖSYM*.
   - "Lisans programları için azami öğrenim süresi kaç yıldır?" → *yedi yıl*.
   Cevabın altında **kaynak paneli** (doküman adı + sayfa + skor) görünmelidir.
5. **Soru-cevap (negatif)** — Dokümanlarda olmayan bir soru sorun:
   - "Üniversite yemekhanesinde öğle yemeği ücreti ne kadardır?"
   Beklenen: **"Bu bilgi yüklenen dokümanda bulunamadı."** (kaynak yok, uydurma yok).
6. **Çok kullanıcılı izolasyon** — İkinci bir kullanıcıyla giriş yapıp kendi
   dokümanı olmadığını ve diğer kullanıcının dokümanlarını göremediğini gösterin.
7. **Admin paneli** — `admin@localdoc.ai` ile giriş yapın; `Admin` ekranında tüm
   kullanıcılar, tüm dokümanlar ve istatistikler görünür. Bir kullanıcıyı
   pasifleştirip o kullanıcının artık giriş yapamadığını gösterin.

---

## 4. Manuel Uçtan Uca (E2E) Test Kontrol Listesi

README "Uçtan Uca Test Senaryoları" tablosuyla eşleşir. Her satır web arayüzünde
(veya `/docs` üzerinden) doğrulanır.

| # | Senaryo | Beklenen | ✓ |
|---|---|---|:--:|
| 1 | Kayıt ol → giriş yap | Geçerli JWT döner, panele girilir | ☐ |
| 2 | Token olmadan doküman yükle/listele | `401` | ☐ |
| 3 | Geçersiz/expired token ile istek | `401` | ☐ |
| 4 | Başka kullanıcının dokümanını sorgula/sil | `404` | ☐ |
| 5 | Admin tüm dokümanları listele | Tüm kullanıcıların dokümanları | ☐ |
| 6 | Admin olmayan `/admin/*` erişimi | `403` | ☐ |
| 7 | Admin kullanıcıyı pasifleştir → o kullanıcı giriş | Giriş reddedilir (`403`) | ☐ |
| 8 | PDF yükle → soru sor | Doğru cevap + kaynak paneli | ☐ |
| 9 | Dokümanda olmayan soru | `Bu bilgi yüklenen dokümanda bulunamadı.` | ☐ |
| 10 | İki doküman yükle → soru sor | Doğru dokümandan kaynak | ☐ |
| 11 | Doküman sil → aynı soruyu sor | Silinen dokümandan sonuç dönmez | ☐ |
| 12 | LLM kapalıyken soru sor | Açıklayıcı hata (`503`) | ☐ |
| 13 | Bozuk/çok büyük dosya yükle | Reddedilir / `error` durumu | ☐ |

> 2, 3, 4, 6, 7 numaralı satırlar ayrıca otomatik testlerle de kapsanır:
> `backend/tests/test_documents_api.py`, `test_admin_api.py`, `test_chat_api.py`,
> `test_search_api.py`.

---

## 5. Metrik Ölçümü

Detaylar: [evaluation/README.md](evaluation/README.md).

```bash
# Retrieval metrikleri (Recall@5, MRR) + eşik kalibrasyonu — LLM gerektirmez
python evaluation/run_eval.py --user demo@ornek.com

# Cevap kalitesi (Source Accuracy + No Hallucination Rate) — LM Studio gerektirir
python evaluation/run_answer_eval.py --user demo@ornek.com
```

Önkoşul: Dört örnek PDF, `--user` ile verilen hesapla yüklenmiş ve `ready`
durumda olmalıdır. Sonuçlar `evaluation/results.json` ve
`evaluation/answer_results.json` dosyalarına yazılır.
