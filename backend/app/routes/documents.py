from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.db_models import User
from app.models.schemas import DocumentResponse, MessageAckResponse
from app.services import document_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.upload_and_process_document(db, current_user, file)


@router.get("", response_model=list[DocumentResponse])
def get_documents(
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.list_documents(
        db,
        current_user.id,
        status_filter=status_filter,
        search=search,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document_detail(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.get_document(db, current_user.id, document_id)


@router.delete("/{document_id}", response_model=MessageAckResponse)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = document_service.delete_document(db, current_user.id, document_id)
    return MessageAckResponse(message=msg)

