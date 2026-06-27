# Retrieval Değerlendirme + Eşik Kalibrasyonu

Bu klasör iki işi yapan araçları içerir:

1. **Pozitif retrieval** kalitesini ölçmek — README'deki *"10 manuel test
   sorusundan en az 7'sinde doğru kaynak ilk 5 sonuç içinde olmalı"*
   (Recall@5 ≥ %70) kabul kriteri.
2. **`RETRIEVAL_MIN_SCORE` eşiğini kalibre etmek** — negatif (cevabı dokümanlarda
   olmayan) sorularda hallucination'ı kesecek eşiği veriyle seçmek (Hafta 4).

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `ground_truth.example.json` | Pozitif + negatif soru şablonu (kopyalanacak örnek). |
| `ground_truth.json` | Gerçek test seti. **Siz doldurursunuz** (pozitif + negatif sorular). |
| `run_eval.py` | Soruları gerçek retrieval hattından geçirir; Recall@k, MRR ve eşik taraması üretir. |
| `results.json` | Runner'ın yazdığı koşu sonuçları (`runs` listesine eklenir; `sweep` dahil). |
| `run_answer_eval.py` | Uçtan uca RAG (retrieval + LLM) çalıştırır; Source Accuracy + No Hallucination Rate üretir. **LM Studio gerektirir.** |
| `answer_results.json` | `run_answer_eval.py`'nin yazdığı cevap kalitesi sonuçları (her cevabın metni dahil). |

## Cevap kalitesi metrikleri (Hafta 7)

`run_eval.py` yalnızca **retrieval** katmanını ölçer. Cevap (LLM) katmanı için:

```bash
python evaluation/run_answer_eval.py --user user@example.com
```

- **Source Accuracy** (≥ %80): Pozitif sorularda model gerçek bir cevap üretmiş ve
  gösterdiği kaynaklar arasında `expected_source_doc` var mı?
- **No Hallucination Rate** (≥ %80): Negatif sorularda model `NO_ANSWER` mı döndürüyor?
- **Answer Completeness**: manuel; `answer_results.json` içindeki cevap metinleri ve
  anahtar-kelime örtüşmesi ipucu üzerinden değerlendirilir.

> Önkoşul: dört örnek PDF `--user` hesabıyla yüklü ve `ready`, ayrıca LM Studio
> local server açık olmalı.

## Pozitif ve negatif sorular

```json
{
  "id": 1,
  "question": "Yıllık izin kaç gün önce talep edilmelidir?",
  "expected_source_doc": "personel_yonetmeligi.pdf",
  "expected_page": 4
}
```

- **Pozitif soru:** `expected_source_doc` doludur (dokümanın **orijinal dosya
  adı**). Beklenen kaynak ilk k sonuç içinde gelirse "hit" sayılır. `expected_page`
  opsiyoneldir (Recall doküman adına göre hesaplanır).
- **Negatif soru:** Cevabı dokümanlarda **olmayan** sorudur. İşaretlemek için
  `expected_source_doc: null` bırakın **veya** `"negative": true` ekleyin. Doğru
  davranış: eşik uygulandıktan sonra retrieval'ın **boş** dönmesi → deterministik
  `NO_ANSWER` (LLM hiç çağrılmaz).

> Kalibrasyon için en az birkaç negatif soru ekleyin; aksi halde eşik taraması
> red oranını ölçemez ve öneri üretmez.

## Adımlar

1. **Demo dokümanlarını yükleyin.** Değerlendirmeyi yapacağınız kullanıcı
   hesabıyla giriş yapıp (en az 3) doküman yükleyin ve durumlarının `ready`
   olmasını bekleyin. Retrieval, PostgreSQL'deki chunk'lar + ChromaDB'deki
   vektörler üzerinden çalışır; doküman işlenmemişse skorlar 0 çıkar.

2. **`ground_truth.json` dosyasını doldurun.** Şablonu kopyalayın ve gerçek
   dokümanlarınıza göre düzenleyin (pozitif + negatif):

   ```bash
   cp evaluation/ground_truth.example.json evaluation/ground_truth.json
   ```

3. **Runner'ı çalıştırın** (backend sanal ortamı aktifken, repo kökünden):

   ```bash
   python evaluation/run_eval.py --user user@example.com
   # opsiyonel:
   #   --top-k 5
   #   --thresholds 0.0,0.1,0.2,0.3,0.4,0.5
   #   --ground-truth ...  --output ...
   ```

   Çıktı; her soru için bulunan sırayı (negatiflerde RED/SIZDI), **eşik taraması
   tablosunu** ve özet metrikleri yazdırır. Recall@5 hedefin (%70) altındaysa
   süreç non-zero kodla çıkar (otomasyon/CI için).

## Eşik kalibrasyonu (RETRIEVAL_MIN_SCORE)

`RETRIEVAL_MIN_SCORE` kosinüs benzerlik skoru eşiğidir (`1.0` = en benzer). Bu
değerin altındaki eşleşmeler bağlama alınmaz; hiçbiri kalmazsa retrieval boş
döner ve cevap deterministik `NO_ANSWER` olur.

Runner her soru için **ham (eşiksiz) top-k skorları** bir kez toplar, sonra aday
eşikler için metrikleri bellek içinde yeniden hesaplar. Tablo şöyle okunur:

```
Eşik taraması (RETRIEVAL_MIN_SCORE kalibrasyonu):
    eşik   Recall@k      MRR   Negatif red
    0.00     85.7%    0.7321        0.0%
    0.20     85.7%    0.7321       40.0%
    0.30     85.7%    0.7100       80.0%
    0.40     71.4%    0.6000      100.0%
    0.50     42.9%    0.3500      100.0%

>> Önerilen RETRIEVAL_MIN_SCORE = 0.4
```

- **Recall@k** yükseldikçe eşikle düşmemeli (gerçek cevapları elememeli).
- **Negatif red** yükseldikçe artmalı (alakasız soruları daha çok elemeli).
- Doğru eşik bu ikisinin **diz noktasıdır**: Recall hedefini (%70) koruyup
  negatif reddi en yükseğe çıkaran değer. Runner bunu `recommended_min_score`
  olarak önerir.

Önerilen değeri `backend/.env` içindeki `RETRIEVAL_MIN_SCORE`'a yazıp yeniden
ölçün. Eşik embedding modeline ve korpusa bağlıdır; veri değişince yeniden
kalibre edin.

## Hedefler (README "Performans Metrikleri")

| Metrik | Hedef |
|---|---|
| Recall@5 | ≥ %70 |
| MRR | ≥ 0.50 |
| Negatif red oranı | Mümkün olduğunca yüksek (Recall'ı düşürmeden) |
