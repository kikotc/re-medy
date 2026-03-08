from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class ActiveIngredient(BaseModel):
    name: str
    strength: str


class Schedule(BaseModel):
    recurrence_type: Literal["daily", "weekly"] = "daily"
    days_of_week: list[str] = Field(default_factory=list)
    times: list[str] = Field(default_factory=list)


class ParsedMedicationCandidate(BaseModel):
    display_name: str
    normalized_name: str
    active_ingredients: list[ActiveIngredient] = Field(default_factory=list)
    dosage_text: str = ""
    instructions: str = ""
    schedule: Schedule | None = None
    needs_review: bool = False
    confidence: float = 0.0


class Medication(BaseModel):
    id: str
    user_id: str
    display_name: str
    normalized_name: str
    active_ingredients: list[ActiveIngredient]
    dosage_text: str = ""
    instructions: str = ""
    start_date: date | None = None
    source: str = "manual"
    schedule: Schedule = Field(default_factory=Schedule)
    needs_review: bool = False
    confidence: float = 1.0
    created_at: datetime | None = None


class DuplicateRisk(BaseModel):
    type: Literal["duplicate_ingredient"] = "duplicate_ingredient"
    ingredient: str
    with_medication_id: str
    with_medication_name: str
    reason: str


class InteractionConflict(BaseModel):
    type: Literal["interaction"] = "interaction"
    ingredient_a: str
    ingredient_b: str
    with_medication_id: str
    with_medication_name: str
    severity: Literal["major", "moderate", "minor"]
    reason: str
    auto_reschedulable: bool = False
    separation_hours: int | None = None
    guidance: str = ""


class ScheduleSuggestion(BaseModel):
    target_medication_id: str = ""
    target_medication_name: str = ""
    is_candidate: bool = True
    allowed: bool
    reason: str
    change_type: str | None = None
    separation_hours: int | None = None
    original_schedule: Schedule | None = None
    suggested_schedule: Schedule | None = None


class MedicationCreateRequest(BaseModel):
    user_id: str
    display_name: str
    normalized_name: str
    active_ingredients: list[ActiveIngredient]
    dosage_text: str = ""
    instructions: str = ""
    start_date: date | None = None
    source: Literal["text", "photo", "manual"] = "manual"
    schedule: Schedule = Field(default_factory=Schedule)
    needs_review: bool = False
    confidence: float = 1.0


class MedicationCreateResponse(BaseModel):
    status: Literal["saved"] = "saved"
    medication: Medication


class ScheduleItem(BaseModel):
    schedule_item_id: str
    medication_id: str
    display_name: str
    date: date
    scheduled_time: str
    taken: bool = False


class DaySchedule(BaseModel):
    date: date
    items: list[ScheduleItem] = Field(default_factory=list)


class WeeklyScheduleResponse(BaseModel):
    user_id: str
    week_start: date
    days: list[DaySchedule] = Field(default_factory=list)


class MonthlyScheduleResponse(BaseModel):
    user_id: str
    year: int
    month: int
    days: list[DaySchedule] = Field(default_factory=list)


class ParseMedicationTextRequest(BaseModel):
    raw_text: str
    user_id: str


class AutofillFieldsRequest(BaseModel):
    user_id: str
    display_name: str | None = None
    dosage_text: str | None = None
    instructions: str | None = None
    schedule: Schedule | None = None


class CandidateMedication(BaseModel):
    display_name: str = ""
    normalized_name: str = ""
    active_ingredients: list[ActiveIngredient] = Field(default_factory=list)
    dosage_text: str = ""
    instructions: str = ""
    schedule: Schedule = Field(default_factory=Schedule)
    raw_text: str = ""
    needs_review: bool = False
    confidence: float = 1.0
    uncertainty_reason: str = ""


class ConflictCheckRequest(BaseModel):
    user_id: str
    candidate_medication: CandidateMedication


ConflictStatus = Literal[
    "SAFE_TO_ADD",
    "WARNING_CONFIRM_REQUIRED",
    "SCHEDULE_CHANGE_CONFIRM_REQUIRED",
    "UNCERTAIN_CONFIRM_REQUIRED",
]


class ConflictCheckResponse(BaseModel):
    decision_status: ConflictStatus = "SAFE_TO_ADD"
    duplicates: list[DuplicateRisk] = Field(default_factory=list)
    conflicts: list[InteractionConflict] = Field(default_factory=list)
    schedule_suggestions: list[ScheduleSuggestion] = Field(default_factory=list)
    message: str = ""


class ApplyScheduleSuggestionRequest(BaseModel):
    user_id: str
    target_medication_id: str
    suggested_schedule: Schedule
    reason: str = ""