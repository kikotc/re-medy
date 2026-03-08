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
# Point 12: includes normalized_name, active_ingredients, needs_review,
# confidence, so frontend can carry them as hidden fields.

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
# (definition moved below DuplicateRisk / InteractionConflict / ScheduleSuggestion
#  so the response model can reference them; see section 7)


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
    needs_review: bool = False
    confidence: float = 1.0
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
# Point 7: added target_medication_id + target_medication_name
# so frontend knows which existing med's schedule needs to change.

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


# ── 7. MedicationCreateRequest / Response ─────────────────────────

class MedicationCreateRequest(BaseModel):
    """Save-only endpoint (POST /medications).

    The frontend should only call this AFTER conflict-check has been done
    and the user has confirmed they want to proceed.
    """
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


# ── 8. ScheduleItem ─────────────────────────────────────────────

class ScheduleItem(BaseModel):
    schedule_item_id: str
    medication_id: str
    display_name: str
    date: date
    scheduled_time: str
    taken: bool = False


# ── 9. DaySchedule + WeeklyScheduleResponse + MonthlyScheduleResponse ──
# Point 4: added MonthlyScheduleResponse for calendar view.

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
# Point 2: normalized_name and active_ingredients are now optional.
# If missing, /conflicts/check calls Gemini to normalize internally.
# This lets complete text input skip autofill entirely.

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


# Point 1 + 11: decision_status + uncertainty_message
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


# ── Schedule apply ────────────────────────────────────────────────
# Point 6: includes target_medication_id explicitly + reason for audit.

class ApplyScheduleSuggestionRequest(BaseModel):
    user_id: str
    target_medication_id: str
    suggested_schedule: Schedule
    reason: str = ""
