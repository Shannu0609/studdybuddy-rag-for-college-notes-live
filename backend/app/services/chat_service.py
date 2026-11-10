from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db_models import Conversation, Document, Message
from app.models.schemas import (
    ChatAskRequest,
    ChatAskResponse,
    ConversationDetailResponse,
    ConversationSummary,
    MessageResponse,
)
from app.rag.llm_service import LLMConfigurationError, LLMGenerationError
from app.rag.pipeline import run_rag_query
from app.utils.cache import get_cache


def _build_conversation_title(question: str) -> str:
    cleaned = " ".join(question.strip().split())
    if len(cleaned) <= 60:
        return cleaned
    return cleaned[:57].rstrip() + "..."


def _validate_selected_documents(
    db: Session, user_id: str, requested_ids: list[str]
) -> list[str]:
    unique_ids = list(dict.fromkeys(doc_id.strip() for doc_id in requested_ids if doc_id.strip()))
    if unique_ids:
        matched = (
            db.query(Document)
            .filter(Document.user_id == user_id, Document.id.in_(unique_ids))
            .all()
        )
        matched_map = {doc.id: doc for doc in matched}
        missing = [doc_id for doc_id in unique_ids if doc_id not in matched_map]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more selected documents were not found in your library.",
            )
        unprocessed = [
            doc.filename for doc in matched if doc.status != "processed"
        ]
        if unprocessed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected document(s) are not ready for querying: {', '.join(unprocessed)}.",
            )
        return unique_ids

    processed_count = (
        db.query(func.count(Document.id))
        .filter(Document.user_id == user_id, Document.status == "processed")
        .scalar()
        or 0
    )
    if processed_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload and process at least one PDF document before asking questions.",
        )
    return []


def ask_question(db: Session, user_id: str, payload: ChatAskRequest) -> ChatAskResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    scoped_doc_ids = _validate_selected_documents(db, user_id, payload.document_ids)

    conversation: Conversation | None = None
    history_pairs: list[tuple[str, str]] = []

    if payload.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.id == payload.conversation_id,
                Conversation.user_id == user_id,
            )
            .first()
        )
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        existing_messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.asc())
            .all()
        )
        history_pairs = [(m.role, m.content) for m in existing_messages[-6:]]

    try:
        answer_text, sources = run_rag_query(
            user_id=user_id,
            question=question,
            document_ids=scoped_doc_ids or None,
            history=history_pairs,
        )
    except LLMConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except LLMGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    now = datetime.now(timezone.utc)
    if conversation is None:
        conversation = Conversation(
            user_id=user_id,
            title=_build_conversation_title(question),
            selected_document_ids=scoped_doc_ids,
            created_at=now,
            updated_at=now,
        )
        db.add(conversation)
        db.flush()
    else:
        conversation.selected_document_ids = scoped_doc_ids
        conversation.updated_at = now
        if not conversation.title or conversation.title == "New Conversation":
            conversation.title = _build_conversation_title(question)

    user_msg = Message(
        conversation_id=conversation.id,
        user_id=user_id,
        role="user",
        content=question,
        sources=[],
        created_at=now,
    )
    assistant_msg = Message(
        conversation_id=conversation.id,
        user_id=user_id,
        role="assistant",
        content=answer_text,
        sources=[s.model_dump() for s in sources],
        created_at=datetime.now(timezone.utc),
    )

    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()
    db.refresh(conversation)
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    get_cache().delete_prefix(f"dashboard:{user_id}")

    return ChatAskResponse(
        conversation_id=conversation.id,
        conversation_title=conversation.title,
        user_message=MessageResponse.model_validate(user_msg),
        assistant_message=MessageResponse.model_validate(assistant_msg),
    )


def list_conversations(
    db: Session,
    user_id: str,
    search: str | None = None,
) -> list[ConversationSummary]:
    query = db.query(Conversation).filter(Conversation.user_id == user_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        matching_conv_ids = (
            db.query(Message.conversation_id)
            .filter(Message.user_id == user_id, Message.content.ilike(term))
            .distinct()
        )
        query = query.filter(
            Conversation.title.ilike(term) | Conversation.id.in_(matching_conv_ids)
        )

    conversations = query.order_by(Conversation.updated_at.desc()).all()
    summaries: list[ConversationSummary] = []

    for conv in conversations:
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.created_at.asc())
            .all()
        )
        last_msg_preview = None
        if messages:
            last_content = " ".join(messages[-1].content.split())
            last_msg_preview = (
                last_content[:110] + "..." if len(last_content) > 110 else last_content
            )
        summaries.append(
            ConversationSummary(
                id=conv.id,
                title=conv.title,
                selected_document_ids=conv.selected_document_ids or [],
                message_count=len(messages),
                last_message=last_msg_preview,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
            )
        )
    return summaries


def get_conversation_detail(
    db: Session, user_id: str, conversation_id: str
) -> ConversationDetailResponse:
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return ConversationDetailResponse(
        id=conv.id,
        title=conv.title,
        selected_document_ids=conv.selected_document_ids or [],
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[MessageResponse.model_validate(m) for m in messages],
    )


def delete_conversation(db: Session, user_id: str, conversation_id: str) -> str:
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    db.delete(conv)
    db.commit()
    get_cache().delete_prefix(f"dashboard:{user_id}")
    return "Conversation deleted successfully."


def clear_conversation_messages(db: Session, user_id: str, conversation_id: str) -> str:
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.user_id == user_id,
    ).delete(synchronize_session=False)
    conv.title = "New Conversation"
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    get_cache().delete_prefix(f"dashboard:{user_id}")
    return "Conversation cleared."


def clear_all_conversations(db: Session, user_id: str) -> str:
    db.query(Conversation).filter(Conversation.user_id == user_id).delete(
        synchronize_session=False
    )
    db.commit()
    get_cache().delete_prefix(f"dashboard:{user_id}")
    return "All chat history cleared."

