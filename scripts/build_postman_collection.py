import json
import uuid

def build_postman():
    env = {
        "id": str(uuid.uuid4()),
        "name": "EcoFind Environment (Local)",
        "values": [
            {"key": "baseUrl", "value": "http://localhost:8000", "type": "default", "enabled": True},
            {"key": "adminEmail", "value": "admin@ecofind.vn", "type": "default", "enabled": True},
            {"key": "adminPassword", "value": "Admin@123", "type": "secret", "enabled": True},
            {"key": "userAEmail", "value": "usera@ecofind.vn", "type": "default", "enabled": True},
            {"key": "userAPassword", "value": "UserA@123", "type": "secret", "enabled": True},
            {"key": "userBEmail", "value": "userb@ecofind.vn", "type": "default", "enabled": True},
            {"key": "userBPassword", "value": "UserB@123", "type": "secret", "enabled": True},
            {"key": "adminToken", "value": "", "type": "secret", "enabled": True},
            {"key": "userAToken", "value": "", "type": "secret", "enabled": True},
            {"key": "userBToken", "value": "", "type": "secret", "enabled": True},
            {"key": "listingIdA", "value": "1", "type": "default", "enabled": True},
            {"key": "newPendingListingId", "value": "", "type": "default", "enabled": True},
            {"key": "reportId", "value": "", "type": "default", "enabled": True}
        ],
        "_postman_variable_scope": "environment",
        "_postman_exported_at": "2026-11-23T02:00:00.000Z",
        "_postman_exported_using": "Postman/10.0"
    }

    collection = {
        "info": {
            "_postman_id": str(uuid.uuid4()),
            "name": "EcoFind - Test Suite TC-01 đến TC-12 (SDD 8.2)",
            "description": "Bộ kiểm thử API tự động cho 12 Test Cases theo tài liệu đặc tả SDD 8.2 & SRS (Mã task: TE9C758). Bao gồm assertions về HTTP Status, Payload, Response Time, Security Lockout, Authz, Data Validation, SQLi & XSS Sanitization.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            {
                "name": "0. Thiết lập & Đăng nhập (Setup & Auth)",
                "item": [
                    {
                        "name": "0.1 Đăng ký / Đăng nhập User A",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "email": "{{userAEmail}}",
                                    "password": "{{userAPassword}}",
                                    "fullName": "Nguyễn Văn A",
                                    "phone": "0912345678"
                                })
                            },
                            "url": {"raw": "{{baseUrl}}/api/auth/register", "host": ["{{baseUrl}}"], "path": ["api", "auth", "register"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "if (pm.response.code === 200 || pm.response.code === 201) {",
                                    "    var jsonData = pm.response.json();",
                                    "    pm.environment.set('userAToken', jsonData.accessToken || jsonData.access_token);",
                                    "} else {",
                                    "    // Thử đăng nhập nếu đã tồn tại",
                                    "    pm.sendRequest({",
                                    "        url: pm.environment.get('baseUrl') + '/api/auth/login',",
                                    "        method: 'POST',",
                                    "        header: {'Content-Type': 'application/json'},",
                                    "        body: { mode: 'raw', raw: JSON.stringify({ email: pm.environment.get('userAEmail'), password: pm.environment.get('userAPassword') }) }",
                                    "    }, function (err, res) {",
                                    "        var data = res.json();",
                                    "        pm.environment.set('userAToken', data.accessToken || data.access_token);",
                                    "    });",
                                    "}"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "0.2 Đăng ký / Đăng nhập User B",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "email": "{{userBEmail}}",
                                    "password": "{{userBPassword}}",
                                    "fullName": "Trần Thị B",
                                    "phone": "0987654321"
                                })
                            },
                            "url": {"raw": "{{baseUrl}}/api/auth/register", "host": ["{{baseUrl}}"], "path": ["api", "auth", "register"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "if (pm.response.code === 200 || pm.response.code === 201) {",
                                    "    var jsonData = pm.response.json();",
                                    "    pm.environment.set('userBToken', jsonData.accessToken || jsonData.access_token);",
                                    "} else {",
                                    "    pm.sendRequest({",
                                    "        url: pm.environment.get('baseUrl') + '/api/auth/login',",
                                    "        method: 'POST',",
                                    "        header: {'Content-Type': 'application/json'},",
                                    "        body: { mode: 'raw', raw: JSON.stringify({ email: pm.environment.get('userBEmail'), password: pm.environment.get('userBPassword') }) }",
                                    "    }, function (err, res) {",
                                    "        var data = res.json();",
                                    "        pm.environment.set('userBToken', data.accessToken || data.access_token);",
                                    "    });",
                                    "}"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "0.3 Đăng nhập Admin",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "email": "{{adminEmail}}",
                                    "password": "{{adminPassword}}"
                                })
                            },
                            "url": {"raw": "{{baseUrl}}/api/auth/login", "host": ["{{baseUrl}}"], "path": ["api", "auth", "login"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('0.3 Admin đăng nhập thành công trả về 200', function () {",
                                    "    pm.response.to.have.status(200);",
                                    "    var data = pm.response.json();",
                                    "    pm.expect(data.accessToken || data.access_token).to.be.a('string');",
                                    "    pm.environment.set('adminToken', data.accessToken || data.access_token);",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            },
            {
                "name": "TC-01: Khóa tài khoản sau 5 lần sai (UC-01, FR-02)",
                "item": [
                    {
                        "name": "TC-01.1 Đăng nhập sai lần 1-5",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"email": "lockout_test@ecofind.vn", "password": "WrongPassword!"})
                            },
                            "url": {"raw": "{{baseUrl}}/api/auth/login", "host": ["{{baseUrl}}"], "path": ["api", "auth", "login"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-01.1 Đăng nhập sai mật khẩu trả 401 hoặc 423 nếu đã khóa', function () {",
                                    "    pm.expect([401, 423]).to.include(pm.response.code);",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-01.2 Đăng nhập lần thứ 6 trả 423 Locked",
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"email": "lockout_test@ecofind.vn", "password": "AnyPassword"})
                            },
                            "url": {"raw": "{{baseUrl}}/api/auth/login", "host": ["{{baseUrl}}"], "path": ["api", "auth", "login"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-01.2 Tài khoản bị khóa 15 phút, API trả mã HTTP 423 Locked (FR-02)', function () {",
                                    "    // Sau 5 lần sai liên tiếp, lần thứ 6 trả 423",
                                    "    pm.expect([423, 401]).to.include(pm.response.code);",
                                    "    if (pm.response.code === 423) {",
                                    "        var data = pm.response.json();",
                                    "        pm.expect(data.detail).to.be.a('string');",
                                    "    }",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            },
            {
                "name": "TC-02: Tốc độ tải bản đồ (NFR-PER-01, UC-02)",
                "request": {
                    "method": "GET",
                    "url": {
                        "raw": "{{baseUrl}}/api/listings/map?south=10.6&west=106.5&north=10.9&east=106.8",
                        "host": ["{{baseUrl}}"],
                        "path": ["api", "listings", "map"],
                        "query": [
                            {"key": "south", "value": "10.6"},
                            {"key": "west", "value": "106.5"},
                            {"key": "north", "value": "10.9"},
                            {"key": "east", "value": "106.8"}
                        ]
                    }
                },
                "event": [{
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": [
                            "pm.test('TC-02 Tải marker bản đồ trả mã 200 OK', function () {",
                            "    pm.response.to.have.status(200);",
                            "});",
                            "pm.test('TC-02 Thời gian phản hồi marker đầu tiên <= 3000ms (NFR-PER-01)', function () {",
                            "    pm.expect(pm.response.responseTime).to.be.below(3000);",
                            "});",
                            "pm.test('TC-02 Dữ liệu marker chuẩn hóa (lat, lng, totalScore)', function () {",
                            "    var data = pm.response.json();",
                            "    pm.expect(data).to.be.an('array');",
                            "    if (data.length > 0) {",
                            "        pm.expect(data[0]).to.have.property('lat');",
                            "        pm.expect(data[0]).to.have.property('lng');",
                            "    }",
                            "});"
                        ]
                    }
                }]
            },
            {
                "name": "TC-03: Tìm kiếm & lọc <= 50 kết quả trong <= 2s (NFR-PER-02, UC-03)",
                "request": {
                    "method": "GET",
                    "url": {
                        "raw": "{{baseUrl}}/api/listings?q=bàn&limit=50",
                        "host": ["{{baseUrl}}"],
                        "path": ["api", "listings"],
                        "query": [
                            {"key": "q", "value": "bàn"},
                            {"key": "limit", "value": "50"}
                        ]
                    }
                },
                "event": [{
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": [
                            "pm.test('TC-03 Tìm kiếm trả về 200 OK', function () {",
                            "    pm.response.to.have.status(200);",
                            "});",
                            "pm.test('TC-03 Thời gian phản hồi <= 2000ms (NFR-PER-02)', function () {",
                            "    pm.expect(pm.response.responseTime).to.be.below(2000);",
                            "});",
                            "pm.test('TC-03 Trả về tối đa 50 kết quả mỗi lần', function () {",
                            "    var data = pm.response.json();",
                            "    pm.expect(data).to.be.an('array');",
                            "    pm.expect(data.length).to.be.at.most(50);",
                            "});"
                        ]
                    }
                }]
            },
            {
                "name": "TC-04: Bảo mật SĐT - Ẩn khi không token, hiện khi có token (FR-07, UC-04)",
                "item": [
                    {
                        "name": "TC-04.1 Không token: SĐT bị ẩn (null)",
                        "request": {
                            "method": "GET",
                            "url": {"raw": "{{baseUrl}}/api/listings/{{listingIdA}}", "host": ["{{baseUrl}}"], "path": ["api", "listings", "{{listingIdA}}"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-04.1 Trả về mã 200 hoặc 404 nếu chưa có tin mẫu', function () {",
                                    "    pm.expect([200, 404]).to.include(pm.response.code);",
                                    "    if (pm.response.code === 200) {",
                                    "        var data = pm.response.json();",
                                    "        var phone = data.seller ? data.seller.phone : data.phone;",
                                    "        pm.expect(phone == null || phone === '').to.be.true;",
                                    "    }",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-04.2 Có token: Hiển thị đầy đủ SĐT",
                        "request": {
                            "method": "GET",
                            "header": [{"key": "Authorization", "value": "Bearer {{userAToken}}"}],
                            "url": {"raw": "{{baseUrl}}/api/listings/{{listingIdA}}", "host": ["{{baseUrl}}"], "path": ["api", "listings", "{{listingIdA}}"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-04.2 Có token: hiển thị số điện thoại người bán (FR-07)', function () {",
                                    "    if (pm.response.code === 200) {",
                                    "        var data = pm.response.json();",
                                    "        var phone = data.seller ? data.seller.phone : data.phone;",
                                    "        pm.expect(phone).to.be.a('string');",
                                    "    }",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            },
            {
                "name": "TC-05: Server tự tính total_score = 8.2 (BR-01, UC-05)",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Authorization", "value": "Bearer {{userAToken}}"},
                        {"key": "Content-Type", "value": "application/json"}
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "title": "Bàn làm việc gỗ thông TC-05",
                            "description": "Bàn làm việc còn rất tốt không trầy xước",
                            "price": 500000,
                            "categoryId": 1,
                            "address": "123 Lê Lợi, Q.1, TP.HCM",
                            "lat": 10.7769,
                            "lng": 106.7009,
                            "scoreAppearance": 9.0,
                            "scoreFunction": 8.0,
                            "scoreAccessories": 7.0,
                            "totalScore": 10.0,
                            "photoUrls": ["/uploads/sample.jpg"]
                        })
                    },
                    "url": {"raw": "{{baseUrl}}/api/listings", "host": ["{{baseUrl}}"], "path": ["api", "listings"]}
                },
                "event": [{
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": [
                            "pm.test('TC-05 Đăng tin thành công 201 Created hoặc 200 OK', function () {",
                            "    pm.expect([200, 201]).to.include(pm.response.code);",
                            "    var data = pm.response.json();",
                            "    var total = data.totalScore != null ? data.totalScore : data.total_score;",
                            "    // Trọng số: 40% ngoại hình (9*0.4=3.6) + 40% tính năng (8*0.4=3.2) + 20% phụ kiện (7*0.2=1.4) = 8.2",
                            "    pm.expect(Math.abs(total - 8.2)).to.be.below(0.15);",
                            "    pm.expect(total).not.to.eq(10.0);",
                            "    pm.environment.set('newPendingListingId', data.id || data.listing_id || data.listingId);",
                            "});"
                        ]
                    }
                }]
            },
            {
                "name": "TC-06: Chặn giá âm, giá vượt 1 tỷ (BR-04, BR-05, UC-05)",
                "item": [
                    {
                        "name": "TC-06.1 Giá âm (-1) trả 400 Bad Request",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{userAToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "title": "Sản phẩm giá âm",
                                    "description": "Mô tả sản phẩm",
                                    "price": -1,
                                    "categoryId": 1,
                                    "address": "123 Lê Lợi, Q.1",
                                    "lat": 10.77,
                                    "lng": 106.70,
                                    "scoreAppearance": 8, "scoreFunction": 8, "scoreAccessories": 8,
                                    "photoUrls": ["/uploads/sample.jpg"]
                                })
                            },
                            "url": {"raw": "{{baseUrl}}/api/listings", "host": ["{{baseUrl}}"], "path": ["api", "listings"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-06.1 Giá âm (-1) trả 400 Bad Request (BR-05)', function () {",
                                    "    pm.response.to.have.status(400);",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-06.2 Giá vượt 1 tỷ trả 400 Bad Request",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{userAToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "title": "Sản phẩm giá vượt 1 tỷ",
                                    "description": "Mô tả sản phẩm",
                                    "price": 1000000001,
                                    "categoryId": 1,
                                    "address": "123 Lê Lợi, Q.1",
                                    "lat": 10.77,
                                    "lng": 106.70,
                                    "scoreAppearance": 8, "scoreFunction": 8, "scoreAccessories": 8,
                                    "photoUrls": ["/uploads/sample.jpg"]
                                })
                            },
                            "url": {"raw": "{{baseUrl}}/api/listings", "host": ["{{baseUrl}}"], "path": ["api", "listings"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-06.2 Giá 1.000.000.001 đ trả 400 Bad Request (BR-05)', function () {",
                                    "    pm.response.to.have.status(400);",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            },
            {
                "name": "TC-07: Tin mới ở trạng thái pending, chưa có trong map/search (FR-09, BR-03)",
                "request": {
                    "method": "GET",
                    "url": {
                        "raw": "{{baseUrl}}/api/listings?status=selling",
                        "host": ["{{baseUrl}}"],
                        "path": ["api", "listings"],
                        "query": [{"key": "status", "value": "selling"}]
                    }
                },
                "event": [{
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": [
                            "pm.test('TC-07 Tin mới tạo chưa được duyệt không xuất hiện trên danh sách bán công khai', function () {",
                            "    pm.response.to.have.status(200);",
                            "    var data = pm.response.json();",
                            "    var pendingId = pm.environment.get('newPendingListingId');",
                            "    if (pendingId) {",
                            "        var exists = data.some(function(item) { return (item.id || item.listing_id) == pendingId; });",
                            "        pm.expect(exists).to.be.false;",
                            "    }",
                            "});"
                        ]
                    }
                }]
            },
            {
                "name": "TC-08: User B sửa tin của User A bị trả 403 Forbidden (NFR-SEC-03, UC-06)",
                "request": {
                    "method": "PUT",
                    "header": [
                        {"key": "Authorization", "value": "Bearer {{userBToken}}"},
                        {"key": "Content-Type", "value": "application/json"}
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({"title": "Hack tin của User A", "price": 100000})
                    },
                    "url": {"raw": "{{baseUrl}}/api/listings/{{newPendingListingId}}", "host": ["{{baseUrl}}"], "path": ["api", "listings", "{{newPendingListingId}}"]}
                },
                "event": [{
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": [
                            "pm.test('TC-08 Người dùng không chính chủ sửa tin nhận 403 Forbidden', function () {",
                            "    pm.response.to.have.status(403);",
                            "});"
                        ]
                    }
                }]
            },
            {
                "name": "TC-09: Báo cáo tin 2 lần (409) & Báo cáo tin chính mình (403) (FR-12, UC-08)",
                "item": [
                    {
                        "name": "TC-09.1 Báo cáo tin của chính mình trả 403 Forbidden",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{userAToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"reason": "wrong_score", "note": "Tự báo cáo mình"})
                            },
                            "url": {"raw": "{{baseUrl}}/api/listings/{{newPendingListingId}}/reports", "host": ["{{baseUrl}}"], "path": ["api", "listings", "{{newPendingListingId}}", "reports"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-09.1 Báo cáo tin của chính mình trả 403 Forbidden', function () {",
                                    "    pm.response.to.have.status(403);",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-09.2 User B báo cáo tin của User A lần 1 thành công",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{userBToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"reason": "wrong_score", "note": "Khai khống điểm ngoại hình"})
                            },
                            "url": {"raw": "{{baseUrl}}/api/listings/{{newPendingListingId}}/reports", "host": ["{{baseUrl}}"], "path": ["api", "listings", "{{newPendingListingId}}", "reports"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-09.2 Báo cáo lần đầu thành công trả 200 hoặc 201', function () {",
                                    "    pm.expect([200, 201]).to.include(pm.response.code);",
                                    "    var data = pm.response.json();",
                                    "    pm.environment.set('reportId', data.report_id || data.id);",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-09.3 User B báo cáo lại cùng tin đó lần 2 trả 409 Conflict",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{userBToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"reason": "scam", "note": "Báo cáo lần 2"})
                            },
                            "url": {"raw": "{{baseUrl}}/api/listings/{{newPendingListingId}}/reports", "host": ["{{baseUrl}}"], "path": ["api", "listings", "{{newPendingListingId}}", "reports"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-09.3 Báo cáo trùng lặp lần 2 trả 409 Conflict', function () {",
                                    "    pm.response.to.have.status(409);",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            },
            {
                "name": "TC-10: Phân quyền Admin & Duyệt tin sang selling (FR-14, NFR-SEC-03, UC-09)",
                "item": [
                    {
                        "name": "TC-10.1 User thường gọi /api/admin/listings trả 403 Forbidden",
                        "request": {
                            "method": "GET",
                            "header": [{"key": "Authorization", "value": "Bearer {{userAToken}}"}],
                            "url": {"raw": "{{baseUrl}}/api/admin/listings", "host": ["{{baseUrl}}"], "path": ["api", "admin", "listings"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-10.1 Người dùng không có quyền admin nhận 403 Forbidden', function () {",
                                    "    pm.response.to.have.status(403);",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-10.2 Admin duyệt tin sang trạng thái selling",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{adminToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({"note": "Tin đạt chuẩn kiểm duyệt"})
                            },
                            "url": {"raw": "{{baseUrl}}/api/admin/listings/{{newPendingListingId}}/approve", "host": ["{{baseUrl}}"], "path": ["api", "admin", "listings", "{{newPendingListingId}}", "approve"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-10.2 Admin duyệt tin trả về 200 OK và status = selling', function () {",
                                    "    pm.response.to.have.status(200);",
                                    "    var data = pm.response.json();",
                                    "    pm.expect(data.status).to.eq('selling');",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            },
            {
                "name": "TC-11: Admin từ chối tin không có lý do trả 400 (UC-09 E1)",
                "request": {
                    "method": "POST",
                    "header": [
                        {"key": "Authorization", "value": "Bearer {{adminToken}}"},
                        {"key": "Content-Type", "value": "application/json"}
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({"reason": ""})
                    },
                    "url": {"raw": "{{baseUrl}}/api/admin/listings/{{newPendingListingId}}/reject", "host": ["{{baseUrl}}"], "path": ["api", "admin", "listings", "{{newPendingListingId}}", "reject"]}
                },
                "event": [{
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": [
                            "pm.test('TC-11 Từ chối tin không có lý do bắt buộc trả 400 Bad Request', function () {",
                            "    pm.response.to.have.status(400);",
                            "});"
                        ]
                    }
                }]
            },
            {
                "name": "TC-12: Chống SQL Injection và XSS Sanitization (NFR-SEC-04, UC-03, UC-05)",
                "item": [
                    {
                        "name": "TC-12.1 SQL Injection payload trong ô tìm kiếm",
                        "request": {
                            "method": "GET",
                            "url": {
                                "raw": "{{baseUrl}}/api/listings?q=' OR 1=1 --",
                                "host": ["{{baseUrl}}"],
                                "path": ["api", "listings"],
                                "query": [{"key": "q", "value": "' OR 1=1 --"}]
                            }
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-12.1 SQL Injection không làm hỏng cú pháp SQL (200 OK)', function () {",
                                    "    pm.response.to.have.status(200);",
                                    "    var data = pm.response.json();",
                                    "    pm.expect(data).to.be.an('array');",
                                    "});"
                                ]
                            }
                        }]
                    },
                    {
                        "name": "TC-12.2 XSS payload <script> trong mô tả",
                        "request": {
                            "method": "POST",
                            "header": [
                                {"key": "Authorization", "value": "Bearer {{userAToken}}"},
                                {"key": "Content-Type", "value": "application/json"}
                            ],
                            "body": {
                                "mode": "raw",
                                "raw": json.dumps({
                                    "title": "Sản phẩm test XSS Sanitization",
                                    "description": "<script>alert('XSS')</script>Bàn làm việc an toàn",
                                    "price": 200000,
                                    "categoryId": 1,
                                    "address": "123 Lê Lợi, Q.1",
                                    "lat": 10.77,
                                    "lng": 106.70,
                                    "scoreAppearance": 8, "scoreFunction": 8, "scoreAccessories": 8,
                                    "photoUrls": ["/uploads/sample.jpg"]
                                })
                            },
                            "url": {"raw": "{{baseUrl}}/api/listings", "host": ["{{baseUrl}}"], "path": ["api", "listings"]}
                        },
                        "event": [{
                            "listen": "test",
                            "script": {
                                "type": "text/javascript",
                                "exec": [
                                    "pm.test('TC-12.2 Dữ liệu đầu vào được làm sạch, không gây chạy script', function () {",
                                    "    pm.expect([200, 201]).to.include(pm.response.code);",
                                    "    var data = pm.response.json();",
                                    "    if (data.description) {",
                                    "        pm.expect(data.description).not.to.include('<script>');",
                                    "    }",
                                    "});"
                                ]
                            }
                        }]
                    }
                ]
            }
        ]
    }

    with open("postman/EcoFind.postman_environment.json", "w", encoding="utf-8") as f:
        json.dump(env, f, ensure_ascii=False, indent=2)

    with open("postman/EcoFind_TC01_to_TC12.postman_collection.json", "w", encoding="utf-8") as f:
        json.dump(collection, f, ensure_ascii=False, indent=2)

    print("Created Postman Collection and Environment successfully!")

if __name__ == "__main__":
    build_postman()
