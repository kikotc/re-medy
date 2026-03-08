import calendar
from datetime import date, datetime, timedelta, timezone
from logging import log
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

def normalize_time(value) -> str:
    s = str(value)
    parts = s.split(":")
    return f"{int(parts[0]):02d}:{int(parts[1]):02d}"

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
    """Build a lookup dict from med_logs for a date range."""
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
        scheduled_time = normalize_time(log["scheduled_time"])
        key = f"{log['medication_id']}:{log['date']}:{scheduled_time}"
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

    end = week_start + timedelta(days=6)
    taken_lookup = _build_taken_lookup(user_id, week_start, end)

    response = expand_weekly_schedule(meds, week_start, taken_lookup)
    response.user_id = user_id
    return response


# Point 4: monthly schedule endpoint for calendar view
@router.get("/schedule/{user_id}/month", response_model=MonthlyScheduleResponse)
async def get_monthly_schedule(
    user_id: str,
    year: int = Query(..., description="Year, e.g. 2026"),
    month: int = Query(..., ge=1, le=12, description="Month, 1-12"),
):
    """Return all schedule items for a full calendar month."""
    db = get_supabase()
    rows = db.table("medications").select("*").eq("user_id", user_id).execute()
    meds = [_row_to_medication(r) for r in rows.data]

    # Get first and last day of month
    _, num_days = calendar.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, num_days)

    taken_lookup = _build_taken_lookup(user_id, month_start, month_end)

    from app.models.medication import DaySchedule
    days = []
    for i in range(num_days):
        d = month_start + timedelta(days=i)
        items = expand_schedule_for_date(meds, d, taken_lookup)
        days.append(DaySchedule(date=d, items=items))

    return MonthlyScheduleResponse(
        user_id=user_id,
        year=year,
        month=month,
        days=days,
    )


# Point 10: accept optional date param so frontend controls "today"
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


@router.post("/schedule/apply-suggestion")
async def apply_schedule_suggestion(req: ApplyScheduleSuggestionRequest):
    """Apply a schedule change and record one audit event."""
    db = get_supabase()

    # Verify medication exists and belongs to user
    result = (
        db.table("medications")
        .select("*")
        .eq("id", req.target_medication_id)
        .eq("user_id", req.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Medication not found")

    old_schedule = result.data[0].get("schedule", {})

    # Update the schedule
    db.table("medications").update(
        {"schedule": req.suggested_schedule.model_dump()}
    ).eq("id", req.target_medication_id).execute()

    # Write a single audit event
    try:
        db.table("schedule_adjustment_events").insert(
            {
                "user_id": req.user_id,
                "target_medication_id": req.target_medication_id,
                "old_schedule": old_schedule,
                "suggested_schedule": req.suggested_schedule.model_dump(),
                "reason": req.reason,
                "applied": True,
                "applied_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception:
        pass  # Audit failure should not block the update

    return {
        "status": "updated",
        "target_medication_id": req.target_medication_id,
        "old_schedule": old_schedule,
        "new_schedule": req.suggested_schedule.model_dump(),
    }
