"""Basit bellek içi rate limiter (brute-force / kaynak tüketimi MVP koruması).

`/auth/login`, `/auth/register`, chat, upload ve search uçlarını kaba kuvvet
ve kaynak tüketimi denemelerine karşı korur. Kayan pencere (sliding window)
yaklaşımı kullanılır: her anahtar için son `window_seconds` içindeki olay
zamanları tutulur.

Sınırlamalar (bilinçli MVP tercihi, yeni bağımlılık eklememek için):
- Süreç içi (in-memory) çalışır; birden fazla worker/instance'ta sayaçlar
  paylaşılmaz. Tek uvicorn süreciyle çalışan bu lokal proje için yeterlidir.
- Anahtar üretimi çağırana bırakılır (örn. `login:{ip}:{email}`).
"""

from __future__ import annotations

import threading
import time
from collections import deque


class SlidingWindowRateLimiter:
    """Anahtar başına kayan pencerede olay sayan, thread-safe limiter."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, window_seconds: float, now: float) -> deque[float]:
        events = self._events.setdefault(key, deque())
        cutoff = now - window_seconds
        while events and events[0] <= cutoff:
            events.popleft()
        return events

    def is_allowed(self, key: str, limit: int, window_seconds: float) -> bool:
        """Pencere içindeki olay sayısı limitin altındaysa True döner."""
        now = time.monotonic()
        with self._lock:
            events = self._prune(key, window_seconds, now)
            return len(events) < limit

    def hit(self, key: str, limit: int, window_seconds: float) -> bool:
        """Limiti kontrol eder ve izin veriliyorsa denemeyi ATOMİK kaydeder.

        `is_allowed` + `record` ikilisi iki ayrı kilit aldığı için eş zamanlı
        isteklerde limitin üstüne taşabilir; her denemenin sayılması gereken
        uçlar (chat/register/upload/search) bu tek-kilit sürümü kullanmalıdır.
        Reddedilen denemeler pencereyi uzatmaz (kaydedilmez).
        """
        now = time.monotonic()
        with self._lock:
            events = self._prune(key, window_seconds, now)
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    def record(self, key: str, window_seconds: float) -> None:
        """Anahtar için yeni bir olay (deneme) kaydeder."""
        now = time.monotonic()
        with self._lock:
            events = self._prune(key, window_seconds, now)
            events.append(now)

    def reset(self, key: str) -> None:
        """Anahtarın sayacını sıfırlar (örn. başarılı giriş sonrası)."""
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        """Tüm sayaçları temizler (test yardımcıları için)."""
        with self._lock:
            self._events.clear()


# Uygulama genelinde paylaşılan tekil limiter.
rate_limiter = SlidingWindowRateLimiter()
