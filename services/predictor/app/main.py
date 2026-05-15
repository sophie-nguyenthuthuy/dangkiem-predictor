"""FastAPI entrypoint for the wait-time predictor service."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .model import load_or_train, predict, MODEL_VERSION, train

logger = logging.getLogger("predictor")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

_state: dict = {"model": None}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Loading or training prediction model …")
    _state["model"] = load_or_train()
    logger.info("Model ready (version=%s)", MODEL_VERSION)
    yield


app = FastAPI(
    title="Đăng kiểm Predictor",
    description="Wait-time prediction for Vietnamese vehicle inspection centers",
    version=__version__,
    lifespan=lifespan,
)


class PredictRequest(BaseModel):
    centerId: Annotated[str, Field(min_length=1)]
    vehicleType: Annotated[str, Field(pattern="^(car|truck|bus|specialized)$")]
    arrivalTime: str  # ISO 8601
    laneCount: Annotated[int, Field(ge=1, le=20)]
    capacityPerHour: Annotated[int, Field(ge=1, le=200)]
    queueLength: Annotated[int, Field(ge=0, le=500)]
    activeLanes: Annotated[int, Field(ge=0, le=20)]


class PredictResponse(BaseModel):
    predictedWaitMinutes: float
    lowerBoundMinutes: float
    upperBoundMinutes: float
    confidence: float
    modelVersion: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "modelVersion": MODEL_VERSION}


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(req: PredictRequest) -> dict:
    if _state["model"] is None:
        raise HTTPException(503, detail="Model not loaded")
    try:
        return predict(
            model=_state["model"],
            arrival_iso=req.arrivalTime,
            vehicle_type=req.vehicleType,
            lane_count=req.laneCount,
            capacity_per_hour=req.capacityPerHour,
            queue_length=req.queueLength,
            active_lanes=req.activeLanes,
        )
    except ValueError as e:
        raise HTTPException(400, detail=str(e)) from e


@app.post("/admin/retrain")
def retrain_endpoint() -> dict[str, str]:
    """Force retrain (in production this should be authenticated + scheduled)."""
    _state["model"] = train()
    return {"status": "retrained", "modelVersion": MODEL_VERSION}
