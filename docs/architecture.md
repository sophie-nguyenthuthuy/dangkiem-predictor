# Architecture

## Overview

```
┌─────────────────────────┐      ┌─────────────────────────┐
│      Next.js Web        │      │   Mobile (future)       │
│      apps/web           │      │                         │
└──────────┬──────────────┘      └────────────┬────────────┘
           │ HTTPS                            │
           ▼                                  ▼
       ┌────────────────────────────────────────┐
       │      Fastify API  ·  apps/api          │
       │  ─ JWT auth (access + refresh)         │
       │  ─ Optimistic locking for bookings     │
       │  ─ Rate limit · Pino logging · Swagger │
       └──┬──────────────────────────┬──────────┘
          │                          │
          ▼                          ▼
   ┌─────────────┐         ┌──────────────────────┐
   │ Postgres 16 │         │ Predictor (Python)   │
   │  (Prisma)   │         │ services/predictor   │
   └─────────────┘         │ FastAPI + sklearn    │
                           └──────────────────────┘
```

## Service boundaries

| Service                  | Owns                                                |
| ------------------------ | --------------------------------------------------- |
| `apps/api`               | All business logic, auth, persistence, REST surface |
| `apps/web`               | Citizen + fleet UI                                  |
| `services/predictor`     | ML model + feature extraction (stateless)           |
| `packages/shared`        | Type definitions, Zod schemas, VN constants         |

The predictor is intentionally a separate stateless Python process: it lets us iterate
on the model with the Python ML toolchain, keeps the Node API free of heavy native
dependencies, and gracefully degrades to a JS-side heuristic when down.

## Key flows

### Predict wait time

1. Client → `GET /v1/predictions?centerId=...&vehicleType=car`
2. API reads `Center` + latest `CenterLiveStatus`
3. API calls `POST predictor:8000/predict` with features
4. Predictor returns `{ predictedWaitMinutes, lower, upper, confidence }`
5. If predictor times out or errors → API falls back to in-process heuristic
6. Response is **never cached** — wait times shift minute-to-minute

### Book a slot (optimistic locking)

```ts
// In a transaction:
const updated = await tx.slot.updateMany({
  where: { id, version, bookedCount: { lt: capacity } },
  data: { bookedCount: { increment: 1 }, version: { increment: 1 } },
});
if (updated.count !== 1) throw new Conflict('Slot vừa được người khác đặt');
```

This avoids row-level locks under load and gives a friendly retry path.

### Proxy job state machine

```
REQUESTED → ASSIGNED → PICKED_UP → AT_CENTER → INSPECTED → RETURNING → DELIVERED
                                          ↓
                                     CANCELLED (anywhere except DELIVERED)
```

Customer can cancel at any non-terminal state; worker drives forward progress.

## Failure modes considered

| Failure                  | Behavior                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Predictor down           | Heuristic fallback (still uses queue + hour-of-day + dow); response includes `modelVersion: heuristic-v1` |
| Postgres down            | `/health/ready` returns 503; API rejects writes with 500 (caller retries)             |
| Concurrent booking on same slot | Optimistic locking — only one wins, others get 409                            |
| JWT replay after logout  | Refresh token stored hashed, revoked on logout; access token TTL = 15 minutes         |
| Mass burst (DDoS / scrape) | `@fastify/rate-limit` per-IP, helmet defaults, body-size cap                        |

## Data model highlights

See [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma).

- `Center` (trung tâm) ← `Lane` (dây chuyền) — physical inspection bays
- `Center` ← `Slot` (khung giờ) — bookable time windows, hourly
- `Slot` ← `Booking` — with `version` for optimistic concurrency
- `User` belongs to optional `Fleet` (B2B grouping)
- `WaitSample` is the training signal table for model retraining

## Deployment

- Web + API: Docker, ~150MB each; deploy on Cloud Run / Fly.io / DO Apps
- Predictor: separate container; rebuild trained model on each cold start
- Postgres: managed (RDS / Cloud SQL / Supabase)
- For VN-only data residency: VNG Cloud, Viettel IDC, or FPT Cloud
