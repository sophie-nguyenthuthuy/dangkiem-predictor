# Cơ sở pháp lý

Đăng kiểm xe cơ giới đường bộ ở Việt Nam được điều chỉnh bởi một hệ thống văn bản
khá phức tạp, đã thay đổi mạnh sau khủng hoảng đăng kiểm 2023.

## Văn bản gốc

- **Luật Giao thông đường bộ 2008** (số 23/2008/QH12) — điều 55 quy định nguyên tắc kiểm
  định an toàn kỹ thuật và bảo vệ môi trường.
- **Luật Trật tự, An toàn giao thông đường bộ 2024** (số 36/2024/QH15) — có hiệu lực
  01/01/2025, thay thế phần liên quan của Luật 2008.

## Quy chuẩn kỹ thuật

- **QCVN 09:2015/BGTVT** — Quy chuẩn kỹ thuật quốc gia về chất lượng an toàn kỹ thuật và
  bảo vệ môi trường đối với xe ô tô.

## Thông tư trực tiếp về đăng kiểm

- **TT 16/2021/TT-BGTVT** (12/08/2021) — Quy định về kiểm định an toàn kỹ thuật và
  bảo vệ môi trường phương tiện giao thông cơ giới đường bộ. **Văn bản nền tảng**.
- **TT 02/2023/TT-BGTVT** (22/03/2023) — Sửa đổi, bổ sung TT 16/2021. Là phản ứng đầu tiên
  của Bộ GTVT với khủng hoảng. Đáng chú ý: **miễn kiểm định lần đầu** với ô tô con không
  kinh doanh vận tải dưới 9 chỗ, và **kéo dài chu kỳ kiểm định** cho một số loại xe.
- **TT 08/2023/TT-BGTVT** (02/06/2023) — Sửa đổi tiếp, chuẩn hóa quy trình ngăn ngừa
  tiêu cực.

## Phí và lệ phí

- **TT 55/2022/TT-BTC** (29/08/2022) — Quy định mức thu, chế độ thu, nộp, quản lý và sử
  dụng phí kiểm định an toàn kỹ thuật và phí cấp giấy chứng nhận. App dùng bảng giá này:
  - Xe con dưới 10 chỗ: 240.000 đ
  - Xe tải, xe khách: 350.000 đ
  - Xe chuyên dùng: 570.000 đ
  - Lệ phí cấp giấy chứng nhận: 50.000 đ

## Chu kỳ kiểm định (sau TT 02/2023)

Xe ô tô con không kinh doanh vận tải dưới 9 chỗ:

| Năm sản xuất | Chu kỳ đầu | Chu kỳ tiếp theo |
| ------------ | ---------- | ---------------- |
| ≤ 7 năm      | 36 tháng   | 24 tháng         |
| 7–12 năm     | 24 tháng   | 12 tháng         |
| 12–17 năm    | 12 tháng   | 12 tháng         |
| > 17 năm     | 12 tháng   | 6 tháng          |

Xe kinh doanh vận tải, xe tải, xe khách: chu kỳ ngắn hơn (chi tiết tại Phụ lục VII TT 16/2021).

## Bối cảnh khủng hoảng 2023

- **Tháng 12/2022 – tháng 04/2023**: Hơn 600 cán bộ đăng kiểm bị khởi tố vì nhận hối lộ,
  giả mạo hồ sơ, "kiểm định khống". Hơn 80 trung tâm tạm dừng hoạt động.
- **Tháng 03/2023**: TP.HCM và Hà Nội chỉ còn ~30-40% công suất kiểm định. Hàng nghìn xe
  xếp hàng từ 4h sáng, chờ 6–12 tiếng.
- **Bộ Quốc phòng (Cục Xe – Máy)** được điều động hỗ trợ kiểm định để giải tỏa.
- **NĐ 30/2023/NĐ-CP** (08/06/2023) sửa đổi NĐ 139/2018/NĐ-CP về điều kiện kinh doanh
  dịch vụ kiểm định, siết chặt giám sát và yêu cầu công khai dữ liệu.

## Hệ quả thiết kế cho app

1. **Backlog vẫn cao ở cuối tháng** — chủ xe để gần hết hạn mới đi → cuối tháng đông.
2. **Cao điểm sau Tết** — Tết đa số đóng cửa, dồn sang Feb/Mar.
3. **Trung tâm xã hội hóa (-V, -D) thường vắng hơn -S** — nhưng ít người biết.
4. **Tem điện tử (e-tem)** đang được triển khai theo TT 02/2024/TT-BGTVT, future-proof
   bằng cách thiết kế `Vehicle.temExpiresAt` thay vì lưu ảnh tem.
5. **Dịch vụ "đi đăng kiểm hộ"** không vi phạm pháp luật nếu có ủy quyền (Bộ luật Dân sự
   điều 562) và xe vẫn được kiểm định trực tiếp tại trung tâm.

## References

- Cục Đăng kiểm Việt Nam: https://www.vr.org.vn
- Hệ thống văn bản: https://vbpl.vn
