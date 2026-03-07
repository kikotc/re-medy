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
# Point 5: added target_medication_id so frontend knows which
# existing medication's schedule needs to change.

class ScheduleSuggestion(BaseModel):
    target_medication_id: str | None = None
    target_medication_name: str | None = None
    allowed: bool
    reason: str
    change_type: str | None = None
    separation_hours: int | None = None
    original_schedule: Schedule | None = None
    suggested_schedule: Schedule | None = None


# ── 7. MedicationCreateResponse (save endpoint) ─────────────────

class MedicationCreateResponse(BaseModel):
    medication: Medication
    status: Literal["saved", "saved_with_warnings"] = "saved"


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


# ── 9b. MonthlyScheduleResponse (point 9) ───────────────────────

class MonthlyScheduleResponse(BaseModel):
    user_id: str
    year: int
    month: int
    days: list[DaySchedule] = Field(default_factory=list)


# ── Parse request models ─────────────────────────────────────────

class ParseMedicationTextRequest(BaseModel):
    raw_text: str
    user_id: str


# ── Autofill from partial form fields ────────────────────────────

class AutofillFieldsRequest(BaseModel):
    """Frontend sends whatever fields the user has already filled in.
    All fields are optional. Gemini fills in the gaps."""
    user_id: str
    display_name: str | None = None
    dosage_text: str | None = None
    instructions: str | None = None
    schedule: Schedule | None = None


# ── Conflict check request/response ─────────────────────────────
# Point 3: normalized_name and active_ingredients are now optional.
# If missing, /conflicts/check will call Gemini to normalize internally.

class CandidateMedication(BaseModel):
    display_name: str
    normalized_name: str | None = None
    active_ingredients: list[ActiveIngredient] | None = None
    dosage_text: str = ""
    instructions: str = ""
    schedule: Schedule = Field(default_factory=Schedule)


class ConflictCheckRequest(BaseModel):
    user_id: str
    candidate_medication: CandidateMedication


# Flow statuses per project spec
ConflictStatus = Literal[
    "SAFE_TO_ADD",
    "WARNING_CONFIRM_REQUIRED",
    "SCHEDULE_CHANGE_CONFIRM_REQUIRED",
    "UNCERTAIN_CONFIRM_REQUIRED",
]


# Point 4: added uncertainty_reason + allow_override
class ConflictCheckResponse(BaseModel):
    status: ConflictStatus
    duplicates: list[DuplicateRisk] = Field(default_factory=list)
    conflicts: list[InteractionConflict] = Field(default_factory=list)
    schedule_suggestions: list[ScheduleSuggestion] = Field(default_factory=list)
    uncertainty_reason: str | None = None
    allow_override: bool = True


# ── Schedule apply ────────────────────────────────────────────────

class ApplyScheduleSuggestionRequest(BaseModel):
    user_id: str
    medication_id: str
    suggested_schedule: Schedule
