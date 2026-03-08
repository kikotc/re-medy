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
        needs_review=row.get("needs_review", False),
        confidence=row.get("confidence", 1.0),
        created_at=row.get("created_at"),
    )


@router.post("/conflicts/check", response_model=ConflictCheckResponse)
async def check_conflicts(req: ConflictCheckRequest):
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", req.user_id).execute()
    existing_meds = [_row_to_medication(r) for r in rows.data]

    cand = req.candidate_medication

    # If candidate is missing active_ingredients, try Gemini parse from raw_text
    if not cand.active_ingredients and cand.raw_text:
        from app.services.gemini import parse_medication_text
        parsed = await parse_medication_text(cand.raw_text)
        cand.normalized_name = cand.normalized_name or parsed.normalized_name
        cand.display_name = cand.display_name or parsed.display_name
        cand.active_ingredients = parsed.active_ingredients
        cand.dosage_text = cand.dosage_text or parsed.dosage_text
        cand.instructions = cand.instructions or parsed.instructions
        cand.schedule = parsed.schedule if cand.schedule.times == ["09:00"] else cand.schedule
        # Propagate parse confidence into the candidate
        cand.confidence = parsed.confidence
        cand.needs_review = parsed.needs_review
        if parsed.needs_review:
            cand.uncertainty_reason = (
                f"Gemini parse confidence is {parsed.confidence:.0%}. "
                "The medication could not be confidently identified."
            )

    # Flag as uncertain if no active ingredients were found at all
    if not cand.active_ingredients:
        cand.needs_review = True
        cand.uncertainty_reason = cand.uncertainty_reason or "No active ingredients could be identified."

    duplicates, conflicts = await check_interactions(cand.active_ingredients, existing_meds)
    suggestions = generate_schedule_suggestions(cand.schedule, conflicts, cand.display_name or "new medication")

    # Determine decision_status
    has_major = any(c.severity == "major" for c in conflicts)
    has_reschedulable = any(s.allowed and s.suggested_schedule for s in suggestions)
    has_blocked = any(not s.allowed for s in suggestions)

    if has_major or has_blocked:
        decision_status = "WARNING_CONFIRM_REQUIRED"
        message = "Major interaction detected. User must review and confirm before adding."
    elif has_reschedulable:
        decision_status = "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
        message = "Schedule adjustments are recommended to avoid interactions."
    elif duplicates or conflicts:
        decision_status = "WARNING_CONFIRM_REQUIRED"
        message = "Potential duplicates or interactions found. User should confirm."
    elif cand.needs_review or cand.confidence < 0.6:
        decision_status = "UNCERTAIN_CONFIRM_REQUIRED"
        message = cand.uncertainty_reason or "Parsed data has low confidence and needs manual review."
    else:
        decision_status = "SAFE_TO_ADD"
        message = ""

    return ConflictCheckResponse(
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
        decision_status=decision_status,
        message=message,
    )
