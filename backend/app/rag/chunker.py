from dataclasses import dataclass

from app.rag.pdf_processor import PageText


@dataclass(frozen=True)
class TextChunk:
    chunk_index: int
    page_number: int
    content: str


def _find_split_boundary(text: str, start: int, target_end: int) -> int:
    """Prefer splitting cleanly on paragraph, sentence, or whitespace boundaries."""
    if target_end >= len(text):
        return len(text)

    window_start = max(start + (target_end - start) // 2, start)
    window = text[window_start:target_end]

    for sep in ("\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "):
        pos = window.rfind(sep)
        if pos != -1:
            candidate = window_start + pos + len(sep)
            if candidate > start:
                return candidate

    return target_end


def chunk_pages(
    pages: list[PageText],
    chunk_size: int = 800,
    chunk_overlap: int = 150,
) -> list[TextChunk]:
    """Split extracted PDF pages into overlapping character chunks preserving page numbers."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    safe_overlap = max(0, min(chunk_overlap, chunk_size // 2))

    chunks: list[TextChunk] = []
    chunk_index = 0

    for page in pages:
        text = page.text.strip()
        if not text:
            continue

        start = 0
        length = len(text)
        while start < length:
            target_end = min(start + chunk_size, length)
            end = _find_split_boundary(text, start, target_end)
            piece = text[start:end].strip()

            if piece:
                chunks.append(
                    TextChunk(
                        chunk_index=chunk_index,
                        page_number=page.page_number,
                        content=piece,
                    )
                )
                chunk_index += 1

            if end >= length:
                break

            next_start = max(end - safe_overlap, start + 1)
            # Align overlap start to a word boundary when possible
            if next_start < end and text[next_start - 1] not in (" ", "\n"):
                space_idx = text.find(" ", next_start, end)
                if space_idx != -1:
                    next_start = space_idx + 1
            start = next_start

    return chunks

