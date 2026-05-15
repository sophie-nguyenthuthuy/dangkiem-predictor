# Đăng kiểm Predictor

Dự đoán thời gian chờ tại các trung tâm đăng kiểm xe cơ giới (HN/HCM), đặt slot trước, và dịch vụ "đi đăng kiểm hộ". Hỗ trợ B2B cho fleet (taxi, logistics).

> Bối cảnh: sau khủng hoảng đăng kiểm 2023, người dân phải xếp hàng 6–12 tiếng tại nhiều trung tâm ở Hà Nội và TP.HCM. Mục tiêu của dự án là giúp người dùng tránh xếp hàng vô ích, và giúp fleet vận hành tối ưu lịch đăng kiểm.

## Kiến trúc

```
┌──────────────┐   ┌───────────────┐   ┌──────────────────┐
│  Next.js Web │──▶│   API (TS)    │──▶│  Predictor (Py)  │
│   apps/web   │   │   apps/api    │   │ services/predictor│
└──────────────┘   └──────┬────────┘   └──────────────────┘
                          │
                   ┌──────▼──────┐
                   │ Postgres 16 │
                   └─────────────┘
```

| Service              | Stack                                   | Port |
| -------------------- | --------------------------------------- | ---- |
| `apps/web`           | Next.js 14, Tailwind, TypeScript        | 3000 |
| `apps/api`           | Fastify, Prisma, Postgres, Zod, Pino    | 4000 |
| `services/predictor` | FastAPI, scikit-learn, NumPy            | 8000 |
| `postgres`           | Postgres 16                             | 5432 |

## Tính năng

- **Dự đoán thời gian chờ** theo trung tâm × dây chuyền × giờ × ngày trong tuần, sử dụng gradient boosting + heuristic fallback
- **Đặt slot trước** với optimistic locking để tránh double-booking
- **Dịch vụ đi đăng kiểm hộ** — assign cho proxy worker, theo dõi trạng thái realtime
- **B2B Fleet** — tổ chức quản lý nhiều xe, dashboard lịch đăng kiểm, cảnh báo sắp hết hạn tem
- **Auth** — JWT + refresh token, RBAC (`USER`, `FLEET_ADMIN`, `PROXY_WORKER`, `ADMIN`)
- **Production-ready** — Pino structured logging, rate limiting, Helmet, request ID, graceful shutdown, OpenAPI docs

## Chạy local

```bash
# Yêu cầu: Node 20+, pnpm 9+, Python 3.11+, Docker

pnpm install
docker compose up -d postgres
pnpm --filter @dangkiem/api db:migrate
pnpm --filter @dangkiem/api db:seed

# Chạy tất cả services
pnpm dev
```

- Web: http://localhost:3000
- API docs (Swagger): http://localhost:4000/docs
- Predictor docs: http://localhost:8000/docs

## Chạy bằng Docker

```bash
docker compose up --build
```

## Test

```bash
pnpm test                    # tất cả
pnpm --filter @dangkiem/api test
cd services/predictor && pytest
```

## Cấu trúc thư mục

```
apps/
  api/         # Backend Fastify
  web/         # Frontend Next.js
services/
  predictor/   # ML service FastAPI
packages/
  shared/      # Type/zod schemas dùng chung
infra/         # Dockerfiles, deployment configs
.github/       # CI/CD
```

## Mô hình dự đoán

Predictor service dùng **GradientBoostingRegressor** với features:

- `center_id` (one-hot)
- `lane_type` (xe con, xe tải, xe khách)
- `day_of_week`, `hour_of_day`
- `is_holiday_eve`, `days_to_tem_expiry_peak` (cuối tháng đông hơn)
- `recent_queue_length` (snapshot 15 phút trước)
- `staff_count_today`

Trả về `predicted_wait_minutes` + `confidence_interval_95`. Khi chưa có model trained, fallback dùng baseline heuristic tính từ giờ + ngày trong tuần.

## License

MIT
