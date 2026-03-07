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
        created_at=row.get("created_at"),
    )


@router.post("/conflicts/check", response_model=ConflictCheckResponse)
async def check_conflicts(req: ConflictCheckRequest):
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", req.user_id).execute()
    existing_meds = [_row_to_medication(r) for r in rows.data]

    cand = req.candidate_medication
    duplicates, conflicts = await check_interactions(cand.active_ingredients, existing_meds)
    suggestions = generate_schedule_suggestions(cand.schedule, conflicts)

    return ConflictCheckResponse(
        duplicates=duplicates,
        conflicts=conflicts,
        schedule_suggestions=suggestions,
    )
