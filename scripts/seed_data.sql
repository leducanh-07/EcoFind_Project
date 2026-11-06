-- =============================================================================
-- EcoFind - SecondHand Map Platform
-- Script Seed dữ liệu mẫu: Danh mục & Tài khoản Admin tạo sẵn (Task STT 4 - Ngày 2 - Sprint 1)
-- Tuân thủ tài liệu SRS mục 2.5, SDD mục 6.1, UC-01, NFR-SEC-01
--
-- Đặc tả kỹ thuật:
-- 1. Idempotency: Có thể chạy lặp lại nhiều lần không lỗi (dùng ON CONFLICT).
-- 2. Tối thiểu 6 danh mục cơ bản (Nội thất, Điện tử, Sách, Quần áo, Gia dụng, Thể thao...).
-- 3. Tạo sẵn 1 tài khoản vai trò Admin, mật khẩu băm bằng chuẩn bcrypt (Cost factor 12).
--    Thông tin đăng nhập mặc định:
--      - Email: admin@ecofind.vn
--      - Mật khẩu gốc: Admin@123
-- 4. Đảm bảo UTF-8 cho dữ liệu tiếng Việt.
-- =============================================================================

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- 1. Seed danh mục sản phẩm (Categories) - Tối thiểu 6 danh mục
-- -----------------------------------------------------------------------------
INSERT INTO categories (name) VALUES
    ('Nội thất'),
    ('Đồ điện tử'),
    ('Sách & Văn phòng phẩm'),
    ('Quần áo & Thời trang'),
    ('Đồ gia dụng'),
    ('Thể thao & Dã ngoại'),
    ('Mẹ & Bé')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Seed tài khoản Admin tạo sẵn (Users: role = 'admin')
-- Mật khẩu gốc: Admin@123
-- Hash Bcrypt ($2b$12$E0YlZVFAveSBIOIjARbD5.iiHmD0T1FWg5T6/iLxb/sDIxnaWu68K)
-- -----------------------------------------------------------------------------
INSERT INTO users (
    full_name,
    email,
    phone,
    password_hash,
    role,
    failed_attempts,
    locked_until
) VALUES (
    'Quản trị viên Hệ thống',
    'admin@ecofind.vn',
    '0901234567',
    '$2b$12$E0YlZVFAveSBIOIjARbD5.iiHmD0T1FWg5T6/iLxb/sDIxnaWu68K',
    'admin',
    0,
    NULL
)
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash;
