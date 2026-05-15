# API reference

Base URL: `http://localhost:4000` (dev) — Swagger UI: `/docs`.

All authenticated endpoints expect `Authorization: Bearer <accessToken>`.

## Auth

| Method | Path                | Auth | Description                                |
| ------ | ------------------- | ---- | ------------------------------------------ |
| POST   | `/v1/auth/signup`   | —    | Create user (returns access + refresh)     |
| POST   | `/v1/auth/login`    | —    | Email + password → tokens                  |
| POST   | `/v1/auth/refresh`  | —    | Rotate tokens (revokes old refresh)        |
| POST   | `/v1/auth/logout`   | ✓    | Revoke a refresh token                     |
| GET    | `/v1/auth/me`       | ✓    | Current user profile                       |

## Centers

| Method | Path                              | Auth   | Description                          |
| ------ | --------------------------------- | ------ | ------------------------------------ |
| GET    | `/v1/centers`                     | —      | List centers (city, search, page)    |
| GET    | `/v1/centers/:id`                 | —      | Center detail + live status          |
| POST   | `/v1/centers/:id/live-status`     | ADMIN  | Ingest queue snapshot                |

## Predictions

| Method | Path                                                | Auth | Description |
| ------ | --------------------------------------------------- | ---- | ----------- |
| GET    | `/v1/predictions?centerId=&vehicleType=&arrivalTime=` | —  | ML wait-time forecast |

## Slots & Bookings

| Method | Path                                  | Auth | Description                  |
| ------ | ------------------------------------- | ---- | ---------------------------- |
| GET    | `/v1/centers/:id/slots`               | —    | Available time slots         |
| POST   | `/v1/bookings`                        | ✓    | Book a slot (optimistic lock)|
| GET    | `/v1/bookings`                        | ✓    | List own bookings            |
| GET    | `/v1/bookings/:id`                    | ✓    | Booking detail               |
| POST   | `/v1/bookings/:id/cancel`             | ✓    | Cancel booking               |

## Vehicles

| Method | Path                | Auth | Description                       |
| ------ | ------------------- | ---- | --------------------------------- |
| POST   | `/v1/vehicles`      | ✓    | Register a vehicle                |
| GET    | `/v1/vehicles`      | ✓    | List own (or fleet) vehicles      |
| GET    | `/v1/vehicles/:id`  | ✓    | Vehicle detail                    |

## Proxy service (đi đăng kiểm hộ)

| Method | Path                                 | Auth          | Description                |
| ------ | ------------------------------------ | ------------- | -------------------------- |
| POST   | `/v1/proxy-jobs`                     | ✓             | Request proxy inspection   |
| GET    | `/v1/proxy-jobs?role=customer/worker`| ✓             | List jobs                  |
| GET    | `/v1/proxy-jobs/:id`                 | ✓             | Job detail + events        |
| POST   | `/v1/proxy-jobs/:id/assign`          | PROXY_WORKER  | Worker claims job          |
| POST   | `/v1/proxy-jobs/:id/transition`      | ✓             | Drive state machine        |

## Fleet (B2B)

| Method | Path                                       | Auth                | Description                       |
| ------ | ------------------------------------------ | ------------------- | --------------------------------- |
| POST   | `/v1/fleets`                               | ✓                   | Create fleet (caller becomes ADMIN) |
| GET    | `/v1/fleets/me`                            | FLEET_ADMIN, ADMIN  | Fleet info + summary stats        |
| GET    | `/v1/fleets/me/upcoming-expirations`       | FLEET_ADMIN, ADMIN  | Vehicles with expiring tem        |
| POST   | `/v1/fleets/me/members`                    | FLEET_ADMIN, ADMIN  | Add user to fleet                 |

## Payments (VNPay sandbox)

| Method | Path                                | Auth  | Description                                       |
| ------ | ----------------------------------- | ----- | ------------------------------------------------- |
| POST   | `/v1/payments/vnpay/init`           | ✓     | Create payment for a booking → returns VNPay URL  |
| GET    | `/v1/payments/vnpay/return`         | —     | Browser return endpoint (UX only)                 |
| POST   | `/v1/payments/vnpay/ipn`            | —     | Server-to-server IPN (source of truth)            |
| GET    | `/v1/payments/:id`                  | ✓     | Payment status                                    |

Requires `VNPAY_TMN_CODE` + `VNPAY_HASH_SECRET` in env (register at
https://sandbox.vnpayment.vn). When unset, init returns 503.

The IPN follows VNPay PayGate spec — responses use `{RspCode, Message}`. We
implement idempotency (`RspCode: '02'` if already confirmed) and amount
verification (`RspCode: '04'` on mismatch).

## Crowdsourced queue reports

The primary live signal for the ML model. Users at the center submit their
observed queue length; reports within 500m of the center are marked
`verified: true` and feed into a 30-minute weighted average that backs
`CenterLiveStatus.queueLength`.

| Method | Path                                       | Auth | Description                          |
| ------ | ------------------------------------------ | ---- | ------------------------------------ |
| POST   | `/v1/centers/:id/queue-reports`            | ✓    | Submit a report (optional GPS)       |
| GET    | `/v1/centers/:id/queue-reports`            | —    | Recent reports (default 60 min)      |

Rate-limited per-user-per-center at 10 minutes. Unverified reports are kept
for analysis but don't affect live status.

## Health

| Method | Path             | Description                                   |
| ------ | ---------------- | --------------------------------------------- |
| GET    | `/health`        | Liveness — always returns 200 if process up   |
| GET    | `/health/ready`  | Readiness — checks DB + predictor             |

## Error format

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Slot vừa được người khác đặt, vui lòng chọn slot khác",
  "requestId": "01HZX..."
}
```

`requestId` is propagated as `x-request-id` and appears in API logs — include
it when reporting issues.
