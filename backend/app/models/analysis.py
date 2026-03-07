from pydantic import BaseModel
from typing import Literal
from datetime import date


class ADRAnalysisRequest(BaseModel):
    user_id: str
    effect: str
    severity: Literal["mild", "moderate", "severe"] = "mild"
    date: date


class LikelyCulprit(BaseModel):
    medication_id: str
    display_name: str
    likelihood: Literal["high", "possible", "unlikely"]
    reason: str


class ADRAnalysisResponse(BaseModel):
    effect: str
    likely_culprits: list[LikelyCulprit] = []
    warning_level: Literal["low", "medium", "high"] = "low"
    disclaimer: str = "This is informational only and should be confirmed with a healthcare professional."
