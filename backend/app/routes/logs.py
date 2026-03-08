from datetime import datetime, timezone
from fastapi import APIRouter

from app.database import get_supabase
from app.models.logs import MedicationLogCreateRequest, SideEffectLogCreateRequest

router = APIRouter()


def _ensure_user_exists(user_id: str):
    db = get_supabase()
    try:
        db.table("users").upsert({"id": user_id}).execute()
    except Exception:
        pass


@router.post("/med-logs")
async def create_med_log(req: MedicationLogCreateRequest):
    """Log whether a dose was taken or skipped.

    Point 9: Uses upsert on (user_id, medication_id, date, scheduled_time)
    so toggling taken on/off from the Today page updates the existing row
    instead of creating duplicates.
    """
    _ensure_user_exists(req.user_id)
    db = get_supabase()

    # Check for existing log for this exact dose slot
    existing = (
        db.table("med_logs")
        .select("id")
        .eq("user_id", req.user_id)
        .eq("medication_id", req.medication_id)
        .eq("date", req.date.isoformat())
        .eq("scheduled_time", req.scheduled_time)
        .execute()
    )

    taken_at = datetime.now(timezone.utc).isoformat() if req.taken else None

    if existing.data:
        # Update existing row (toggle behavior)
        log_id = existing.data[0]["id"]
        db.table("med_logs").update({
            "taken": req.taken,
            "taken_at": taken_at,
        }).eq("id", log_id).execute()
        return {"status": "updated", "id": log_id}
    else:
        # Insert new row
        row = {
            "user_id": req.user_id,
            "medication_id": req.medication_id,
            "date": req.date.isoformat(),
            "scheduled_time": req.scheduled_time,
            "taken": req.taken,
            "taken_at": taken_at,
        }
        result = db.table("med_logs").insert(row).execute()
        log_id = result.data[0]["id"] if result.data else None
        return {"status": "logged", "id": log_id}


@router.post("/side-effects/log")
async def create_side_effect_log(req: SideEffectLogCreateRequest):
    _ensure_user_exists(req.user_id)
    db = get_supabase()
    row = {
        "user_id": req.user_id,
        "effect": req.effect,
        "severity": req.severity,
        "date": req.date.isoformat(),
        "notes": req.notes,
    }
    result = db.table("side_effect_logs").insert(row).execute()
    log_id = result.data[0]["id"] if result.data else None
    return {"status": "logged", "id": log_id}
