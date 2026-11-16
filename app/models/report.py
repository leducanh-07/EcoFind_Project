"""
SQLAlchemy ORM Model for Report entity (SDD 6.1, FR-12, FR-15, SRS 3.4).
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String(20), nullable=False)
    note = Column(String(200), nullable=True)
    status = Column(String(10), nullable=False, default="new")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    listing = relationship("Listing", foreign_keys=[listing_id])
    reporter = relationship("User", foreign_keys=[reporter_id])

    __table_args__ = (
        UniqueConstraint("reporter_id", "listing_id", name="uq_reports_reporter_listing"),
        CheckConstraint("status IN ('new', 'resolved')", name="chk_reports_status"),
        CheckConstraint("reason IN ('wrong_score', 'scam', 'prohibited', 'other')", name="chk_reports_reason"),
        Index("idx_reports_queue", "status", "created_at"),
    )
