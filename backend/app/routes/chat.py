from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.db_models import User
from app.models.schemas import (
    ChatAskRequest,
    ChatAskResponse,
    ConversationDetailResponse,
    ConversationSummary,
    MessageAckResponse,
)
from app.services import chat_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat & RAG"])


@router.post("/ask", response_model=ChatAskResponse)
def ask_question(
    payload: ChatAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.ask_question(db, current_user.id, payload)


@router.get("/history", response_model=list[ConversationSummary])
def get_chat_history(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.list_conversations(db, current_user.id, search=search)


@router.delete("/history", response_model=MessageAckResponse)
def clear_all_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = chat_service.clear_all_conversations(db, current_user.id)
    return MessageAckResponse(message=msg)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.get_conversation_detail(db, current_user.id, conversation_id)


@router.post("/{conversation_id}/clear", response_model=MessageAckResponse)
def clear_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = chat_service.clear_conversation_messages(db, current_user.id, conversation_id)
    return MessageAckResponse(message=msg)


@router.delete("/{conversation_id}", response_model=MessageAckResponse)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = chat_service.delete_conversation(db, current_user.id, conversation_id)
    return MessageAckResponse(message=msg)

