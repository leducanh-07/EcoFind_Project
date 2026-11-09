"""User repository for database access adhering to SDD 4 and NFR-SEC-04."""
from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email using parameterized query."""
        return self.db.query(User).filter(User.email == email).first()

    def save(self, user: User) -> User:
        """Persist user entity to database."""
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
