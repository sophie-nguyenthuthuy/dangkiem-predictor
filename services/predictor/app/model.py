"""Wait-time regression model.

Uses GradientBoostingRegressor trained on a synthetic dataset that mimics
the observed VN inspection-center patterns:
  - Monday morning peaks
  - End-of-month rush (tem expiry batching)
  - Post-Tet (Feb/Mar) backlog
  - Hour-of-day double peak (8-10, 15-17)
  - Queue-length proportionality, lane-count divisor

In production, replace `synth_dataset` with samples from the WaitSample table.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

from .features import PredictionFeatures, extract

MODEL_VERSION = "gbr-v1"
MODEL_PATH = Path(os.environ.get("MODEL_PATH", "/tmp/dangkiem_model.joblib"))


@dataclass
class TrainedModel:
    estimator: GradientBoostingRegressor
    feature_residual_std: float  # used for 95% CI


def _synth_dataset(n: int = 5000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    rows: list[list[float]] = []
    targets: list[float] = []
    for _ in range(n):
        dow = int(rng.integers(0, 6))  # exclude Sunday (closed)
        hour = int(rng.integers(7, 18))
        day = int(rng.integers(1, 29))
        month = int(rng.integers(1, 13))
        vehicle_type_id = int(rng.integers(0, 4))
        lane_count = int(rng.integers(2, 5))
        capacity = lane_count * int(rng.integers(4, 6))
        queue = int(rng.integers(0, 40))
        active = max(1, lane_count - int(rng.integers(0, 2)))

        base = 35.0
        if hour in (8, 9):
            base += 50
        elif hour in (10, 11):
            base += 25
        elif hour == 12:
            base -= 10
        elif hour in (13, 14, 15):
            base += 20
        elif hour >= 16:
            base += 35

        if dow == 0:  # Monday
            base += 35
        elif dow == 4:  # Friday
            base += 18
        elif dow == 5:  # Saturday
            base += 10

        if day >= 25:
            base += 28
        if month in (2, 3):
            base += 22
        if vehicle_type_id in (1, 2):  # truck/bus take longer
            base += 12
        elif vehicle_type_id == 3:
            base += 25

        per_car = 60 / max(1, capacity)
        base += queue * per_car * 0.55
        if active < lane_count:
            base *= lane_count / active

        # Heteroskedastic noise: longer waits are noisier
        noise = rng.normal(0, max(8, base * 0.12))
        target = max(5, base + noise)

        feats = PredictionFeatures(
            hour_of_day=hour,
            day_of_week=dow,
            day_of_month=day,
            month=month,
            is_monday_morning=int(dow == 0 and 7 <= hour <= 11),
            is_end_of_month=int(day >= 25),
            is_post_tet=int(month in (2, 3)),
            vehicle_type_id=vehicle_type_id,
            lane_count=lane_count,
            capacity_per_hour=capacity,
            queue_length=queue,
            active_lanes=active,
            utilization=queue / (capacity * 4),
        )
        rows.append(feats.to_vector())
        targets.append(target)
    return np.asarray(rows, dtype=np.float32), np.asarray(targets, dtype=np.float32)


def train(persist: bool = True) -> TrainedModel:
    X, y = _synth_dataset()
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    model = GradientBoostingRegressor(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        loss="squared_error",
        random_state=42,
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_val)
    residuals = y_val - y_pred
    sigma = float(np.std(residuals))
    mae = float(mean_absolute_error(y_val, y_pred))
    print(f"[predictor] trained {MODEL_VERSION} | MAE={mae:.1f} min | sigma={sigma:.1f}")
    trained = TrainedModel(estimator=model, feature_residual_std=sigma)
    if persist:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(trained, MODEL_PATH)
    return trained


def load_or_train() -> TrainedModel:
    if MODEL_PATH.exists():
        try:
            return joblib.load(MODEL_PATH)
        except Exception as e:  # pragma: no cover
            print(f"[predictor] failed to load model: {e}; retraining")
    return train()


def predict(
    model: TrainedModel,
    arrival_iso: str,
    vehicle_type: str,
    lane_count: int,
    capacity_per_hour: int,
    queue_length: int,
    active_lanes: int,
) -> dict[str, float | str]:
    feats = extract(
        arrival_iso=arrival_iso,
        vehicle_type=vehicle_type,
        lane_count=lane_count,
        capacity_per_hour=capacity_per_hour,
        queue_length=queue_length,
        active_lanes=active_lanes,
    )
    x = np.asarray([feats.to_vector()], dtype=np.float32)
    yhat = float(model.estimator.predict(x)[0])
    sigma = model.feature_residual_std
    lower = max(5.0, yhat - 1.96 * sigma)
    upper = yhat + 1.96 * sigma

    # Confidence is inverse-proportional to relative spread
    rel_spread = (upper - lower) / max(1.0, yhat)
    confidence = max(0.3, min(0.95, 1.0 - rel_spread * 0.35))

    return {
        "predictedWaitMinutes": round(yhat, 1),
        "lowerBoundMinutes": round(lower, 1),
        "upperBoundMinutes": round(upper, 1),
        "confidence": round(confidence, 3),
        "modelVersion": MODEL_VERSION,
    }
