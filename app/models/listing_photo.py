"""
SQLAlchemy ORM Model for ListingPhoto entity (SDD 6.1, BR-04, SRS 3.4).
"""

from sqlalchemy import Column, Integer, String, SmallInteger, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ListingPhoto(Base):
    __tablename__ = "listing_photos"

    photo_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.listing_id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    sort_order = Column(SmallInteger, nullable=False, default=0)

    listing = relationship("Listing", back_populates="photos")

