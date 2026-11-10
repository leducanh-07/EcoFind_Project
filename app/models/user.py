"""
SQLAlchemy ORM Model for User entity (SDD 6.1, SRS 3.4).
"""

from typing import Optional
from sqlalchemy import Column, Integer, String, SmallInteger, DateTime
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    password_hash = Column(String(100), nullable=False)
    role = Column(String(10), nullable=False, default="user")
    failed_attempts = Column(SmallInteger, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
