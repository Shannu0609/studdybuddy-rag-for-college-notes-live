import re
from typing import Sequence

from app.config import get_settings
from app.models.schemas import SourceReference
from app.rag.embedder import get_embedding_service
from app.rag.llm_service import get_llm_service
from app.rag.vector_store import RetrievedChunk, get_vector_store

OVERVIEW_PATTERNS = re.compile(
    r"\b(summarize|summary|overview|outline|key\s+points?|key\s+takeaways?|important\s+(exam\s+)?questions?|exam\s+questions?|study\s+guide|flashcards?|quiz|main\s+topics?)\b",
    re.IGNORECASE,
)

INSUFFICIENT_CONTEXT_ANSWER = (
    "Your uploaded notes do not contain sufficient information to answer this question. "
    "Try selecting additional PDFs or asking about topics covered in your uploaded notes."
)


def _merge_chunks(
    primary: list[RetrievedChunk], secondary: list[RetrievedChunk], limit: int
) -> list[RetrievedChunk]:
    seen = {(c.document_id, c.chunk_index) for c in primary}
    merged = list(primary)
    for item in secondary:
        key = (item.document_id, item.chunk_index)
        if key not in seen:
            seen.add(key)
            merged.append(item)
        if len(merged) >= limit:
            break
    return merged[:limit]


def _to_snippet(text: str, max_len: int = 240) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3].rstrip() + "..."


def run_rag_query(
    user_id: str,
    question: str,
    document_ids: list[str] | None = None,
    history: Sequence[tuple[str, str]] = (),
) -> tuple[str, list[SourceReference]]:
    """
    Execute the complete Question-Answering RAG pipeline:
    1. Embed user question with all-MiniLM-L6-v2
    2. Retrieve relevant chunks from ChromaDB strictly scoped to user_id (+ selected docs)
    3. Verify sufficient semantic context exists
    4. Generate grounded answer using Gemini API
    5. Return answer + structured source citations
    """
    settings = get_settings()
    embedder = get_embedding_service()
    vector_store = get_vector_store()
    llm_service = get_llm_service()

    is_overview = bool(OVERVIEW_PATTERNS.search(question))
    query_embedding = embedder.embed_query(question)

    retrieved = vector_store.query_chunks(
        user_id=user_id,
        query_embedding=query_embedding,
        document_ids=document_ids,
        top_k=settings.TOP_K_CHUNKS,
    )

    if is_overview:
        overview_limit = max(settings.TOP_K_CHUNKS, 10)
        representative = vector_store.get_representative_chunks(
            user_id=user_id,
            document_ids=document_ids,
            limit=overview_limit,
        )
        # Seed with representative chunks across selected PDFs, then include top semantic matches
        retrieved = _merge_chunks(representative, retrieved, overview_limit)

    if not retrieved:
        return INSUFFICIENT_CONTEXT_ANSWER, []

    best_similarity = max(c.similarity_score for c in retrieved)
    if not is_overview and best_similarity < settings.MIN_SIMILARITY_SCORE:
        return INSUFFICIENT_CONTEXT_ANSWER, []

    if not is_overview:
        # Filter out weak trailing chunks while preserving top relevant matches
        filtered = [
            c for c in retrieved if c.similarity_score >= settings.MIN_SIMILARITY_SCORE
        ]
        if filtered:
            retrieved = filtered

    answer = llm_service.generate_answer(
        question=question,
        chunks=retrieved,
        history=history,
    )

    # If the LLM itself determines context is insufficient, avoid attaching misleading citations
    if "do not contain sufficient information" in answer.lower() and len(answer) < 260:
        return answer, []

    sources = [
        SourceReference(
            document_id=c.document_id,
            document_name=c.document_name,
            page_number=c.page_number,
            chunk_index=c.chunk_index,
            snippet=_to_snippet(c.content),
            similarity_score=c.similarity_score,
        )
        for c in retrieved
    ]
    return answer, sources

