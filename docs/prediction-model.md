# Wait-time prediction model

## Goal

Given `(center, vehicleType, arrivalTime, queueLength, activeLanes)`, predict the
expected wait time in minutes and a 95% confidence interval.

## Features

Defined in [services/predictor/app/features.py](../services/predictor/app/features.py):

| Feature              | Rationale (VN-specific where noted)                              |
| -------------------- | ----------------------------------------------------------------- |
| `hour_of_day`        | Inspection centers open 7:30, lunch dip 12-13, second peak 15-17 |
| `day_of_week`        | Monday is consistently the worst day                              |
| `day_of_month`       | End-of-month: chủ xe wait until tem nearly expires (VN)           |
| `month`              | Feb/Mar carry post-Tet backlog (VN)                               |
| `is_monday_morning`  | Interaction term — strongest single signal                        |
| `is_end_of_month`    | day ≥ 25                                                          |
| `is_post_tet`        | month ∈ {2,3}                                                     |
| `vehicle_type_id`    | Trucks/buses take ~2x longer than cars                            |
| `lane_count`         | More lanes → faster throughput                                    |
| `capacity_per_hour`  | Per-center throughput stat                                        |
| `queue_length`       | Live snapshot (from `CenterLiveStatus`)                           |
| `active_lanes`       | Live snapshot — some lanes may be down                            |
| `utilization`        | `queue / (capacity * 4)` — a load index                           |

## Model

**`GradientBoostingRegressor`** with squared-error loss, 300 trees, max_depth=5,
learning_rate=0.05. Trained on a synthetic dataset that encodes the patterns
above; the live system retrains on `WaitSample` records once we have enough
crowdsourced + bookings-derived data.

Why GBR over a neural net:

- Tabular data, 13 features → not enough signal for a deep model to dominate.
- Inference must be <50ms on a small CPU instance.
- Stakeholder explainability — `feature_importances_` directly maps to business
  intuition.

## Confidence interval

Validation residuals (`y_val - y_pred`) give us `σ`. The 95% CI is `ŷ ± 1.96σ`.
Confidence is reported as a single float inversely proportional to the
relative spread of the CI, clamped to [0.3, 0.95]. **Lower confidence at extreme
queue conditions** (>40 cars waiting) since the synth data thins out.

## Fallback heuristic

When the predictor service is unreachable, the API falls back to an in-process
heuristic encoded in [apps/api/src/lib/predictor-client.ts](../apps/api/src/lib/predictor-client.ts).
This heuristic carries the same domain pattern (Monday peak, end-of-month, Tet
backlog) but at lower fidelity. Responses are tagged `modelVersion: heuristic-v1`
so callers can distinguish.

## Retraining

```bash
# Manual:
curl -X POST http://localhost:8000/admin/retrain

# Production: schedule a CronJob to retrain weekly from WaitSample table
```

Future: ingest from a Kafka topic of completed bookings + `arrivedAt`/`finishedAt`
events to make the training set live.

## Evaluation

Reported MAE on synth holdout ≈ 12–18 minutes. To track production accuracy:

- For every booking, compare `booking.predictedWaitMinutes` against the actual
  wait time computed from `CHECKED_IN → IN_PROGRESS` event timestamps.
- Aggregate weekly per-center MAE in a dashboard.
- Alert if MAE doubles vs prior 4 weeks — usually indicates new center policy or
  data drift.
