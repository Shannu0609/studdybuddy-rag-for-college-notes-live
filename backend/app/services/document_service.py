import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.db_models import Document, User
from app.models.schemas import DocumentResponse
from app.rag.chunker import chunk_pages
from app.rag.embedder import get_embedding_service
from app.rag.pdf_processor import PDFExtractionError, extract_pdf_pages
from app.rag.vector_store import get_vector_store
from app.utils.cache import get_cache

logger = logging.getLogger(__name__)


def _sanitize_filename(filename: str | None) -> str:
    if not filename:
        return "untitled.pdf"
    base = Path(filename).name.strip()
    return base or "untitled.pdf"


def upload_and_process_document(
    db: Session,
    user: User,
    upload_file: UploadFile,
) -> DocumentResponse:
    settings = get_settings()
    original_filename = _sanitize_filename(upload_file.filename)

    if not original_filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files (.pdf) are supported.",
        )

    allowed_mimes = {"application/pdf", "application/x-pdf", "application/octet-stream", ""}
    content_type = (upload_file.content_type or "").lower()
    if content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file content type '{upload_file.content_type}'. Please upload a valid PDF.",
        )

    raw_bytes = upload_file.file.read()
    file_size = len(raw_bytes)
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty (0 bytes).",
        )

    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
        )

    if not raw_bytes.lstrip().startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file signature. The uploaded file does not appear to be a valid PDF.",
        )

    doc_id = str(uuid.uuid4())
    user_dir = settings.resolved_upload_dir / user.id
    user_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{doc_id}.pdf"
    file_path = user_dir / stored_filename
    file_path.write_bytes(raw_bytes)

    doc = Document(
        id=doc_id,
        user_id=user.id,
        filename=original_filename,
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_size=file_size,
        page_count=0,
        chunk_count=0,
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    vector_store = get_vector_store()
    embedder = get_embedding_service()

    try:
        # 1. Extract text page-by-page using PyMuPDF
        page_count, pages = extract_pdf_pages(file_path)

        # 2. Split into overlapping chunks preserving page numbers
        chunks = chunk_pages(
            pages,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )
        if not chunks:
            raise PDFExtractionError("Failed to generate text chunks from the uploaded PDF.")

        # 3. Generate Sentence Transformers embeddings (all-MiniLM-L6-v2)
        embeddings = embedder.embed_texts([c.content for c in chunks])
        if len(embeddings) != len(chunks):
            raise RuntimeError("Embedding generation returned an unexpected vector count.")

        # 4. Persist vectors & metadata in ChromaDB before marking document processed
        vector_store.add_document_chunks(
            user_id=user.id,
            document_id=doc.id,
            document_name=doc.filename,
            chunks=chunks,
            embeddings=embeddings,
        )

        # Mark processed only after embedding generation & Chroma storage succeed
        doc.page_count = page_count
        doc.chunk_count = len(chunks)
        doc.status = "processed"
        doc.error_message = None
        doc.processed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(doc)
        get_cache().delete_prefix(f"dashboard:{user.id}")
        return DocumentResponse.model_validate(doc)

    except PDFExtractionError as exc:
        logger.warning("PDF extraction failed for %s (%s): %s", doc.filename, doc.id, exc)
        _mark_document_failed(db, doc, vector_store, user.id, str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error processing PDF %s (%s)", doc.filename, doc.id)
        _mark_document_failed(
            db,
            doc,
            vector_store,
            user.id,
            f"Document processing failed during indexing: {exc}",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index PDF document: {exc}",
        ) from exc


def _mark_document_failed(db: Session, doc: Document, vector_store, user_id: str, error_msg: str) -> None:
    try:
        vector_store.delete_document_chunks(user_id, doc.id)
    except Exception:
        pass
    doc.status = "failed"
    doc.error_message = error_msg
    db.commit()
    get_cache().delete_prefix(f"dashboard:{user_id}")


def list_documents(
    db: Session,
    user_id: str,
    status_filter: str | None = None,
    search: str | None = None,
) -> list[DocumentResponse]:
    query = db.query(Document).filter(Document.user_id == user_id)
    if status_filter:
        query = query.filter(Document.status == status_filter)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(Document.filename.ilike(term))
    docs = query.order_by(Document.created_at.desc()).all()
    return [DocumentResponse.model_validate(d) for d in docs]


def get_document(db: Session, user_id: str, document_id: str) -> DocumentResponse:
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == user_id)
        .first()
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    return DocumentResponse.model_validate(doc)


def delete_document(db: Session, user_id: str, document_id: str) -> str:
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == user_id)
        .first()
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    try:
        get_vector_store().delete_document_chunks(user_id, doc.id)
    except Exception as exc:
        logger.warning("Failed to remove Chroma vectors for doc %s: %s", doc.id, exc)

    file_path = Path(doc.file_path)
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError as exc:
            logger.warning("Failed to delete PDF file %s: %s", file_path, exc)

    db.delete(doc)
    db.commit()
    get_cache().delete_prefix(f"dashboard:{user_id}")
    return f"Document '{doc.filename}' deleted successfully."

