import logging
import shutil
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.db_models import PasswordResetToken, User
from app.models.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    ProfileUpdateRequest,
    ResetPasswordRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.rag.vector_store import get_vector_store
from app.utils.cache import get_cache
from app.utils.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)

logger = logging.getLogger(__name__)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _send_reset_email(recipient: str, reset_token: str) -> None:
    settings = get_settings()
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/forgot-password?token={reset_token}"

    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP_HOST is not configured. Password reset token for %s: %s (URL: %s)",
            recipient,
            reset_token,
            reset_url,
        )
        return

    msg = EmailMessage()
    msg["Subject"] = "Study Buddy AI - Password Reset Request"
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER or "noreply@studybuddy.local"
    msg["To"] = recipient
    msg.set_content(
        f"You requested a password reset for Study Buddy AI.\n\n"
        f"Reset token: {reset_token}\n"
        f"Reset link: {reset_url}\n\n"
        f"This token expires in 15 minutes. If you did not request this, ignore this email."
    )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        logger.error("Failed to send password reset email: %s", exc)


def register_user(db: Session, payload: UserRegisterRequest) -> AuthResponse:
    normalized_email = _normalize_email(payload.email)
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


def login_user(db: Session, payload: UserLoginRequest) -> AuthResponse:
    normalized_email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == normalized_email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user.id, user.email)
    return AuthResponse(access_token=token, user=UserResponse.model_validate(user))


def request_password_reset(db: Session, email: str) -> str:
    normalized_email = _normalize_email(email)
    user = db.query(User).filter(User.email == normalized_email).first()

    if user is not None:
        # Invalidate previous unused tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        ).update({"used": True})

        raw_token, token_hash = generate_reset_token()
        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        db.add(reset_record)
        db.commit()
        _send_reset_email(user.email, raw_token)

    return (
        "If an account with that email exists, password reset instructions have been issued. "
        "Check your inbox (or backend server logs in local development)."
    )


def reset_password(db: Session, payload: ResetPasswordRequest) -> str:
    token_hash = hash_reset_token(payload.token.strip())
    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used.is_(False),
        )
        .first()
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used password reset token.",
        )

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token has expired. Please request a new one.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.password_hash = hash_password(payload.new_password)
    record.used = True
    db.commit()
    return "Your password has been reset successfully. You can now sign in."


def update_profile(db: Session, user: User, payload: ProfileUpdateRequest) -> UserResponse:
    if payload.full_name is not None:
        cleaned_name = payload.full_name.strip()
        if len(cleaned_name) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Full name must be at least 2 characters.",
            )
        user.full_name = cleaned_name

    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url.strip() or None

    if payload.theme_preference is not None:
        user.theme_preference = payload.theme_preference

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


def change_password(db: Session, user: User, payload: ChangePasswordRequest) -> str:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from your current password.",
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return "Password updated successfully."


def delete_account(db: Session, user: User, password: str) -> str:
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Account deletion cancelled.",
        )

    user_id = user.id
    settings = get_settings()

    # Delete user's vectors from ChromaDB
    try:
        get_vector_store().delete_user_chunks(user_id)
    except Exception as exc:
        logger.warning("Failed to delete Chroma vectors for user %s: %s", user_id, exc)

    # Delete uploaded files directory for user
    user_upload_dir = settings.resolved_upload_dir / user_id
    if user_upload_dir.exists():
        shutil.rmtree(user_upload_dir, ignore_errors=True)

    get_cache().delete_prefix(f"dashboard:{user_id}")
    db.delete(user)
    db.commit()
    return "Account and all associated data deleted."

