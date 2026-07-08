"""`SlidingWindowRateLimiter` birim testleri.

Özellikle atomik `hit()` davranışı doğrulanır: kontrol + kayıt tek kilit
altında yapılır; `is_allowed` + `record` ikilisinin eş zamanlı isteklerde
limit üstüne taşma açığı bu yolla kapatılır (chat/register/upload/search
uçları `hit()` kullanır).
"""

import threading

from app.utils.rate_limit import SlidingWindowRateLimiter


def test_hit_allows_until_limit_then_denies():
    limiter = SlidingWindowRateLimiter()
    assert limiter.hit("k", limit=2, window_seconds=60) is True
    assert limiter.hit("k", limit=2, window_seconds=60) is True
    assert limiter.hit("k", limit=2, window_seconds=60) is False


def test_hit_denied_attempts_do_not_extend_window(monkeypatch):
    """Reddedilen denemeler kaydedilmez; pencere dolunca izin geri gelir."""
    import app.utils.rate_limit as rl

    fake_now = [1000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: fake_now[0])

    limiter = SlidingWindowRateLimiter()
    assert limiter.hit("k", limit=1, window_seconds=10) is True
    # Limit doluyken yapılan denemeler reddedilir ama SAYILMAZ.
    for _ in range(5):
        assert limiter.hit("k", limit=1, window_seconds=10) is False

    # Pencere geçince (ilk kayıt düşünce) tekrar izin verilir.
    fake_now[0] += 10.1
    assert limiter.hit("k", limit=1, window_seconds=10) is True


def test_hit_is_atomic_under_concurrency():
    """N eş zamanlı thread'de izin sayısı asla limiti aşmaz."""
    limiter = SlidingWindowRateLimiter()
    limit = 5
    allowed = []
    barrier = threading.Barrier(20)

    def worker():
        barrier.wait()
        if limiter.hit("k", limit=limit, window_seconds=60):
            allowed.append(1)

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(allowed) == limit


def test_reset_clears_key():
    limiter = SlidingWindowRateLimiter()
    assert limiter.hit("k", limit=1, window_seconds=60) is True
    assert limiter.hit("k", limit=1, window_seconds=60) is False
    limiter.reset("k")
    assert limiter.hit("k", limit=1, window_seconds=60) is True


def test_keys_are_independent():
    limiter = SlidingWindowRateLimiter()
    assert limiter.hit("a", limit=1, window_seconds=60) is True
    assert limiter.hit("b", limit=1, window_seconds=60) is True
    assert limiter.hit("a", limit=1, window_seconds=60) is False


def test_emptied_key_is_evicted_on_touch(monkeypatch):
    """Penceresi boşalan anahtar, tekrar dokunulduğunda sözlükten düşer."""
    import app.utils.rate_limit as rl

    fake_now = [1000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: fake_now[0])

    limiter = SlidingWindowRateLimiter()
    assert limiter.hit("k", limit=5, window_seconds=10) is True
    assert "k" in limiter._events

    fake_now[0] += 10.1
    assert limiter.is_allowed("k", limit=5, window_seconds=10) is True
    assert "k" not in limiter._events


def test_one_shot_keys_are_swept_periodically(monkeypatch):
    """Bir kez kullanılıp bırakılan anahtarlar süpürmeyle temizlenir.

    Anahtarlar istemci kontrollüdür (örn. `login:{ip}:{email}` içindeki
    e-posta): rastgele anahtarlarla yapılan tek seferlik denemeler süresiz
    birikirse bellek sınırsız büyür (yavaş bellek DoS). Süpürme, pencere +
    süpürme aralığı dışında kalan tüm kayıtları düşürmelidir.
    """
    import app.utils.rate_limit as rl

    fake_now = [1000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: fake_now[0])

    limiter = SlidingWindowRateLimiter()
    for i in range(50):
        limiter.record(f"login:1.2.3.4:rastgele{i}@x.com", window_seconds=10)
    assert len(limiter._events) == 50

    # Pencere VE süpürme aralığı geçtikten sonra herhangi bir anahtara gelen
    # tek bir istek, eski anahtarların tamamını temizlemelidir.
    fake_now[0] += rl._SWEEP_INTERVAL_SECONDS + 10.1
    assert limiter.hit("baska-anahtar", limit=5, window_seconds=10) is True
    assert set(limiter._events) == {"baska-anahtar"}
