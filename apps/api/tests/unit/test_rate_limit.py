from shared.rate_limit import InMemoryRateLimiter


def test_allows_requests_within_the_limit():
    limiter = InMemoryRateLimiter()

    for _ in range(5):
        assert limiter.is_allowed("key", max_requests=5, window_seconds=60) is True


def test_blocks_requests_beyond_the_limit():
    limiter = InMemoryRateLimiter()

    for _ in range(5):
        limiter.is_allowed("key", max_requests=5, window_seconds=60)

    assert limiter.is_allowed("key", max_requests=5, window_seconds=60) is False


def test_different_keys_have_independent_budgets():
    limiter = InMemoryRateLimiter()

    for _ in range(5):
        limiter.is_allowed("key-a", max_requests=5, window_seconds=60)

    assert limiter.is_allowed("key-b", max_requests=5, window_seconds=60) is True


def test_allows_again_after_window_expires(monkeypatch):
    limiter = InMemoryRateLimiter()
    fake_now = [1000.0]
    monkeypatch.setattr("time.monotonic", lambda: fake_now[0])

    for _ in range(3):
        limiter.is_allowed("key", max_requests=3, window_seconds=10)
    assert limiter.is_allowed("key", max_requests=3, window_seconds=10) is False

    fake_now[0] += 11
    assert limiter.is_allowed("key", max_requests=3, window_seconds=10) is True
