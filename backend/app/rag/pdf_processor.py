import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf  # PyMuPDF


class PDFExtractionError(Exception):
    """Raised when a PDF cannot be opened, is encrypted, or has no extractable text."""


@dataclass(frozen=True)
class PageText:
    page_number: int
    text: str


def _normalize_page_text(raw: str) -> str:
    # Normalize line endings and collapse excessive blank lines / trailing spaces
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def extract_pdf_pages(file_path: str | Path) -> tuple[int, list[PageText]]:
    """
    Extract text page-by-page from a PDF using PyMuPDF.

    Returns:
        (total_page_count, list_of_non_empty_PageText)
    """
    path = Path(file_path)
    if not path.exists() or path.stat().st_size == 0:
        raise PDFExtractionError("Uploaded PDF file is empty.")

    try:
        doc = pymupdf.open(str(path))
    except Exception as exc:
        raise PDFExtractionError(f"Could not read PDF file (it may be corrupted): {exc}") from exc

    try:
        if doc.needs_pass:
            raise PDFExtractionError(
                "This PDF is password-protected. Please upload an unlocked PDF."
            )

        page_count = len(doc)
        if page_count == 0:
            raise PDFExtractionError("This PDF contains zero pages.")

        pages: list[PageText] = []
        for idx in range(page_count):
            page = doc.load_page(idx)
            cleaned = _normalize_page_text(page.get_text("text") or "")
            if cleaned:
                pages.append(PageText(page_number=idx + 1, text=cleaned))

        if not pages:
            raise PDFExtractionError(
                "No extractable text was found in this PDF. Scanned image-only PDFs are not supported without OCR."
            )

        return page_count, pages
    finally:
        doc.close()

