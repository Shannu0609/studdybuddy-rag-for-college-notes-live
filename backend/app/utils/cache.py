import json
import logging
import time
from typing import Any, Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


class CacheBackend:
    """Optional Redis cache with an automatic in-memory TTL fallback."""

    def __init__(self) -> None:
        self._redis = None
        self._memory: dict[str, tuple[float, str]] = {}
        settings = get_settings()
        if settings.REDIS_URL:
            try:
                import redis  # type: ignore

                client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
                client.ping()
                self._redis = client
                logger.info("Connected to Redis cache.")
            except Exception as exc:
                logger.warning("Redis unavailable (%s); using in-memory fallback.", exc)

    def get_json(self, key: str) -> Optional[Any]:
        if self._redis is not None:
            raw = self._redis.get(key)
            return json.loads(raw) if raw else None

        entry = self._memory.get(key)
        if not entry:
            return None
        expires_at, raw = entry
        if expires_at < time.monotonic():
            self._memory.pop(key, None)
            return None
        return json.loads(raw)

    def set_json(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        raw = json.dumps(value)
        if self._redis is not None:
            self._redis.setex(key, ttl_seconds, raw)
            return

        if len(self._memory) > 256:
            self._memory.clear()
        self._memory[key] = (time.monotonic() + ttl_seconds, raw)

    def delete_prefix(self, prefix: str) -> None:
        if self._redis is not None:
            for k in self._redis.scan_iter(match=f"{prefix}*"):
                self._redis.delete(k)
            return

        keys_to_remove = [k for k in self._memory if k.startswith(prefix)]
        for k in keys_to_remove:
            self._memory.pop(k, None)


_cache_instance: Optional[CacheBackend] = None


def get_cache() -> CacheBackend:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = CacheBackend()
    return _cache_instance

