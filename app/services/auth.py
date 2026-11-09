"""Authentication service for business logic execution.
Adheres to SDD 4, UC-01, FR-01, NFR-SEC-01.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest, RegisterResponse
from app.core.security import get_password_hash, create_access_token


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def register(self, data: RegisterRequest) -> RegisterResponse:
        """Register a new user account.
        Validates email uniqueness (409), hashes password with bcrypt (Passlib),
        saves user with role='user', and generates JWT token.
        """
        # Check if email is already registered
        existing_user = self.user_repo.find_by_email(data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": "Email already exists",
                    "fields": {"email": "Email already exists"},
                },
            )

        # Hash password using bcrypt (Passlib) - never store plaintext password
        password_hash = get_password_hash(data.password)

        # Create new user instance with default role 'user'
        new_user = User(
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            password_hash=password_hash,
            role="user",
            failed_attempts=0,
            locked_until=None,
        )

        saved_user = self.user_repo.save(new_user)

        # Generate JWT access token
        token = create_access_token(
            data={
                "sub": str(saved_user.user_id),
                "email": saved_user.email,
                "role": saved_user.role,
            }
        )

        return RegisterResponse(token=token, role=saved_user.role)
