from fastapi import APIRouter

from app.database import get_supabase
from app.models.medication import (
    ConflictCheckRequest,
    ConflictCheckResponse,
    Medication,
    ActiveIngredient,
    Schedule,
)
from app.services.conflicts import check_interactions, generate_schedule_suggestions
from app.services.gemini import parse_medication_text

router = APIRouter()


def _row_to_medication(row: dict) -> Medication:
    ingredients = row.get("active_ingredients") or []
    parsed_ingredients = [
        ActiveIngredient(**i) if isinstance(i, dict) else i for i in ingredients
    ]
    sched_raw = row.get("schedule") or {}
    sched = Schedule(**sched_raw) if isinstance(sched_raw, dict) else sched_raw
    return Medication(
        id=row["id"],
        user_id=row["user_id"],
        display_name=row["display_name"],
        normalized_name=row["normalized_name"],
        active_ingredients=parsed_ingredients,
        dosage_text=row.get("dosage_text", ""),
        instructions=row.get("instructions", ""),
        start_date=row.get("start_date"),
        source=row.get("source", "manual"),
        schedule=sched,
        created_at=row.get("created_at"),
    )


def _determine_status(
    duplicates: list,
    conflicts: list,
    schedule_suggestions: list,
    candidate_has_ingredients: bool,
    low_confidence: bool,
) -> tuple[str, str | None]:
    """Determine decision_status and optional uncertainty_message.

    Returns (decision_status, uncertainty_message).
    """
    # Point 11: explicit uncertainty for unknown/niche meds
    if not candidate_has_ingredients or low_confidence:
        return (
            "UNCERTAIN_CONFIRM_REQUIRED",
            "Could not confidently identify this medication or its ingredients. "
            "Please verify before adding.",
        )

    # Reschedulable suggestion takes priority over plain warning
    has_reschedulable = any(s.allowed for s in schedule_suggestions)
    if has_reschedulable:
        return ("SCHEDULE_CHANGE_CONFIRM_REQUIRED", None)

    # Any duplicates or conflicts require confirmation
    if duplicates or conflicts:
        return ("WARNING_CONFIRM_REQUIRED", None)

    return ("SAFE_TO_ADD", None)


@router.post("/conflicts/check", response_model=ConflictCheckResponse)
async def check_conflicts(req: ConflictCheckRequest):
    """Check a candidate medication for conflicts BEFORE saving.

    Point 2: If normalized_name or active_ingredients are missing,
    the backend normalizes internally via Gemini. This lets complete
    text input skip the autofill step entirely.
    """
    cand = req.candidate_medication

    # Point 2: normalize internally if fields are missing
    normalized_name = cand.normalized_name
    active_ingredients = cand.active_ingredients
    low_confidence = False

    if not normalized_name or not active_ingredients:
        # Use Gemini to resolve the medication from display_name
        parsed = await parse_medication_text(
            f"{cand.display_name} {cand.dosage_text} {cand.instructions}".strip()
        )
        normalized_name = parsed.normalized_name
        active_ingredients = parsed.active_ingredients
        low_confidence = parsed.confidence < 0.5 or parsed.needs_review

    # Fetch existing meds
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", req.user_id).execute()
    existing_meds = [_row_to_medication(r) for r in rows.data]

    # Run checks
    duplicates, conflicts = await check_interactions(active_ingredients, existing_meds)
    suggestions = generate_schedule_suggestions(cand.schedule, conflicts, existing_meds)

    decision_status, uncertainty_message = _determine_status(
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
        candidate_has_ingredients=len(active_ingredients or []) > 0,
        low_confidence=low_confidence,
    )

    return ConflictCheckResponse(
        decision_status=decision_status,
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
        uncertainty_message=uncertainty_message,
        # Echo back so frontend can carry to save step
        normalized_name=normalized_name,
        active_ingredients=active_ingredients,
    )
    