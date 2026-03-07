from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query

from app.database import get_supabase
from app.models.medication import (
    WeeklyScheduleResponse,
    ScheduleItem,
    ApplyScheduleSuggestionRequest,
    Medication,
    Schedule,
    ActiveIngredient,
)
from app.services.schedule import expand_weekly_schedule, expand_schedule_for_date

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


def _build_taken_lookup(user_id: str, start: date, end: date) -> dict[str, bool]:
    """Build a lookup dict from medication_logs for a date range."""
    db = get_supabase()
    logs = (
        db.table("med_logs")
        .select("medication_id, date, scheduled_time, taken")
        .eq("user_id", user_id)
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .execute()
    )
    lookup: dict[str, bool] = {}
    for log in logs.data:
        key = f"{log['medication_id']}:{log['date']}:{log['scheduled_time']}"
        lookup[key] = log["taken"]
    return lookup


@router.get("/schedule/{user_id}", response_model=WeeklyScheduleResponse)
async def get_weekly_schedule(
    user_id: str,
    week_start: date = Query(..., description="YYYY-MM-DD, start of the week"),
):
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", user_id).execute()
    meds = [_row_to_medication(r) for r in rows.data]

    from datetime import timedelta
    end = week_start + timedelta(days=6)
    taken_lookup = _build_taken_lookup(user_id, week_start, end)

    response = expand_weekly_schedule(meds, week_start, taken_lookup)
    response.user_id = user_id
    return response


@router.get("/today/{user_id}", response_model=list[ScheduleItem])
async def get_today_schedule(user_id: str):
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", user_id).execute()
    meds = [_row_to_medication(r) for r in rows.data]

    today = date.today()
    taken_lookup = _build_taken_lookup(user_id, today, today)
    return expand_schedule_for_date(meds, today, taken_lookup)


@router.post("/schedule/apply-suggestion")
async def apply_schedule_suggestion(req: ApplyScheduleSuggestionRequest):
    db = get_supabase()

    # Verify medication exists and belongs to user
    result = (
        db.table("medications")
        .select("*")
        .eq("id", req.medication_id)
        .eq("user_id", req.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Medication not found")

    # Update the schedule
    db.table("medications").update({
        "schedule": req.suggested_schedule.model_dump()
    }).eq("id", req.medication_id).execute()

    return {
        "status": "updated",
        "medication_id": req.medication_id,
        "new_schedule": req.suggested_schedule.model_dump(),
    }
