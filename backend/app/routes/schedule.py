from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query

from app.database import get_supabase
from app.models.medication import (
    WeeklyScheduleResponse,
    MonthlyScheduleResponse,
    ScheduleItem,
    ApplyScheduleSuggestionRequest,
    Medication,
    Schedule,
    ActiveIngredient,
)
from app.services.schedule import expand_weekly_schedule, expand_schedule_for_date, expand_monthly_schedule

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
async def get_today_schedule(
    user_id: str,
    local_date: date | None = Query(None, description="Client local date YYYY-MM-DD; defaults to server date"),
):
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", user_id).execute()
    meds = [_row_to_medication(r) for r in rows.data]

    today = local_date or date.today()
    taken_lookup = _build_taken_lookup(user_id, today, today)
    return expand_schedule_for_date(meds, today, taken_lookup)


@router.get("/schedule/{user_id}/month", response_model=MonthlyScheduleResponse)
async def get_monthly_schedule(
    user_id: str,
    year: int = Query(..., description="Year, e.g. 2026"),
    month: int = Query(..., ge=1, le=12, description="Month, 1-12"),
):
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", user_id).execute()
    meds = [_row_to_medication(r) for r in rows.data]

    import calendar as cal
    num_days = cal.monthrange(year, month)[1]
    start = date(year, month, 1)
    end = date(year, month, num_days)
    taken_lookup = _build_taken_lookup(user_id, start, end)

    response = expand_monthly_schedule(meds, year, month, taken_lookup)
    response.user_id = user_id
    return response


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

    old_schedule = result.data[0].get("schedule", {})

    # Update the schedule
    db.table("medications").update({
        "schedule": req.suggested_schedule.model_dump()
    }).eq("id", req.medication_id).execute()

    # Record audit event in schedule_adjustment_events
    from datetime import timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    db.table("schedule_adjustment_events").insert({
        "user_id": req.user_id,
        "target_medication_id": req.medication_id,
        "old_schedule": old_schedule,
        "suggested_schedule": req.suggested_schedule.model_dump(),
        "applied": True,
        "reason": req.reason,
        "applied_at": now_iso,
    }).execute()

    return {
        "status": "updated",
        "medication_id": req.medication_id,
        "new_schedule": req.suggested_schedule.model_dump(),
    }
