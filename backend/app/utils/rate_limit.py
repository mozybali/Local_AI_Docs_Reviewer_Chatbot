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


# Periyodik süpürme aralığı: bir kez kullanılıp bir daha dokunulmayan
# anahtarlar (örn. rastgele e-postalarla üretilen login anahtarları) ancak
# süpürmeyle temizlenebilir; aksi halde bellek sınırsız büyür.
_SWEEP_INTERVAL_SECONDS = 60.0


class SlidingWindowRateLimiter:
    """Anahtar başına kayan pencerede olay sayan, thread-safe limiter."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()
        # Süpürmede kullanılacak muhafazakâr kesme noktası için görülen en
        # geniş pencere izlenir (her anahtarın kendi penceresi saklanmaz).
        self._max_window_seconds = 0.0

    def _maybe_sweep(self, now: float) -> None:
        """Aralık dolduysa TÜM anahtarlardan kesin süresi geçmiş olayları düşürür.

        Kesme noktası görülen en geniş pencereye göre alınır; hâlâ herhangi bir
        pencereye girebilecek hiçbir olay silinmez. Boşalan anahtarlar
        sözlükten atılır; böylece bellek, "pencere + süpürme aralığı" içinde
        aktif olan anahtar sayısıyla sınırlı kalır.
        """
        if now - self._last_sweep < _SWEEP_INTERVAL_SECONDS:
            return
        cutoff = now - self._max_window_seconds
        for key in list(self._events):
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if not events:
                del self._events[key]
        self._last_sweep = now

    def _prune(self, key: str, window_seconds: float, now: float) -> deque[float]:
        """Anahtarın süresi geçmiş olaylarını temizler; boşalan anahtarı SİLER.

        Anahtarlar istemci kontrollüdür (örn. `login:{ip}:{email}` içindeki
        e-posta): boş kayıtlar sözlükte bırakılırsa saldırgan rastgele
        anahtarlarla sınırsız bellek büyütebilir. Bu yüzden penceresi boşalan
        anahtar sözlükten düşülür; bellek en fazla "pencere içindeki aktif
        anahtar sayısı" kadar büyür.
        """
        if window_seconds > self._max_window_seconds:
            self._max_window_seconds = window_seconds
        self._maybe_sweep(now)
        events = self._events.get(key)
        if events is None:
            return deque()
        cutoff = now - window_seconds
        while events and events[0] <= cutoff:
            events.popleft()
        if not events:
            del self._events[key]
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
            self._events[key] = events
            return True

    def record(self, key: str, window_seconds: float) -> None:
        """Anahtar için yeni bir olay (deneme) kaydeder."""
        now = time.monotonic()
        with self._lock:
            events = self._prune(key, window_seconds, now)
            events.append(now)
            self._events[key] = events

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
