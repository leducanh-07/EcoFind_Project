"""
SQLAlchemy ORM Model for Favorite entity (SDD 6.1, FR-11, UC-07, SRS 3.4).
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class Favorite(Base):
    __tablename__ = "favorites"

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    listing_id = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    listing = relationship("Listing", foreign_keys=[listing_id])

    __table_args__ = (
        Index("idx_favorites_listing", "listing_id"),
    )
