from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.db_models import User
from app.models.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    MessageAckResponse,
    ProfileUpdateRequest,
    ResetPasswordRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services import auth_service
from app.utils.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    return auth_service.register_user(db, payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    return auth_service.login_user(db, payload)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", response_model=MessageAckResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    msg = auth_service.request_password_reset(db, payload.email)
    return MessageAckResponse(message=msg)


@router.post("/reset-password", response_model=MessageAckResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    msg = auth_service.reset_password(db, payload)
    return MessageAckResponse(message=msg)


@router.post("/logout", response_model=MessageAckResponse)
def logout(_current_user: User = Depends(get_current_user)):
    return MessageAckResponse(message="Logged out successfully.")


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return auth_service.update_profile(db, current_user, payload)


@router.post("/change-password", response_model=MessageAckResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = auth_service.change_password(db, current_user, payload)
    return MessageAckResponse(message=msg)


@router.delete("/account", response_model=MessageAckResponse)
def delete_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = auth_service.delete_account(db, current_user, payload.password)
    return MessageAckResponse(message=msg)

