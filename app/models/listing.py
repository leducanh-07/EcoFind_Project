"""
SQLAlchemy ORM Model for Listing entity (SDD 6.1, FR-08, BR-01..BR-05, SRS 3.4).
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Listing(Base):
    __tablename__ = "listings"

    listing_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="RESTRICT"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Numeric(12, 0), nullable=False)
    address = Column(String(255), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    score_appearance = Column(Numeric(3, 1), nullable=False)
    score_function = Column(Numeric(3, 1), nullable=False)
    score_accessories = Column(Numeric(3, 1), nullable=False)
    total_score = Column(Numeric(3, 1), nullable=False)
    status = Column(String(12), nullable=False, default="pending")
    reject_reason = Column(Text, nullable=True)
    hidden_by_admin = Column(Boolean, nullable=False, default=False)
    reviewed_by = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    seller = relationship("User", foreign_keys=[seller_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    category = relationship("Category", back_populates="listings")
    photos = relationship(
        "ListingPhoto",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingPhoto.sort_order",
    )

    __table_args__ = (
        CheckConstraint("price >= 0 AND price <= 1000000000", name="chk_listings_price"),
        CheckConstraint("score_appearance >= 0.0 AND score_appearance <= 10.0", name="chk_listings_score_appearance"),
        CheckConstraint("score_function >= 0.0 AND score_function <= 10.0", name="chk_listings_score_function"),
        CheckConstraint("score_accessories >= 0.0 AND score_accessories <= 10.0", name="chk_listings_score_accessories"),
        CheckConstraint("total_score >= 0.0 AND total_score <= 10.0", name="chk_listings_total_score"),
        CheckConstraint("status IN ('pending', 'selling', 'rejected', 'sold', 'hidden')", name="chk_listings_status"),
    )

