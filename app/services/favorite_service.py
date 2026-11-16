"""
Favorite Service (SDD 4, 7.2, UC-07, FR-11).
Handles adding, removing, and listing saved/favorite items.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import NotFoundException
from app.repositories.favorite_repository import FavoriteRepository
from app.repositories.listing_repository import ListingRepository
from app.schemas.favorite import FavoriteItemResponse, FavoriteStatusResponse
from app.services.score_calculator import ScoreCalculator


class FavoriteService:
    """Service xử lý lưu và quản lý tin yêu thích của người dùng."""

    def __init__(
        self,
        favorite_repo: Optional[FavoriteRepository] = None,
        listing_repo: Optional[ListingRepository] = None,
    ):
        self.favorite_repo = favorite_repo or FavoriteRepository()
        self.listing_repo = listing_repo or ListingRepository()

    async def add_favorite(self, db: AsyncSession, *, user_id: int, listing_id: int) -> None:
        """
        Lưu tin yêu thích (UC-07, FR-11):
          - Nếu tin không tồn tại: trả lỗi 404.
          - Gọi lặp lại không tạo thêm bản ghi (idempotent, trả 204).
        """
        listing = await self.listing_repo.find_by_id(db, listing_id)
        if not listing:
            raise NotFoundException(message="Tin đăng không tồn tại", code=404)

        await self.favorite_repo.add_favorite(db, user_id, listing_id)

    async def remove_favorite(self, db: AsyncSession, *, user_id: int, listing_id: int) -> None:
        """
        Bỏ lưu tin yêu thích (UC-07, FR-11):
          - Xóa bản ghi trong bảng favorites nếu có (idempotent, trả 204).
        """
        await self.favorite_repo.remove_favorite(db, user_id, listing_id)

    async def is_favorite(self, db: AsyncSession, *, user_id: int, listing_id: int) -> FavoriteStatusResponse:
        """Kiểm tra tin đã lưu yêu thích hay chưa."""
        fav = await self.favorite_repo.is_favorite(db, user_id, listing_id)
        return FavoriteStatusResponse(listing_id=listing_id, is_favorite=fav)

    async def get_user_favorites(self, db: AsyncSession, *, user_id: int) -> List[FavoriteItemResponse]:
        """
        Lấy danh sách tin yêu thích của người dùng (UC-07, FR-11):
          - Tin đã bán hoặc bị ẩn gắn nhãn 'Không còn bán' (E2).
          - Hiển thị đầy đủ ảnh thu nhỏ, giá, điểm tổng, hạng.
        """
        records = await self.favorite_repo.find_by_user(db, user_id)
        results = []
        for fav, l in records:
            photos = sorted(l.photos or [], key=lambda p: p.sort_order)
            thumbnail_url = photos[0].url if photos else None
            total_fl = float(l.total_score)
            rank_str = ScoreCalculator.get_rank(total_fl)

            is_avail = (l.status == "selling")
            status_label = None if is_avail else "Không còn bán"

            results.append(
                FavoriteItemResponse(
                    id=l.listing_id,
                    listing_id=l.listing_id,
                    title=l.title,
                    price=float(l.price),
                    address=l.address,
                    lat=float(l.lat),
                    lng=float(l.lng),
                    category_id=l.category_id,
                    category_name=l.category.name if l.category else None,
                    total_score=total_fl,
                    rank=rank_str,
                    status=l.status,
                    is_available=is_avail,
                    status_label=status_label,
                    thumbnail_url=thumbnail_url,
                    favorited_at=fav.created_at,
                )
            )
        return results


favorite_service = FavoriteService()
