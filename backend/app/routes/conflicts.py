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
    uncertainty_reason: str | None,
) -> str:
    """Determine the conflict check status per the project flow spec."""
    # If we couldn't identify the medication or its ingredients
    if uncertainty_reason:
        return "UNCERTAIN_CONFIRM_REQUIRED"

    # If any suggestion is allowed (reschedulable), that takes priority
    has_reschedulable = any(s.allowed for s in schedule_suggestions)
    if has_reschedulable:
        return "SCHEDULE_CHANGE_CONFIRM_REQUIRED"

    # If there are duplicates or any conflicts, warn the user
    if duplicates or conflicts:
        return "WARNING_CONFIRM_REQUIRED"

    return "SAFE_TO_ADD"


@router.post("/conflicts/check", response_model=ConflictCheckResponse)
async def check_conflicts(req: ConflictCheckRequest):
    """Check a candidate medication for conflicts BEFORE saving.

    This is a dry-run — nothing is saved to the database.
    Frontend uses the returned status to decide what to show the user.

    Point 3: If normalized_name or active_ingredients are missing,
    this endpoint will call Gemini to normalize internally.
    This supports the "complete text skips autofill" path.
    """
    cand = req.candidate_medication
    uncertainty_reason: str | None = None

    # ── Point 3: Internal normalization if needed ─────────────────
    # If the frontend sent a candidate without normalized_name or
    # active_ingredients (complete text path), use Gemini to fill them in.
    ingredients = cand.active_ingredients or []
    normalized_name = cand.normalized_name or ""

    if not ingredients or not normalized_name:
        try:
            # Build a text string from what we have and ask Gemini to parse it
            text_to_parse = cand.display_name
            if cand.dosage_text:
                text_to_parse += f" {cand.dosage_text}"
            if cand.instructions:
                text_to_parse += f" {cand.instructions}"

            parsed = await parse_medication_text(text_to_parse)

            # Use Gemini's results for missing fields only
            if not normalized_name:
                normalized_name = parsed.normalized_name
            if not ingredients:
                ingredients = parsed.active_ingredients

            # If Gemini couldn't identify the medication either
            if not ingredients or parsed.confidence < 0.3:
                uncertainty_reason = (
                    f"Could not confidently identify active ingredients for '{cand.display_name}'. "
                    "This may be an unrecognized or misspelled medication."
                )
            elif parsed.needs_review:
                uncertainty_reason = (
                    f"Low confidence identification for '{cand.display_name}'. "
                    "Please verify the medication details are correct."
                )

        except Exception:
            uncertainty_reason = (
                f"Unable to normalize '{cand.display_name}'. "
                "Please verify the medication name and try again."
            )

    # ── Fetch existing medications ────────────────────────────────
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", req.user_id).execute()
    existing_meds = [_row_to_medication(r) for r in rows.data]

    # ── Run conflict checks ───────────────────────────────────────
    duplicates, conflicts = await check_interactions(ingredients, existing_meds)
    suggestions = generate_schedule_suggestions(
        cand.schedule, conflicts, existing_meds
    )

    status = _determine_status(
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
        candidate_has_ingredients=len(ingredients) > 0,
        uncertainty_reason=uncertainty_reason,
    )

    return ConflictCheckResponse(
        status=status,
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
        uncertainty_reason=uncertainty_reason,
        allow_override=True,
    )
    