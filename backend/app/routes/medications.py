import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_supabase
from app.models.medication import (
    Medication,
    MedicationCreateRequest,
    MedicationCreateResponse,
    ActiveIngredient,
    Schedule,
)
from app.services.conflicts import check_interactions, generate_schedule_suggestions

router = APIRouter()


def _ensure_user_exists(user_id: str):
    """Insert user row if it doesn't exist (FK requirement)."""
    db = get_supabase()
    try:
        db.table("users").upsert({"id": user_id}).execute()
    except Exception:
        pass  # Already exists or non-critical


def _row_to_medication(row: dict) -> Medication:
    """Convert a Supabase row dict to a Medication model."""
    ingredients = row.get("active_ingredients") or []
    parsed_ingredients = [
        ActiveIngredient(**i) if isinstance(i, dict) else i
        for i in ingredients
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


@router.post("/medications", response_model=MedicationCreateResponse)
async def create_medication(req: MedicationCreateRequest):
    try:
        db = get_supabase()
        med_id = f"med_{uuid.uuid4().hex[:12]}"

        # Ensure user exists (FK constraint)
        _ensure_user_exists(req.user_id)

        # Fetch existing meds for conflict checking
        existing_rows = db.table("medications").select("*").eq("user_id", req.user_id).execute()
        existing_meds = [_row_to_medication(r) for r in existing_rows.data]

        # Check duplicates & conflicts via Gemini (with local fallback)
        duplicates, conflicts = await check_interactions(req.active_ingredients, existing_meds)
        suggestions = generate_schedule_suggestions(req.schedule, conflicts)

        # Determine status
        has_major = any(c.severity == "major" for c in conflicts)
        if has_major:
            status = "blocked_pending_review"
        elif duplicates or conflicts:
            status = "saved_with_warnings"
        else:
            status = "saved"

        # Save to Supabase (even blocked — frontend can decide to delete)
        row = {
            "id": med_id,
            "user_id": req.user_id,
            "display_name": req.display_name,
            "normalized_name": req.normalized_name,
            "active_ingredients": [i.model_dump() for i in req.active_ingredients],
            "dosage_text": req.dosage_text,
            "instructions": req.instructions,
            "start_date": req.start_date.isoformat() if req.start_date else None,
            "source": req.source,
            "schedule": req.schedule.model_dump(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.table("medications").insert(row).execute()

        med = _row_to_medication(row)

        return MedicationCreateResponse(
            medication=med,
            duplicates=duplicates,
            conflicts=conflicts,
            schedule_suggestions=suggestions,
            status=status,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/medications/{user_id}", response_model=list[Medication])
async def get_medications(user_id: str):
    db = get_supabase()
    result = db.table("medications").select("*").eq("user_id", user_id).execute()
    return [_row_to_medication(r) for r in result.data]
