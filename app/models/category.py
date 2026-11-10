"""
SQLAlchemy ORM Model for Category entity (SDD 6.1, SRS 3.4).
"""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(50), nullable=False, unique=True)

    listings = relationship("Listing", back_populates="category")

