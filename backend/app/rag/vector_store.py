import threading
from dataclasses import dataclass
from typing import Any, Optional

from app.config import get_settings
from app.rag.chunker import TextChunk


@dataclass(frozen=True)
class RetrievedChunk:
    document_id: str
    document_name: str
    page_number: int
    chunk_index: int
    content: str
    similarity_score: float


def _build_where_filter(user_id: str, document_ids: Optional[list[str]] = None) -> dict[str, Any]:
    if not document_ids:
        return {"user_id": user_id}
    if len(document_ids) == 1:
        return {"$and": [{"user_id": user_id}, {"document_id": document_ids[0]}]}
    return {"$and": [{"user_id": user_id}, {"document_id": {"$in": document_ids}}]}


class VectorStoreService:
    """ChromaDB persistent vector store with strict per-user document isolation."""

    COLLECTION_NAME = "study_buddy_notes"

    def __init__(self) -> None:
        self._client = None
        self._collection = None
        self._lock = threading.Lock()

    def _get_collection(self):
        if self._collection is None:
            with self._lock:
                if self._collection is None:
                    import chromadb

                    settings = get_settings()
                    self._client = chromadb.PersistentClient(
                        path=str(settings.resolved_chroma_dir)
                    )
                    self._collection = self._client.get_or_create_collection(
                        name=self.COLLECTION_NAME,
                        metadata={"hnsw:space": "cosine"},
                    )
        return self._collection

    def add_document_chunks(
        self,
        user_id: str,
        document_id: str,
        document_name: str,
        chunks: list[TextChunk],
        embeddings: list[list[float]],
    ) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings count mismatch.")
        if not chunks:
            return

        collection = self._get_collection()
        batch_size = 200
        for start in range(0, len(chunks), batch_size):
            batch_chunks = chunks[start : start + batch_size]
            batch_embeddings = embeddings[start : start + batch_size]
            ids = [f"{document_id}_chunk_{c.chunk_index}" for c in batch_chunks]
            documents = [c.content for c in batch_chunks]
            metadatas = [
                {
                    "user_id": user_id,
                    "document_id": document_id,
                    "document_name": document_name,
                    "page_number": int(c.page_number),
                    "chunk_index": int(c.chunk_index),
                }
                for c in batch_chunks
            ]
            collection.add(
                ids=ids,
                embeddings=batch_embeddings,
                documents=documents,
                metadatas=metadatas,
            )

    def query_chunks(
        self,
        user_id: str,
        query_embedding: list[float],
        document_ids: Optional[list[str]] = None,
        top_k: int = 6,
    ) -> list[RetrievedChunk]:
        collection = self._get_collection()
        where_filter = _build_where_filter(user_id, document_ids)

        existing = collection.get(where=where_filter, include=[])
        available_count = len(existing.get("ids", []))
        if available_count == 0:
            return []

        n_results = min(top_k, available_count)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        dists = results.get("distances", [[]])[0]

        retrieved: list[RetrievedChunk] = []
        for doc_text, meta, dist in zip(docs, metas, dists):
            # Chroma cosine distance = 1 - cosine_similarity
            similarity = max(0.0, min(1.0, float(1.0 - dist)))
            retrieved.append(
                RetrievedChunk(
                    document_id=str(meta.get("document_id", "")),
                    document_name=str(meta.get("document_name", "Unknown PDF")),
                    page_number=int(meta.get("page_number", 1)),
                    chunk_index=int(meta.get("chunk_index", 0)),
                    content=doc_text,
                    similarity_score=round(similarity, 4),
                )
            )
        return retrieved

    def get_representative_chunks(
        self,
        user_id: str,
        document_ids: Optional[list[str]] = None,
        limit: int = 10,
    ) -> list[RetrievedChunk]:
        """Fetch evenly spaced substantive chunks across selected PDFs for summaries and exam prep."""
        collection = self._get_collection()
        where_filter = _build_where_filter(user_id, document_ids)
        data = collection.get(where=where_filter, include=["documents", "metadatas"])

        docs = data.get("documents", [])
        metas = data.get("metadatas", [])
        if not docs:
            return []

        all_paired = list(zip(docs, metas))
        # Prefer substantive chunks (>= 120 chars) so title/cover pages do not crowd out real notes
        substantive = [item for item in all_paired if len(item[0].strip()) >= 120]
        pool = substantive if substantive else all_paired

        # Group by document_id and allocate slots prioritizing larger/study-heavy documents
        by_doc: dict[str, list[tuple[str, dict[str, Any]]]] = {}
        for doc_text, meta in pool:
            did = str(meta.get("document_id", ""))
            by_doc.setdefault(did, []).append((doc_text, meta))

        for did in by_doc:
            by_doc[did].sort(key=lambda item: int(item[1].get("chunk_index", 0)))

        # Sort documents by chunk count descending so full lecture notes take priority over 1-page forms
        doc_groups = sorted(by_doc.values(), key=len, reverse=True)
        selected: list[tuple[str, dict[str, Any]]] = []

        if len(doc_groups) == 1:
            items = doc_groups[0]
            if len(items) <= limit:
                selected = items
            else:
                step = len(items) / limit
                selected = [items[int(i * step)] for i in range(limit)]
        else:
            total_pool = sum(len(g) for g in doc_groups)
            remaining = limit
            for g_idx, group in enumerate(doc_groups):
                if remaining <= 0:
                    break
                if g_idx == len(doc_groups) - 1:
                    alloc = min(len(group), remaining)
                else:
                    share = max(1, round(limit * (len(group) / total_pool)))
                    alloc = min(len(group), share, remaining)
                if len(group) <= alloc:
                    selected.extend(group)
                else:
                    step = len(group) / alloc
                    selected.extend(group[int(i * step)] for i in range(alloc))
                remaining = limit - len(selected)

        return [
            RetrievedChunk(
                document_id=str(meta.get("document_id", "")),
                document_name=str(meta.get("document_name", "Unknown PDF")),
                page_number=int(meta.get("page_number", 1)),
                chunk_index=int(meta.get("chunk_index", 0)),
                content=doc_text,
                similarity_score=0.5,
            )
            for doc_text, meta in selected
        ]

    def delete_document_chunks(self, user_id: str, document_id: str) -> None:
        collection = self._get_collection()
        collection.delete(
            where={"$and": [{"user_id": user_id}, {"document_id": document_id}]}
        )

    def delete_user_chunks(self, user_id: str) -> None:
        collection = self._get_collection()
        collection.delete(where={"user_id": user_id})


_vector_store: Optional[VectorStoreService] = None


def get_vector_store() -> VectorStoreService:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStoreService()
    return _vector_store

