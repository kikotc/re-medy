"""Expand stored medication schedules into concrete ScheduleItems for a date range."""

from datetime import date, timedelta
import hashlib

from app.models.medication import Medication, ScheduleItem, DaySchedule, WeeklyScheduleResponse

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _make_schedule_item_id(med_id: str, d: date, time: str) -> str:
    """Deterministic schedule item ID so frontend can reference it."""
    raw = f"{med_id}:{d.isoformat()}:{time}"
    return "sched_" + hashlib.md5(raw.encode()).hexdigest()[:12]


def _should_include(med: Medication, d: date) -> bool:
    """Check if a medication is active on a given date."""
    if med.start_date and d < med.start_date:
        return False
    return True


def _matches_day(med: Medication, d: date) -> bool:
    """Check if the medication's schedule includes this day of week."""
    sched = med.schedule
    if sched.recurrence_type == "daily":
        return True
    if sched.recurrence_type == "weekly":
        day_name = DAY_NAMES[d.weekday()]
        if not sched.days_of_week:
            # No specific days → treat as daily
            return True
        return day_name in [dow.lower() for dow in sched.days_of_week]
    return False


def expand_schedule_for_date(
    medications: list[Medication],
    target_date: date,
    taken_lookup: dict[str, bool] | None = None,
) -> list[ScheduleItem]:
    """Expand all medications into ScheduleItems for a single date."""
    items: list[ScheduleItem] = []
    taken_lookup = taken_lookup or {}

    for med in medications:
        if not _should_include(med, target_date):
            continue
        if not _matches_day(med, target_date):
            continue
        for t in med.schedule.times:
            sid = _make_schedule_item_id(med.id, target_date, t)
            items.append(ScheduleItem(
                schedule_item_id=sid,
                medication_id=med.id,
                display_name=med.display_name,
                date=target_date,
                scheduled_time=t,
                taken=taken_lookup.get(f"{med.id}:{target_date.isoformat()}:{t}", False),
            ))

    # Sort by time
    items.sort(key=lambda x: x.scheduled_time)
    return items


def expand_weekly_schedule(
    medications: list[Medication],
    week_start: date,
    taken_lookup: dict[str, bool] | None = None,
) -> WeeklyScheduleResponse:
    """Build a full WeeklyScheduleResponse for 7 days starting at week_start."""
    days: list[DaySchedule] = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        items = expand_schedule_for_date(medications, d, taken_lookup)
        days.append(DaySchedule(date=d, items=items))

    return WeeklyScheduleResponse(
        user_id=medications[0].user_id if medications else "",
        week_start=week_start,
        days=days,
    )
