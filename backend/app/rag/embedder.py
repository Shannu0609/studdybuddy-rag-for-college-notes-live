import threading
from typing import TYPE_CHECKING, Optional

from app.config import get_settings

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


class EmbeddingService:
    """Thread-safe singleton wrapper around SentenceTransformer."""

    def __init__(self) -> None:
        self._model: Optional["SentenceTransformer"] = None
        self._lock = threading.Lock()

    def _get_model(self) -> "SentenceTransformer":
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer

                    settings = get_settings()
                    self._model = SentenceTransformer(settings.EMBEDDING_MODEL)
        return self._model

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = self._get_model()
        vectors = model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.tolist()

    def embed_query(self, query: str) -> list[float]:
        model = self._get_model()
        vector = model.encode(
            query,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vector.tolist()


_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service

