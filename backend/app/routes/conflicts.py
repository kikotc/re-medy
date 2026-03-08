from fastapi import APIRouter

from app.database import get_supabase
from app.models.medication import (
    ActiveIngredient,
    ConflictCheckRequest,
    ConflictCheckResponse,
    Medication,
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
        needs_review=row.get("needs_review", False),
        confidence=row.get("confidence", 1.0),
        created_at=row.get("created_at"),
    )


def _determine_status(
    duplicates: list,
    conflicts: list,
    suggestions: list,
    needs_review: bool,
    low_confidence: bool,
    uncertainty_reason: str | None = None,
) -> tuple[str, str]:
    has_major = any(c.severity == "major" for c in conflicts)
    has_reschedulable = any(s.allowed and s.suggested_schedule for s in suggestions)
    has_blocked = any(not s.allowed for s in suggestions)

    if has_major or has_blocked:
        return (
            "WARNING_CONFIRM_REQUIRED",
            "Major interaction detected. User must review and confirm before adding.",
        )

    if has_reschedulable:
        return (
            "SCHEDULE_CHANGE_CONFIRM_REQUIRED",
            "Schedule adjustments are recommended to avoid interactions.",
        )

    if duplicates or conflicts:
        return (
            "WARNING_CONFIRM_REQUIRED",
            "Potential duplicates or interactions found. User should confirm.",
        )

    if needs_review or low_confidence:
        return (
            "UNCERTAIN_CONFIRM_REQUIRED",
            uncertainty_reason or "Parsed data has low confidence and needs manual review.",
        )

    return ("SAFE_TO_ADD", "")


@router.post("/conflicts/check", response_model=ConflictCheckResponse)
async def check_conflicts(req: ConflictCheckRequest):
    cand = req.candidate_medication
    low_confidence = cand.confidence < 0.6 or cand.needs_review

    if not cand.normalized_name or not cand.active_ingredients:
        raw_text = (
            cand.raw_text
            or f"{cand.display_name} {cand.dosage_text} {cand.instructions}".strip()
        )

        if raw_text:
            parsed = await parse_medication_text(raw_text)

            cand.normalized_name = cand.normalized_name or parsed.normalized_name
            cand.display_name = cand.display_name or parsed.display_name
            cand.active_ingredients = cand.active_ingredients or parsed.active_ingredients
            cand.dosage_text = cand.dosage_text or parsed.dosage_text
            cand.instructions = cand.instructions or parsed.instructions

            if (not cand.schedule.times) and parsed.schedule and parsed.schedule.times:
                cand.schedule = parsed.schedule

            cand.confidence = parsed.confidence
            cand.needs_review = parsed.needs_review
            low_confidence = parsed.confidence < 0.5 or parsed.needs_review

            if parsed.needs_review:
                cand.uncertainty_reason = (
                    f"Gemini parse confidence is {parsed.confidence:.0%}. "
                    "The medication could not be confidently identified."
                )

    if not cand.active_ingredients:
        cand.needs_review = True
        cand.uncertainty_reason = (
            cand.uncertainty_reason
            or "No active ingredients could be identified."
        )

    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", req.user_id).execute()
    existing_meds = [_row_to_medication(r) for r in rows.data]

    duplicates, conflicts = await check_interactions(
        cand.active_ingredients, existing_meds
    )
    suggestions = generate_schedule_suggestions(
        cand.schedule,
        conflicts,
        existing_meds,
        cand.display_name or "new medication",
    )

    decision_status, message = _determine_status(
        duplicates=duplicates,
        conflicts=conflicts,
        suggestions=suggestions,
        needs_review=cand.needs_review,
        low_confidence=low_confidence,
        uncertainty_reason=cand.uncertainty_reason,
    )

    return ConflictCheckResponse(
        decision_status=decision_status,
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
        message=message,
    )