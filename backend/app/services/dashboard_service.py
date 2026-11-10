from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.db_models import Conversation, Document, Message
from app.models.schemas import DashboardStatsResponse, DocumentResponse
from app.services.chat_service import list_conversations
from app.utils.cache import get_cache


def get_dashboard_stats(db: Session, user_id: str) -> DashboardStatsResponse:
    cache = get_cache()
    cache_key = f"dashboard:{user_id}:stats"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return DashboardStatsResponse.model_validate(cached)

    total_documents = (
        db.query(func.count(Document.id))
        .filter(Document.user_id == user_id)
        .scalar()
        or 0
    )
    processed_documents = (
        db.query(func.count(Document.id))
        .filter(Document.user_id == user_id, Document.status == "processed")
        .scalar()
        or 0
    )
    total_chunks = (
        db.query(func.coalesce(func.sum(Document.chunk_count), 0))
        .filter(Document.user_id == user_id, Document.status == "processed")
        .scalar()
        or 0
    )
    total_questions_asked = (
        db.query(func.count(Message.id))
        .filter(Message.user_id == user_id, Message.role == "user")
        .scalar()
        or 0
    )
    total_conversations = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.user_id == user_id)
        .scalar()
        or 0
    )

    recent_docs = (
        db.query(Document)
        .filter(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
        .limit(5)
        .all()
    )
    recent_convs = list_conversations(db, user_id)[:5]

    result = DashboardStatsResponse(
        total_documents=int(total_documents),
        processed_documents=int(processed_documents),
        total_questions_asked=int(total_questions_asked),
        total_conversations=int(total_conversations),
        total_chunks=int(total_chunks),
        recent_documents=[DocumentResponse.model_validate(d) for d in recent_docs],
        recent_conversations=recent_convs,
    )
    cache.set_json(cache_key, result.model_dump(mode="json"), ttl_seconds=60)
    return result
