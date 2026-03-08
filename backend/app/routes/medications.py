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

router = APIRouter()


def _ensure_user_exists(user_id: str):
    """Insert user row if it doesn't exist (FK requirement)."""
    db = get_supabase()
    try:
        db.table("users").upsert({"id": user_id}).execute()
    except Exception:
        pass


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
        needs_review=row.get("needs_review", False),
        confidence=row.get("confidence", 1.0),
        created_at=row.get("created_at"),
    )


@router.post("/medications", response_model=MedicationCreateResponse)
async def create_medication(req: MedicationCreateRequest):
    """Save-only endpoint.

    The frontend must call POST /conflicts/check BEFORE this endpoint.
    By the time this is called the user has already reviewed and confirmed.
    """
    db = get_supabase()
    med_id = f"med_{uuid.uuid4().hex[:12]}"

    # Ensure user exists (FK constraint)
    _ensure_user_exists(req.user_id)

    now_iso = datetime.now(timezone.utc).isoformat()
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
        "needs_review": req.needs_review,
        "confidence": req.confidence,
        "created_at": now_iso,
    }

    try:
        result = db.table("medications").insert(row).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save medication: {e}")

    if not result.data:
        raise HTTPException(status_code=500, detail="Medication insert returned no data")

    saved_row = result.data[0]

    # Some Supabase setups may not echo inserted row fields consistently,
    # so fall back to fetching by id if needed.
    if saved_row.get("id") != med_id:
        fetch = db.table("medications").select("*").eq("id", med_id).execute()
        if not fetch.data:
            raise HTTPException(status_code=500, detail="Medication saved but could not be reloaded")
        saved_row = fetch.data[0]

    med = _row_to_medication(saved_row)
    return MedicationCreateResponse(status="saved", medication=med)


@router.get("/medications/{user_id}", response_model=list[Medication])
async def get_medications(user_id: str):
    db = get_supabase()
    result = db.table("medications").select("*").eq("user_id", user_id).execute()
    return [_row_to_medication(r) for r in result.data]
