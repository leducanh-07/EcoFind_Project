"""
Repository for User entity access (SDD 4, SDD 6.1).
Uses SQLAlchemy 2.0 AsyncSession.
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


class UserRepository:
    """Repository chuyên trách truy vấn và cập nhật bảng users."""

    async def find_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Tìm người dùng qua email (không phân biệt hoa thường)."""
        stmt = select(User).where(User.email == email.strip().lower())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Tìm người dùng theo user_id."""
        stmt = select(User).where(User.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def save(self, db: AsyncSession, user: User) -> User:
        """Thêm mới người dùng vào CSDL."""
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update(self, db: AsyncSession, user: User) -> User:
        """Cập nhật thông tin người dùng."""
        await db.commit()
        await db.refresh(user)
        return user
