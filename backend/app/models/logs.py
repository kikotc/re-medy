from pydantic import BaseModel
from datetime import date
from typing import Literal


class MedicationLogCreateRequest(BaseModel):
    user_id: str
    medication_id: str
    date: date
    scheduled_time: str
    taken: bool = True


class SideEffectLogCreateRequest(BaseModel):
    user_id: str
    effect: str
    severity: Literal["mild", "moderate", "severe"] = "mild"
    date: date
    notes: str = ""
