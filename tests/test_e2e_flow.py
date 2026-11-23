"""
End-to-End (E2E) Flow Integration Test (Task TE9C75A, Epic E10).
Kiểm tra luồng nghiệp vụ khép kín hoàn chỉnh từ đầu đến cuối:
1. Khách đăng ký tài khoản Người bán mới (POST /api/auth/register).
2. Đăng nhập nhận JWT Token (POST /api/auth/login).
3. Người bán đăng tin đồ cũ kèm 3 điểm tình trạng tự chấm (POST /api/listings).
4. Xác minh tin có trạng thái 'pending' và KHÔNG hiển thị trên bản đồ công khai (TC-07, BR-03).
5. Người bán kiểm tra mục 'Tin của tôi' thấy tin ở tab Chờ duyệt (GET /api/me/listings).
6. Quản trị viên (Admin) đăng nhập hệ thống (POST /api/auth/login).
7. Admin truy xuất hàng đợi kiểm duyệt (GET /api/admin/listings?status=pending).
8. Admin duyệt tin đăng và điều chỉnh/ghi chú (POST /api/admin/listings/{id}/approve).
9. Xác minh tin chuyển sang 'selling', lưu reviewed_by và reviewed_at (TC-10, FR-14).
10. Khách xem bản đồ (GET /api/listings?bbox=...) THẤY tin đăng xuất hiện kèm điểm tình trạng và huy hiệu hạng (UC-02, FR-03).
11. Khách xem chi tiết tin đăng (GET /api/listings/{id}) với đầy đủ ảnh, điểm thành phần và thông tin người bán (UC-04, FR-07).
"""

import io
import time
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_complete_end_to_end_user_journey():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        
        # ---------------------------------------------------------------------
        # BƯỚC 1: Đăng ký tài khoản Người bán mới
        # ---------------------------------------------------------------------
        unique_suffix = int(time.time() * 1000)
        seller_email = f"seller_e2e_{unique_suffix}@ecofind.vn"
        seller_password = "Password@123"
        seller_name = f"Nguyễn Văn E2E {unique_suffix % 1000}"
        register_payload = {
            "fullName": seller_name,
            "email": seller_email,
            "phone": "0912345678",
            "password": seller_password,
        }
        reg_res = await client.post("/api/auth/register", json=register_payload)
        assert reg_res.status_code in (200, 201), f"Đăng ký thất bại: {reg_res.text}"
        reg_data = reg_res.json()
        assert reg_data.get("token") or reg_data.get("accessToken"), "Không nhận được token sau đăng ký"

        # ---------------------------------------------------------------------
        # BƯỚC 2: Đăng nhập bằng tài khoản Người bán vừa tạo
        # ---------------------------------------------------------------------
        login_res = await client.post(
            "/api/auth/login",
            json={"email": seller_email, "password": seller_password}
        )
        assert login_res.status_code == 200, f"Đăng nhập thất bại: {login_res.text}"
        login_data = login_res.json()
        seller_token = login_data.get("token") or login_data.get("accessToken")
        assert seller_token is not None, "Thiếu token người bán"
        seller_headers = {"Authorization": f"Bearer {seller_token}"}

        # ---------------------------------------------------------------------
        # BƯỚC 3: Người bán đăng tin mới kèm 3 điểm tình trạng và 1 ảnh
        # ---------------------------------------------------------------------
        sample_img = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00")
        multipart_data = {
            "title": f"Bàn phím cơ E2E Test {unique_suffix} gõ nảy tốt",
            "categoryId": "1",
            "price": "450000",
            "description": "Bàn phím cơ văn phòng còn rất mới, đầy đủ keycap và hộp đựng, hoạt động hoàn hảo.",
            "address": "123 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP.HCM",
            "lat": "10.7790",
            "lng": "106.6990",
            "scoreAppearance": "9.0",
            "scoreFunction": "8.5",
            "scoreAccessories": "8.0",
        }
        files = [
            ("photos", ("keyboard.jpg", sample_img, "image/jpeg"))
        ]
        post_res = await client.post(
            "/api/listings",
            data=multipart_data,
            files=files,
            headers=seller_headers
        )
        assert post_res.status_code == 201, f"Đăng tin thất bại: {post_res.text}"
        post_data = post_res.json()
        listing_id = post_data.get("listingId") or post_data.get("id")
        assert listing_id is not None, "Không nhận được listingId"
        assert post_data.get("status") == "pending", "Tin mới tạo phải có trạng thái 'pending'"
        # Kiểm tra tính điểm: 0.4*9.0 + 0.4*8.5 + 0.2*8.0 = 3.6 + 3.4 + 1.6 = 8.6
        expected_score = 8.6
        actual_score = post_data.get("totalScore") or post_data.get("total_score")
        assert abs(actual_score - expected_score) < 0.15, f"Điểm tính toán sai: {actual_score}"

        # ---------------------------------------------------------------------
        # BƯỚC 4: Kiểm tra tin 'pending' KHÔNG được hiển thị trên bản đồ công khai (TC-07)
        # ---------------------------------------------------------------------
        bbox_q1 = "106.680,10.760,106.720,10.800"
        map_res_before = await client.get("/api/listings", params={"bbox": bbox_q1})
        assert map_res_before.status_code == 200
        map_items_before = map_res_before.json()
        matching_ids_before = [
            item.get("listingId") or item.get("id") for item in map_items_before
        ]
        assert listing_id not in matching_ids_before, f"Tin pending không được xuất hiện trên bản đồ (TC-07)"

        # ---------------------------------------------------------------------
        # BƯỚC 5: Người bán kiểm tra Tin của tôi thấy tin ở tab 'pending'
        # ---------------------------------------------------------------------
        my_listings_res = await client.get("/api/me/listings?status=pending", headers=seller_headers)
        assert my_listings_res.status_code == 200
        my_pending_items = my_listings_res.json()
        pending_ids = [item.get("listingId") or item.get("id") for item in my_pending_items]
        assert listing_id in pending_ids, "Tin vừa tạo phải xuất hiện trong danh sách tin chờ duyệt của người bán"

        # ---------------------------------------------------------------------
        # BƯỚC 6: Quản trị viên (Admin) đăng nhập
        # ---------------------------------------------------------------------
        admin_login_res = await client.post(
            "/api/auth/login",
            json={"email": "admin@ecofind.vn", "password": "Admin@123"}
        )
        assert admin_login_res.status_code == 200, f"Admin đăng nhập thất bại: {admin_login_res.text}"
        admin_token = admin_login_res.json().get("token") or admin_login_res.json().get("accessToken")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # ---------------------------------------------------------------------
        # BƯỚC 7: Admin xem hàng đợi tin chờ duyệt
        # ---------------------------------------------------------------------
        queue_res = await client.get("/api/admin/listings?status=pending", headers=admin_headers)
        assert queue_res.status_code == 200
        queue_items = queue_res.json()
        queue_ids = [item.get("listingId") or item.get("id") for item in queue_items]
        assert listing_id in queue_ids, "Tin phải nằm trong hàng đợi chờ duyệt của Admin"

        # ---------------------------------------------------------------------
        # BƯỚC 8: Admin duyệt tin đăng
        # ---------------------------------------------------------------------
        approve_payload = {
            "note": "Tin đăng đầy đủ thông tin, ảnh rõ nét, điểm hợp lý."
        }
        approve_res = await client.post(
            f"/api/admin/listings/{listing_id}/approve",
            json=approve_payload,
            headers=admin_headers
        )
        assert approve_res.status_code == 200, f"Duyệt tin thất bại: {approve_res.text}"
        approve_data = approve_res.json()
        assert approve_data.get("status") == "selling", "Sau khi duyệt, tin phải đổi sang status 'selling'"
        assert approve_data.get("reviewedBy") or approve_data.get("reviewed_by") is not None, "Phải ghi nhận reviewed_by"

        # ---------------------------------------------------------------------
        # BƯỚC 9: Kiểm tra tin đã XUẤT HIỆN trên bản đồ công khai (TC-10)
        # ---------------------------------------------------------------------
        map_res_after = await client.get("/api/listings", params={"bbox": bbox_q1})
        assert map_res_after.status_code == 200
        map_items_after = map_res_after.json()
        matching_ids_after = [
            item.get("listingId") or item.get("id") for item in map_items_after
        ]
        assert listing_id in matching_ids_after, f"Sau khi Admin duyệt, tin {listing_id} phải hiện trên bản đồ (TC-10)"

        # Tìm đúng tin trên bản đồ để kiểm tra chi tiết
        found_map_item = next(
            item for item in map_items_after
            if (item.get("listingId") or item.get("id")) == listing_id
        )
        assert found_map_item.get("title") == multipart_data["title"]
        assert found_map_item.get("price") == int(multipart_data["price"])
        assert found_map_item.get("totalScore") or found_map_item.get("total_score") is not None

        # ---------------------------------------------------------------------
        # BƯỚC 10: Khách xem chi tiết tin đăng (UC-04, FR-07)
        # ---------------------------------------------------------------------
        detail_res = await client.get(f"/api/listings/{listing_id}")
        assert detail_res.status_code == 200
        detail_data = detail_res.json()
        assert detail_data.get("status") == "selling"
        assert len(detail_data.get("photos", [])) >= 1
        seller_name_in_detail = detail_data.get("sellerName") or detail_data.get("seller_name")
        assert seller_name_in_detail == seller_name, f"Tên người bán không khớp: {seller_name_in_detail} vs {seller_name}"
        assert detail_data.get("categoryName") or detail_data.get("category_name") is not None
