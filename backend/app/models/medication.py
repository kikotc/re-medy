from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal
from datetime import date, datetime


# ── Shared sub-models ──────────────────────────────────────────────

class ActiveIngredient(BaseModel):
    name: str
    strength: str


class Schedule(BaseModel):
    recurrence_type: Literal["daily", "weekly"] = "daily"
    days_of_week: list[str] = Field(default_factory=list)
    times: list[str] = Field(default_factory=lambda: ["09:00"])


# ── 1. ParsedMedicationCandidate (Gemini output) ──────────────────

class ParsedMedicationCandidate(BaseModel):
    display_name: str
    normalized_name: str
    active_ingredients: list[ActiveIngredient]
    dosage_text: str = ""
    instructions: str = ""
    schedule: Schedule = Field(default_factory=Schedule)
    needs_review: bool = False
    confidence: float = 0.0


# ── 2. MedicationCreateRequest ────────────────────────────────────

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


# ── 3. Medication (DB row) ────────────────────────────────────────

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
    created_at: datetime | None = None


# ── 4. DuplicateRisk ─────────────────────────────────────────────

class DuplicateRisk(BaseModel):
    type: Literal["duplicate_ingredient"] = "duplicate_ingredient"
    ingredient: str
    with_medication_id: str
    with_medication_name: str
    reason: str


# ── 5. InteractionConflict ───────────────────────────────────────

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


# ── 6. ScheduleSuggestion ───────────────────────────────────────

class ScheduleSuggestion(BaseModel):
    allowed: bool
    reason: str
    change_type: str | None = None
    separation_hours: int | None = None
    original_schedule: Schedule | None = None
    suggested_schedule: Schedule | None = None


# ── 7. MedicationCreateResponse ─────────────────────────────────

class MedicationCreateResponse(BaseModel):
    medication: Medication
    duplicates: list[DuplicateRisk] = Field(default_factory=list)
    conflicts: list[InteractionConflict] = Field(default_factory=list)
    schedule_suggestions: list[ScheduleSuggestion] = Field(default_factory=list)
    status: Literal["saved", "saved_with_warnings", "blocked_pending_review"] = "saved"


# ── 8. ScheduleItem ─────────────────────────────────────────────

class ScheduleItem(BaseModel):
    schedule_item_id: str
    medication_id: str
    display_name: str
    date: date
    scheduled_time: str
    taken: bool = False


# ── 9. DaySchedule + WeeklyScheduleResponse ─────────────────────

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


# ── Parse request models ─────────────────────────────────────────

class ParseMedicationTextRequest(BaseModel):
    raw_text: str
    user_id: str


# ── Conflict check request ───────────────────────────────────────

class CandidateMedication(BaseModel):
    display_name: str
    normalized_name: str
    active_ingredients: list[ActiveIngredient]
    dosage_text: str = ""
    instructions: str = ""
    schedule: Schedule = Field(default_factory=Schedule)


class ConflictCheckRequest(BaseModel):
    user_id: str
    candidate_medication: CandidateMedication


class ConflictCheckResponse(BaseModel):
    duplicates: list[DuplicateRisk] = Field(default_factory=list)
    conflicts: list[InteractionConflict] = Field(default_factory=list)
    schedule_suggestions: list[ScheduleSuggestion] = Field(default_factory=list)


# ── Schedule apply ────────────────────────────────────────────────

class ApplyScheduleSuggestionRequest(BaseModel):
    user_id: str
    medication_id: str
    suggested_schedule: Schedule
