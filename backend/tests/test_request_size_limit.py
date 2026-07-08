"""`app.main` istek gövdesi boyut sınırı (Content-Length) testleri.

Alan bazlı uzunluk sınırları (örn. `question` max 2000) gövde tamamen okunup
ayrıştırıldıktan SONRA çalışır; aşırı büyük bir JSON gövdesi bu noktaya
gelmeden belleği tüketebilir. Middleware, `Content-Length` başlığı sınırı
aşıyorsa isteği gövdeyi hiç okumadan `413` ile reddeder.

Not: `TestClient` context manager olmadan kullanılır; lifespan (DB seed vb.)
çalışmaz. Middleware routing'den önce koştuğu için DB'ye hiç gidilmez.
"""

from fastapi.testclient import TestClient

import app.main as main
from app.config import settings


def test_oversized_body_rejected_with_413(monkeypatch):
    # Sınırı test için küçült: dosya limiti 0 MB + 1 KB pay = 1024 byte.
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 0)
    monkeypatch.setattr(main, "_REQUEST_BODY_MARGIN_BYTES", 1024)

    client = TestClient(main.app)
    res = client.post(
        "/auth/login",
        content=b"x" * 4096,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 413


def test_normal_request_passes_size_limit_middleware():
    client = TestClient(main.app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_body_within_limit_reaches_route(monkeypatch):
    # Sınırın altındaki gövde middleware'i geçip normal akışa ulaşmalı
    # (login geçersiz JSON gövdesiyle 422 döner; 413 DEĞİL).
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 0)
    monkeypatch.setattr(main, "_REQUEST_BODY_MARGIN_BYTES", 1024)

    client = TestClient(main.app)
    res = client.post(
        "/auth/login",
        content=b"{}",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422
