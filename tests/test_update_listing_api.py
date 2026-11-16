"""
Unit and Integration Tests for Update Listing API (PUT /api/listings/{id} & PATCH /api/listings/{id}/status - TE9C74D).
Use Case: UC-06. Epic: E6. Quản lý tin của tôi.
Acceptance Criteria & Traceability:
- PUT /api/listings/{id} chỉ chủ tin (người khác nhận 403 — TC-08).
- Sửa điểm thành phần hoặc ảnh: status về pending và tính lại điểm tổng (BR-03, TC-07).
- Sửa giá hoặc mô tả: giữ nguyên trạng thái (A2).
- Tin rejected sửa xong gửi lại thì về pending.
- Vẫn áp dụng BR-04, BR-05.
- PATCH /api/listings/{id}/status nhận hidden, selling hoặc sold theo bảng chuyển trạng thái SDD 4.2.
- Tin pending đánh dấu sold trả 409 (E1).
- Tin do Admin ẩn (hidden_by_admin) hiện lại trả 403 (E3).
- Chỉ chủ tin.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.dependencies import user_repo
from app.core.security import create_access_token
from app.models.category import Category
from app.models.listing import Listing
from app.models.listing_photo import ListingPhoto
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def seller_user():
    return User(
        user_id=10,
        full_name="Nguyễn Văn Chủ Tin",
        email="chutin@ecofind.vn",
        phone="0911222333",
        password_hash="hash_seller",
        role="user",
    )


@pytest.fixture
def other_user():
    return User(
        user_id=20,
        full_name="Trần Thị Người Khác",
        email="other@ecofind.vn",
        phone="0988777666",
        password_hash="hash_other",
        role="user",
    )


@pytest.fixture
def seller_token(seller_user):
    return create_access_token({
        "sub": str(seller_user.user_id),
        "email": seller_user.email,
        "role": seller_user.role,
    })


@pytest.fixture
def other_token(other_user):
    return create_access_token({
        "sub": str(other_user.user_id),
        "email": other_user.email,
        "role": other_user.role,
    })


@pytest.fixture
def sample_category():
    return Category(category_id=1, name="Đồ điện tử")


def make_mock_listing(
    listing_id=100,
    seller_id=10,
    status="selling",
    score_appearance=8.0,
    score_function=8.0,
    score_accessories=8.0,
    total_score=8.0,
    hidden_by_admin=False,
    reject_reason=None,
    category_id=1,
):
    cat = Category(category_id=category_id, name="Đồ điện tử")
    seller = User(user_id=seller_id, full_name="Nguyễn Văn Chủ Tin", email="chutin@ecofind.vn")
    l = Listing(
        listing_id=listing_id,
        seller_id=seller_id,
        category_id=category_id,
        title="Bàn phím cơ cũ",
        description="Bàn phím cơ dùng tốt, switch xanh",
        price=Decimal("500000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7769,
        lng=106.7009,
        score_appearance=Decimal(str(score_appearance)),
        score_function=Decimal(str(score_function)),
        score_accessories=Decimal(str(score_accessories)),
        total_score=Decimal(str(total_score)),
        status=status,
        reject_reason=reject_reason,
        hidden_by_admin=hidden_by_admin,
        created_at=datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc),
    )
    l.category = cat
    l.seller = seller
    l.photos = [
        ListingPhoto(photo_id=1, listing_id=listing_id, url="https://img.ecofind.vn/p1.jpg", sort_order=0),
        ListingPhoto(photo_id=2, listing_id=listing_id, url="https://img.ecofind.vn/p2.jpg", sort_order=1),
    ]
    return l


def test_update_listing_forbidden_for_non_owner(seller_user, other_user, other_token):
    """TC-08: Người dùng B gọi PUT /api/listings/{id} trên tin của A -> Trả 403 Forbidden."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id)

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == other_user.user_id:
            return other_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        response = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"title": "Đổi tiêu đề trái phép"},
        )
        assert response.status_code == 403
        data = response.json()
        assert "không có quyền" in data["error"]["message"].lower()

    app.dependency_overrides.clear()


def test_update_listing_unauthenticated():
    """Chưa đăng nhập gọi PUT /api/listings/{id} -> Trả 401 Unauthorized."""
    response = client.put(
        "/api/listings/100",
        json={"title": "Đổi tiêu đề"},
    )
    assert response.status_code == 401


def test_update_listing_price_or_desc_keeps_selling_status(seller_user, seller_token):
    """A2: Sửa giá hoặc mô tả: giữ nguyên trạng thái selling."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id, status="selling")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        response = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={
                "price": 450000,
                "description": "Mô tả mới sau khi giảm giá nhẹ",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["price"] == 450000
        assert data["status"] == "selling"
        assert mock_listing.status == "selling"

    app.dependency_overrides.clear()


def test_update_listing_score_resets_status_to_pending(seller_user, seller_token):
    """BR-03, TC-07: Sửa điểm thành phần: status về pending và tính lại điểm tổng."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(
        listing_id=100,
        seller_id=seller_user.user_id,
        status="selling",
        score_appearance=8.0,
        score_function=8.0,
        score_accessories=8.0,
        total_score=8.0,
    )

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        # Đổi điểm: appearance = 9.0, function = 9.0, accessories = 10.0 -> total = 9.2 (Như mới)
        response = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={
                "scoreAppearance": 9.0,
                "scoreFunction": 9.0,
                "scoreAccessories": 10.0,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["totalScore"] == 9.2
        assert data["rank"] == "Như mới"
        assert mock_listing.status == "pending"

    app.dependency_overrides.clear()


def test_update_listing_photos_resets_status_to_pending(seller_user, seller_token):
    """BR-03, TC-07: Đổi danh sách ảnh -> status về pending để duyệt lại."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id, status="selling")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        response = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={
                "photos": [
                    "https://img.ecofind.vn/new1.jpg",
                    "https://img.ecofind.vn/new2.jpg",
                    "https://img.ecofind.vn/new3.jpg",
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert len(data["photos"]) == 3
        assert mock_listing.status == "pending"

    app.dependency_overrides.clear()


def test_update_rejected_listing_resets_to_pending_and_clears_reason(seller_user, seller_token):
    """Tin rejected sửa xong gửi lại thì về pending và xóa reject_reason."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(
        listing_id=100,
        seller_id=seller_user.user_id,
        status="rejected",
        reject_reason="Ảnh mờ không rõ sản phẩm",
    )

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        response = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={
                "title": "Bàn phím cơ mới cập nhật ảnh rõ nét",
                "photos": ["https://img.ecofind.vn/clear_photo.jpg"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["rejectReason"] is None
        assert mock_listing.status == "pending"
        assert mock_listing.reject_reason is None

    app.dependency_overrides.clear()


def test_update_listing_validations(seller_user, seller_token):
    """Kiểm tra validation BR-04, BR-05 khi sửa tin."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id, status="selling")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        # Giá âm
        res = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"price": -1000},
        )
        assert res.status_code == 400

        # Giá vượt 1 tỷ
        res = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"price": 1000000001},
        )
        assert res.status_code == 400

        # Điểm ngoài 0-10
        res = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"scoreAppearance": 11.0},
        )
        assert res.status_code == 400

        # Ảnh rỗng (BR-04)
        res = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"photos": []},
        )
        assert res.status_code == 400

        # Hơn 5 ảnh
        res = client.put(
            "/api/listings/100",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"photos": [f"https://img.vn/{i}.jpg" for i in range(6)]},
        )
        assert res.status_code == 400

    app.dependency_overrides.clear()


def test_patch_status_success_hidden_and_selling(seller_user, seller_token):
    """PATCH /api/listings/{id}/status: Chủ tin ẩn và hiện lại tin thành công."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id, status="selling")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        # Ẩn tin
        res = client.patch(
            "/api/listings/100/status",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"status": "hidden"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "hidden"
        assert mock_listing.status == "hidden"

        # Hiện lại tin
        res = client.patch(
            "/api/listings/100/status",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"status": "selling"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "selling"
        assert mock_listing.status == "selling"

    app.dependency_overrides.clear()


def test_patch_status_pending_to_sold_conflict_e1(seller_user, seller_token):
    """E1: Tin pending đánh dấu sold trả 409 Conflict."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id, status="pending")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        res = client.patch(
            "/api/listings/100/status",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"status": "sold"},
        )
        assert res.status_code == 409
        assert "không được phép đánh dấu đã bán" in res.json()["error"]["message"]

    app.dependency_overrides.clear()


def test_patch_status_admin_hidden_cannot_be_unhidden_e3(seller_user, seller_token):
    """E3: Tin do Admin ẩn (hidden_by_admin) hiện lại trả 403 Forbidden."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(
        listing_id=100,
        seller_id=seller_user.user_id,
        status="hidden",
        hidden_by_admin=True,
    )

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == seller_user.user_id:
            return seller_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        res = client.patch(
            "/api/listings/100/status",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"status": "selling"},
        )
        assert res.status_code == 403
        assert "do admin ẩn" in res.json()["error"]["message"].lower()

    app.dependency_overrides.clear()


def test_patch_status_non_owner_forbidden(seller_user, other_user, other_token):
    """Không phải chủ tin đổi status -> 403 Forbidden."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=100, seller_id=seller_user.user_id, status="selling")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == other_user.user_id:
            return other_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.routers.listings import listing_service
        mp.setattr(listing_service.listing_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_listing))

        res = client.patch(
            "/api/listings/100/status",
            headers={"Authorization": f"Bearer {other_token}"},
            json={"status": "hidden"},
        )
        assert res.status_code == 403

    app.dependency_overrides.clear()
