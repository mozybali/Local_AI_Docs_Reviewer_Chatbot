"""Süreç içi doküman işleme kuyruğu.

Doküman işleme (metin çıkarma + OCR + embedding) CPU-yoğundur. FastAPI
`BackgroundTasks` görevleri istek worker'larında koşturur; aynı anda birden çok
yükleme geldiğinde OCR/embedding işleri istek işleyicileriyle CPU için yarışır
ve sunucu yanıt veremez hale gelebilir. Bu modül, işleri TEK bir adanmış worker
thread'inde SERİ olarak çalıştıran hafif bir kuyruk sağlar:

- Upload isteği yalnızca `enqueue(document_id)` çağırır ve hemen döner.
- Worker daemon thread'dir; süreçle birlikte kapanır. Süreç yeniden
  başladığında kuyruk kaybolur; yarıda kalan dokümanlar startup'ta
  `recover_stale_documents` tarafından `error` durumuna alınır ve kullanıcı
  arayüzdeki "Yeniden işle" ile tekrar kuyruğa sokabilir.
- `process_document` idempotent olduğu için aynı dokümanın yanlışlıkla iki kez
  kuyruklanması tutarlılığı bozmaz.

Ek altyapı (Redis/Celery) gerektirmez; tamamen lokal ve ücretsizdir. Çok
instance'lı bir dağıtımda bu kuyruk gerçek bir iş kuyruğuyla (ör. PG tabanlı)
değiştirilmelidir — tek instance MVP varsayımı rate limiter ile aynıdır.
"""

from __future__ import annotations

import logging
import queue
import threading

from app.services.document_processor import process_document

logger = logging.getLogger(__name__)

_queue: "queue.Queue[int]" = queue.Queue()
_worker_lock = threading.Lock()
_worker: threading.Thread | None = None


def _worker_loop() -> None:
    """Kuyruktaki dokümanları sırayla işler; hata tek işi etkiler."""
    while True:
        document_id = _queue.get()
        try:
            process_document(document_id)
        except Exception:
            # process_document kendi hatalarını yakalayıp dokümanı `error`
            # yapar; buraya düşen her şey beklenmeyen bir altyapı hatasıdır.
            logger.exception(
                "Kuyruk işleme hatası: document_id=%s", document_id
            )
        finally:
            _queue.task_done()


def start_worker() -> None:
    """Worker thread'ini (yoksa) başlatır. Idempotent ve thread-safe."""
    global _worker
    with _worker_lock:
        if _worker is not None and _worker.is_alive():
            return
        _worker = threading.Thread(
            target=_worker_loop, name="doc-processing-worker", daemon=True
        )
        _worker.start()
        logger.info("Doküman işleme worker'ı başlatıldı.")


def enqueue(document_id: int) -> None:
    """Bir dokümanı işleme kuyruğuna ekler (worker'ı gerekirse başlatır)."""
    start_worker()
    _queue.put(document_id)
    logger.info(
        "Doküman kuyruğa eklendi: id=%s (bekleyen=%s)",
        document_id,
        _queue.qsize(),
    )


def pending_count() -> int:
    """Kuyrukta bekleyen (yaklaşık) iş sayısını döner (teşhis için)."""
    return _queue.qsize()
