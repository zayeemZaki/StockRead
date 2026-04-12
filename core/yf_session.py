"""
Shared yfinance HTTP session with request caching and rate limiting.

This module provides a single CachedLimiterSession that is injected into
every yfinance call across the application to:

  - Prevent Yahoo Finance HTTP 429 (Too Many Requests) errors by capping
    outbound requests to 2 per second across the whole process.
  - Reduce redundant network round-trips by caching responses for 1 hour
    in-process (no disk I/O, ephemeral storage safe for Render).
  - Enforce a per-request timeout so a hung Yahoo Finance connection cannot
    stack up background threads and leak Render memory.

Usage
-----
    from core.yf_session import get_yf_session

    session = get_yf_session()
    stock = yf.Ticker("AAPL", session=session)
    df    = yf.download(tickers, session=session, threads=False)
"""

import logging
from requests.adapters import HTTPAdapter
from requests_cache import CachedSession
from requests_ratelimiter import LimiterMixin

logger = logging.getLogger(__name__)

# Hard ceiling on how long a single Yahoo Finance request may take.
# If Yahoo is slow or unresponsive this prevents threads from hanging
# indefinitely and stacking up inside Render's memory budget.
_REQUEST_TIMEOUT_SECONDS = 30


class _TimeoutHTTPAdapter(HTTPAdapter):
    """HTTPAdapter that injects a default timeout on every request."""

    def send(self, request, **kwargs):  # type: ignore[override]
        kwargs.setdefault("timeout", _REQUEST_TIMEOUT_SECONDS)
        return super().send(request, **kwargs)


class CachedLimiterSession(LimiterMixin, CachedSession):
    """requests.Session with built-in per-second rate limiting and HTTP caching.

    MRO: LimiterMixin → CachedSession → requests.Session
    LimiterMixin must come first so its ``send`` wraps CachedSession's ``send``.
    """


_session: "CachedLimiterSession | None" = None


def get_yf_session() -> CachedLimiterSession:
    """Return (or lazily create) the process-wide shared yfinance session.

    The session is a module-level singleton so all services share the same
    rate-limit bucket and cache, keeping total outbound Yahoo Finance traffic
    well below their per-IP threshold.
    """
    global _session
    if _session is None:
        _session = CachedLimiterSession(
            # Rate-limiting (requests_ratelimiter)
            per_second=2,
            # HTTP caching (requests_cache)
            cache_name="yf_http_cache",
            backend="memory",   # in-process; no ephemeral disk churn on Render
            expire_after=3600,  # 1-hour cache TTL
        )
        # Attach the timeout adapter for both http and https
        adapter = _TimeoutHTTPAdapter()
        _session.mount("https://", adapter)
        _session.mount("http://", adapter)

        logger.info(
            "yfinance HTTP session ready "
            "(rate=2 req/s, cache=memory, ttl=1 h, timeout=%d s)",
            _REQUEST_TIMEOUT_SECONDS,
        )

    return _session
