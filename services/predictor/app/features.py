"""Feature extraction for wait-time prediction.

Encodes the calendar + queue state into a fixed-width numerical vector
consumed by the trained scikit-learn model.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

VEHICLE_TYPE_INDEX = {"car": 0, "truck": 1, "bus": 2, "specialized": 3}


@dataclass
class PredictionFeatures:
    hour_of_day: int          # 0..23 local
    day_of_week: int          # 0=Mon..6=Sun local
    day_of_month: int         # 1..31
    month: int                # 1..12
    is_monday_morning: int    # 0/1
    is_end_of_month: int      # 0/1 (day >= 25)
    is_post_tet: int          # 0/1 (Feb/Mar)
    vehicle_type_id: int
    lane_count: int
    capacity_per_hour: int
    queue_length: int
    active_lanes: int
    utilization: float        # queue_length / (capacity * 4) rough load index

    def to_vector(self) -> list[float]:
        return [
            float(self.hour_of_day),
            float(self.day_of_week),
            float(self.day_of_month),
            float(self.month),
            float(self.is_monday_morning),
            float(self.is_end_of_month),
            float(self.is_post_tet),
            float(self.vehicle_type_id),
            float(self.lane_count),
            float(self.capacity_per_hour),
            float(self.queue_length),
            float(self.active_lanes),
            float(self.utilization),
        ]


def extract(
    arrival_iso: str,
    vehicle_type: str,
    lane_count: int,
    capacity_per_hour: int,
    queue_length: int,
    active_lanes: int,
) -> PredictionFeatures:
    t = datetime.fromisoformat(arrival_iso.replace("Z", "+00:00")).astimezone(VN_TZ)
    dow = t.weekday()
    cap_eff = max(1, capacity_per_hour)
    utilization = queue_length / (cap_eff * 4)
    return PredictionFeatures(
        hour_of_day=t.hour,
        day_of_week=dow,
        day_of_month=t.day,
        month=t.month,
        is_monday_morning=int(dow == 0 and 7 <= t.hour <= 11),
        is_end_of_month=int(t.day >= 25),
        is_post_tet=int(t.month in (2, 3)),
        vehicle_type_id=VEHICLE_TYPE_INDEX.get(vehicle_type, 0),
        lane_count=lane_count,
        capacity_per_hour=capacity_per_hour,
        queue_length=queue_length,
        active_lanes=max(0, active_lanes),
        utilization=utilization,
    )
