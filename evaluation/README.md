# Retrieval Değerlendirme (Recall@5 / MRR)

Bu klasör, README'deki **"10 manuel test sorusundan en az 7'sinde doğru kaynak
ilk 5 sonuç içinde olmalı"** (Recall@5 ≥ %70) kabul kriterini ölçen araçları
içerir.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `ground_truth.example.json` | Soru/beklenen-kaynak şablonu (kopyalanacak örnek). |
| `ground_truth.json` | Gerçek test seti. **Siz doldurursunuz** (en az 10-15 pozitif soru). |
| `run_eval.py` | Soruları gerçek retrieval hattından geçirir, Recall@k ve MRR hesaplar. |
| `results.json` | Runner'ın yazdığı koşu sonuçları (`runs` listesine eklenir). |

## Kapsam

- **Ölçülen:** Pozitif retrieval — Recall@k ve MRR (Hafta 3 kabul kriteri).
- **Ölçülmeyen (bilinçli):** Negatif soru / hallucination oranı ve cevap
  doğruluğu (Source Accuracy). Bunlar LLM cevap üretimini gerektirir ve
  **Hafta 4/7** kapsamındadır.

## Adımlar

1. **Demo dokümanlarını yükleyin.** Değerlendirmeyi yapacağınız kullanıcı
   hesabıyla giriş yapıp (en az 3) doküman yükleyin ve durumlarının `ready`
   olmasını bekleyin. Retrieval, PostgreSQL'deki chunk'lar + ChromaDB'deki
   vektörler üzerinden çalışır; doküman işlenmemişse skorlar 0 çıkar.

2. **`ground_truth.json` dosyasını doldurun.** Şablonu kopyalayın:

   ```bash
   cp evaluation/ground_truth.example.json evaluation/ground_truth.json
   ```

   Her madde gerçek dokümanlarınıza göre düzenlenir:

   ```json
   {
     "id": 1,
     "question": "Yıllık izin kaç gün önce talep edilmelidir?",
     "expected_source_doc": "personel_yonetmeligi.pdf",
     "expected_page": 4
   }
   ```

   - `expected_source_doc`: dokümanın **orijinal dosya adı** (sistemde göründüğü ad).
   - `expected_page`: opsiyonel; verilirse sonuçta sayfa eşleşmesi de raporlanır
     (Recall hesabı doküman adına göredir).

3. **Runner'ı çalıştırın** (backend sanal ortamı aktifken, repo kökünden):

   ```bash
   python evaluation/run_eval.py --user user@example.com
   # opsiyonel: --top-k 5 --ground-truth ... --output ...
   ```

   Çıktı, her soru için bulunan sırayı ve özet metrikleri yazdırır; ayrıca
   `results.json` içindeki `runs` listesine yeni bir koşu ekler. Recall@5 hedefin
   (%70) altındaysa süreç non-zero kodla çıkar (otomasyon/CI için).

## Hedefler (README "Performans Metrikleri")

| Metrik | Hedef |
|---|---|
| Recall@5 | ≥ %70 |
| MRR | ≥ 0.50 |
