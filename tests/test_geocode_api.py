"""
Unit and Integration Tests for Geocode API & Nominatim GeocodeAdapter (TE9C73F, UC-05, FR-08, NFR-MNT-01, UC-05 A1).
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
import httpx

from app.main import app
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User
from app.adapters.geocode_adapter import (
    BaseGeocodeAdapter,
    NominatimGeocodeAdapter,
)
from app.services.geocode_service import GeocodeService

client = TestClient(app)


@pytest.fixture
def mock_user():
    return User(
        user_id=1,
        full_name="Nguyễn Văn Minh Tín",
        email="tin.nguyen@ecofind.vn",
        phone="0912345678",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def auth_headers(mock_user):
    token = create_access_token({
        "sub": str(mock_user.user_id),
        "email": mock_user.email,
        "role": mock_user.role,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def mock_db_session():
    """Mock get_db globally for test suite to avoid connecting to real PostgreSQL."""
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    yield mock_db
    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 1. AUTHENTICATION & VALIDATION TESTS
# -----------------------------------------------------------------------------

def test_geocode_unauthenticated_returns_401():
    """UC-05: Khách chưa đăng nhập gọi GET /api/geocode phải nhận HTTP 401."""
    response = client.get("/api/geocode?address=123+Nguyen+Hue")
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == 401
    assert "Chưa đăng nhập" in data["error"]["message"] or "token" in data["error"]["message"].lower()


def test_geocode_invalid_token_returns_401():
    """UC-05: Gửi token không hợp lệ trả về HTTP 401."""
    response = client.get(
        "/api/geocode?address=123+Nguyen+Hue",
        headers={"Authorization": "Bearer invalid_garbage_token"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == 401


def test_geocode_missing_address_param_returns_400(mock_user, auth_headers):
    """UC-05 E1: Thiếu tham số address trả về HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        response = client.get("/api/geocode", headers=auth_headers)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
        assert "fields" in data["error"]
        assert "address" in data["error"]["fields"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_geocode_empty_or_whitespace_address_returns_400(mock_user, auth_headers):
    """UC-05 E1: Địa chỉ rỗng hoặc chỉ toàn khoảng trắng trả về HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        # Empty string
        response1 = client.get("/api/geocode?address=", headers=auth_headers)
        assert response1.status_code == 400
        assert "address" in response1.json()["error"]["fields"]

        # Whitespace string
        response2 = client.get("/api/geocode?address=%20%20%20", headers=auth_headers)
        assert response2.status_code == 400
        assert "address" in response2.json()["error"]["fields"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_geocode_address_too_long_returns_400(mock_user, auth_headers):
    """UC-05 E1: Địa chỉ vượt quá 255 ký tự trả về HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        too_long = "A" * 256
        response = client.get(f"/api/geocode?address={too_long}", headers=auth_headers)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# -----------------------------------------------------------------------------
# 2. SUCCESSFUL GEOCODING & NOT FOUND TESTS
# -----------------------------------------------------------------------------

def test_geocode_success_returns_200_and_coordinates(mock_user, auth_headers):
    """UC-05: Địa chỉ hợp lệ trả về HTTP 200 kèm lat và lng."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_nominatim_response = [
        {
            "place_id": 101,
            "lat": "10.776889",
            "lon": "106.700806",
            "display_name": "123, Đường Nguyễn Huệ, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh, 700000, Việt Nam",
            "address": {
                "road": "Đường Nguyễn Huệ",
                "city": "Thành phố Hồ Chí Minh",
                "country": "Việt Nam",
            },
        }
    ]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_nominatim_response

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        try:
            response = client.get(
                "/api/geocode?address=123+Nguyen+Hue+Quan+1",
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert "lat" in data
            assert "lng" in data
            assert data["lat"] == pytest.approx(10.776889, rel=1e-5)
            assert data["lng"] == pytest.approx(106.700806, rel=1e-5)
        finally:
            app.dependency_overrides.pop(get_current_user, None)


def test_geocode_not_found_returns_404(mock_user, auth_headers):
    """UC-05 A1: Địa chỉ không tồn tại (Nominatim trả []) trả về HTTP 404."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        try:
            response = client.get(
                "/api/geocode?address=DiaChiKhongTonTai123456789XYZ",
                headers=auth_headers,
            )
            assert response.status_code == 404
            data = response.json()
            assert data["error"]["code"] == 404
            assert "Không tìm thấy" in data["error"]["message"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)


def test_geocode_network_error_returns_404(mock_user, auth_headers):
    """UC-05 A1: Khi mạng lỗi hoặc Nominatim trả 500, trả về HTTP 404 an toàn."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("Connection refused")):
        try:
            response = client.get(
                "/api/geocode?address=123+Nguyen+Hue",
                headers=auth_headers,
            )
            assert response.status_code == 404
            data = response.json()
            assert data["error"]["code"] == 404
            assert "Không tìm thấy" in data["error"]["message"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)


# -----------------------------------------------------------------------------
# 3. NOMINATIM POLICY & HCMC PRIORITIZATION TESTS
# -----------------------------------------------------------------------------

def test_nominatim_adapter_sends_user_agent_and_viewbox():
    """Tiêu chí chấp nhận: gửi User-Agent và viewbox ưu tiên TP.HCM."""
    async def _run():
        adapter = NominatimGeocodeAdapter(user_agent="EcoFindTest/1.0", min_interval=0.0)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "lat": "10.7769",
                "lon": "106.7008",
                "display_name": "Nguyễn Huệ, Quận 1, Hồ Chí Minh",
            }
        ]

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            coords = await adapter.geocode("Nguyễn Huệ")
            assert coords == (10.7769, 106.7008)

            call_args, call_kwargs = mock_get.call_args
            headers = call_kwargs.get("headers", {})
            params = call_kwargs.get("params", {})

            assert headers.get("User-Agent") == "EcoFindTest/1.0"
            assert params.get("format") == "json"
            assert params.get("countrycodes") == "vn"
            assert params.get("viewbox") == adapter.HCMC_VIEWBOX
            assert params.get("bounded") == 0

    asyncio.run(_run())


def test_nominatim_adapter_prioritizes_hcmc_result():
    """Tiêu chí chấp nhận: Ưu tiên kết quả trong TP.HCM khi có nhiều địa điểm trùng tên."""
    async def _run():
        adapter = NominatimGeocodeAdapter(min_interval=0.0)

        mock_results = [
            {
                "lat": "21.0285",
                "lon": "105.8542",
                "display_name": "Đường Lê Lợi, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội",
                "address": {"city": "Hà Nội"},
            },
            {
                "lat": "10.7735",
                "lon": "106.6944",
                "display_name": "Đường Lê Lợi, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh",
                "address": {"city": "Thành phố Hồ Chí Minh"},
            },
            {
                "lat": "16.0544",
                "lon": "108.2022",
                "display_name": "Đường Lê Lợi, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng",
                "address": {"city": "Đà Nẵng"},
            },
        ]

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_results

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resp
            coords = await adapter.geocode("Lê Lợi")
            assert coords is not None
            assert coords[0] == pytest.approx(10.7735, rel=1e-4)
            assert coords[1] == pytest.approx(106.6944, rel=1e-4)

    asyncio.run(_run())


def test_nominatim_adapter_rate_limiter_throttles_calls():
    """Tiêu chí chấp nhận: Tuân thủ chính sách không quá 1 request/giây."""
    async def _run():
        adapter = NominatimGeocodeAdapter(min_interval=1.0)
        sleep_calls = []

        async def fake_sleep(duration):
            sleep_calls.append(duration)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"lat": "10.77", "lon": "106.70", "display_name": "TPHCM"}]

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, \
             patch("asyncio.sleep", side_effect=fake_sleep):
            mock_get.return_value = mock_resp

            # Lần gọi 1
            await adapter.geocode("Địa chỉ 1")
            assert len(sleep_calls) == 0

            # Lần gọi 2 ngay lập tức (< 1 giây sau)
            await adapter.geocode("Địa chỉ 2")
            assert len(sleep_calls) == 1
            assert 0.0 < sleep_calls[0] <= 1.0

    asyncio.run(_run())


# -----------------------------------------------------------------------------
# 4. EXTENSIBILITY (NFR-MNT-01): PLUGGABLE ADAPTER
# -----------------------------------------------------------------------------

def test_nfr_mnt_01_swappable_geocode_adapter():
    """
    NFR-MNT-01: Kiểm tra khả năng thay thế nhà cung cấp geocoding chỉ bằng cách đổi adapter
    mà không cần chỉnh sửa service hay router.
    """
    async def _run():
        class CustomMockProviderAdapter(BaseGeocodeAdapter):
            async def geocode(self, address: str):
                if "Q1" in address:
                    return (10.7700, 106.6900)
                return None

        custom_adapter = CustomMockProviderAdapter()
        service = GeocodeService(adapter=custom_adapter)

        res1 = await service.get_coordinates("Cửa hàng ABC, Q1")
        assert res1 == (10.7700, 106.6900)

        with pytest.raises(Exception) as excinfo:
            await service.get_coordinates("Cửa hàng XYZ ở tỉnh khác")
        assert "Không tìm thấy" in str(excinfo.value)

    asyncio.run(_run())


def test_vietnamese_address_house_number_interpolation():
    """
    Kiểm tra thuật toán chuẩn hóa và tìm tọa độ địa chỉ tiếng Việt:
    '142 Đ. Lê Văn Việt, Tăng Nhơn Phú, Hồ Chí Minh, Vietnam' phải định vị chính xác
    gần đoạn Hồ Thị Tư - Trương Văn Hải (lat ~ 10.8449, lon ~ 106.7803), không rơi vào Hẻm C6 (lon > 106.795).
    """
    from app.adapters.geocode_adapter import default_geocode_adapter
    async def _run():
        res = await default_geocode_adapter.geocode("142 Đ. Lê Văn Việt, Tăng Nhơn Phú, Hồ Chí Minh, Vietnam")
        assert res is not None
        lat, lon = res
        assert 10.843 <= lat <= 10.847
        assert 106.778 <= lon <= 106.784, f"Kinh độ {lon} bị lệch xa khỏi đoạn số nhà 142!"

    asyncio.run(_run())


def test_arcgis_rejects_coarse_locality_and_picks_street_name():
    """ArcGIS không được trả về tâm phường (Locality) mà phải chọn tối thiểu mức StreetName trở lên."""
    from app.adapters.geocode_adapter import ArcGISGeocodeAdapter

    async def _run():
        adapter = ArcGISGeocodeAdapter()
        coarse_resp = MagicMock()
        coarse_resp.status_code = 200
        coarse_resp.json.return_value = {
            "candidates": [
                {
                    "address": "Phước Long B, Hồ Chí Minh",
                    "score": 88.0,
                    "location": {"x": 106.7690, "y": 10.8383},
                    "attributes": {"Addr_type": "Locality", "Score": 88.0},
                }
            ]
        }

        street_resp = MagicMock()
        street_resp.status_code = 200
        street_resp.json.return_value = {
            "candidates": [
                {
                    "address": "Đường Đỗ Xuân Hợp, Phước Long B, Hồ Chí Minh, 71210, VNM",
                    "score": 92.5,
                    "location": {"x": 106.779575, "y": 10.799517},
                    "attributes": {"Addr_type": "StreetName", "Score": 92.5},
                }
            ]
        }

        with patch("httpx.AsyncClient.get", side_effect=[coarse_resp, street_resp]):
            res = await adapter.geocode_detailed("450 Đỗ Xuân Hợp, Phước Long B, Thủ Đức, Hồ Chí Minh")
            assert res is not None
            assert res.accuracy == "street"
            assert res.lat == pytest.approx(10.799517, rel=1e-5)
            assert res.lng == pytest.approx(106.779575, rel=1e-5)
            assert "VNM" not in (res.matched_address or "")

    asyncio.run(_run())


def test_google_request_denied_falls_back_cleanly_to_arcgis():
    """Khi Google Geocode trả REQUEST_DENIED (chưa bật Billing), SmartGeocodeAdapter rơi về ArcGIS an toàn."""
    from app.adapters.geocode_adapter import (
        GoogleGeocodeAdapter,
        ArcGISGeocodeAdapter,
        NominatimGeocodeAdapter,
        SmartGeocodeAdapter,
    )

    async def _run():
        google = GoogleGeocodeAdapter(api_key="fake-unbilled-key")
        arcgis = ArcGISGeocodeAdapter()
        nominatim = NominatimGeocodeAdapter(min_interval=0.0)
        smart = SmartGeocodeAdapter(google_adapter=google, arcgis_adapter=arcgis, nominatim_adapter=nominatim)

        google_denied = MagicMock()
        google_denied.status_code = 200
        google_denied.json.return_value = {
            "status": "REQUEST_DENIED",
            "error_message": "You must enable Billing on the Google Cloud Project",
            "results": [],
        }

        arcgis_ok = MagicMock()
        arcgis_ok.status_code = 200
        arcgis_ok.json.return_value = {
            "candidates": [
                {
                    "address": "142 Đường Lê Văn Việt, Hiệp Phú, Tăng Nhơn Phú, Hồ Chí Minh, 71206",
                    "score": 96.7,
                    "location": {"x": 106.780327, "y": 10.844915},
                    "attributes": {"Addr_type": "PointAddress", "Score": 96.7},
                }
            ]
        }

        with patch("httpx.AsyncClient.get", side_effect=[google_denied, arcgis_ok]):
            res = await smart.geocode_detailed("142 Đ. Lê Văn Việt, Tăng Nhơn Phú, Hồ Chí Minh")
            assert res is not None
            assert res.provider == "arcgis"
            assert res.accuracy == "exact"
            assert res.lat == pytest.approx(10.844915, rel=1e-5)
            assert google._denied_key == "fake-unbilled-key"

    asyncio.run(_run())


def test_geocode_suggest_and_reverse_endpoints(mock_user, auth_headers):
    """Kiểm tra xác thực và phản hồi cho GET /api/geocode/suggest và GET /api/geocode/reverse."""
    # Chưa đăng nhập -> 401
    assert client.get("/api/geocode/suggest?q=142+Le+Van+Viet").status_code == 401
    assert client.get("/api/geocode/reverse?lat=10.8449&lng=106.7803").status_code == 401

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        suggest_resp = MagicMock()
        suggest_resp.status_code = 200
        suggest_resp.json.return_value = {
            "suggestions": [
                {
                    "text": "142 Đường Lê Văn Việt, Hiệp Phú, Tăng Nhơn Phú, Hồ Chí Minh, 71206, VNM",
                    "magicKey": "abc123magic",
                }
            ]
        }

        with patch("httpx.AsyncClient.get", return_value=suggest_resp):
            r_sug = client.get("/api/geocode/suggest?q=142+Le+Van+Viet", headers=auth_headers)
            assert r_sug.status_code == 200
            sug_data = r_sug.json()
            assert len(sug_data["suggestions"]) == 1
            assert sug_data["suggestions"][0]["magicKey"] == "abc123magic"
            assert "VNM" not in sug_data["suggestions"][0]["text"]

        reverse_resp = MagicMock()
        reverse_resp.status_code = 200
        reverse_resp.json.return_value = {
            "address": {
                "LongLabel": "142 Đường Lê Văn Việt, Tăng Nhơn Phú, Hồ Chí Minh, 71206, VNM"
            }
        }

        with patch("httpx.AsyncClient.get", return_value=reverse_resp):
            r_rev = client.get("/api/geocode/reverse?lat=10.844915&lng=106.780327", headers=auth_headers)
            assert r_rev.status_code == 200
            assert "142 Đường Lê Văn Việt" in r_rev.json()["address"]

        # Tọa độ ngoài phạm vi hợp lệ -> 400
        r_bad = client.get("/api/geocode/reverse?lat=999&lng=106.78", headers=auth_headers)
        assert r_bad.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)

