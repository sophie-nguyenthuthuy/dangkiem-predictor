from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.model import train


@pytest.fixture(scope="module", autouse=True)
def _bootstrap_model():
    # The lifespan handler won't fire under TestClient unless we use a context.
    from app.main import _state
    _state["model"] = train(persist=False)
    yield


def _client() -> TestClient:
    return TestClient(app)


def _payload(**overrides):
    base = {
        "centerId": "c1",
        "vehicleType": "car",
        "arrivalTime": datetime(2026, 3, 2, 9, 0).isoformat(),  # Mon 9am local
        "laneCount": 3,
        "capacityPerHour": 14,
        "queueLength": 12,
        "activeLanes": 3,
    }
    base.update(overrides)
    return base


def test_health() -> None:
    res = _client().get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_predict_returns_valid_shape() -> None:
    res = _client().post("/predict", json=_payload())
    assert res.status_code == 200
    body = res.json()
    assert body["predictedWaitMinutes"] >= 5
    assert body["lowerBoundMinutes"] <= body["predictedWaitMinutes"] <= body["upperBoundMinutes"]
    assert 0 <= body["confidence"] <= 1
    assert body["modelVersion"].startswith("gbr-")


def test_predict_monday_morning_higher_than_thursday_afternoon() -> None:
    client = _client()
    mon = client.post(
        "/predict",
        json=_payload(arrivalTime=datetime(2026, 3, 2, 9, 0).isoformat()),
    ).json()
    thu = client.post(
        "/predict",
        json=_payload(arrivalTime=datetime(2026, 3, 5, 14, 0).isoformat()),
    ).json()
    assert mon["predictedWaitMinutes"] > thu["predictedWaitMinutes"]


def test_predict_validates_vehicle_type() -> None:
    res = _client().post("/predict", json=_payload(vehicleType="motorbike"))
    assert res.status_code == 422
