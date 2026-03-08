"""Duplicate ingredient detection + interaction conflict checking.

Strategy:
1. Try Gemini for comprehensive interaction analysis
2. Fall back to Supabase interaction_rules table if Gemini fails
3. Merge & deduplicate results
"""

from app.models.medication import (
    ActiveIngredient,
    DuplicateRisk,
    InteractionConflict,
    Medication,
    Schedule,
    ScheduleSuggestion,
)
from app.services.gemini import check_interactions_gemini
from app.database import get_supabase


def _normalize(name: str) -> str:
    return name.strip().lower()


# ── Local-only checks ────────────────────────────────────────────

def check_duplicates(
    candidate_ingredients: list[ActiveIngredient],
    existing_meds: list[Medication],
) -> list[DuplicateRisk]:
    """Find duplicate active ingredients. Pure local logic — no AI needed."""
    duplicates: list[DuplicateRisk] = []
    candidate_names = {_normalize(i.name) for i in candidate_ingredients}

    for med in existing_meds:
        for ing in med.active_ingredients:
            if _normalize(ing.name) in candidate_names:
                duplicates.append(DuplicateRisk(
                    ingredient=ing.name,
                    with_medication_id=med.id,
                    with_medication_name=med.display_name,
                    reason=f"Both medications contain {ing.name}",
                ))
    return duplicates


def _check_interactions_from_db(
    candidate_ingredients: list[ActiveIngredient],
    existing_meds: list[Medication],
) -> list[InteractionConflict]:
    """Fallback: check against the interaction_rules table in Supabase."""
    db = get_supabase()
    conflicts: list[InteractionConflict] = []
    seen: set[tuple[str, str, str]] = set()

    try:
        result = db.table("interaction_rules").select("*").execute()
        rules = result.data or []
    except Exception:
        return []

    rule_lookup: dict[tuple[str, str], dict] = {}
    for rule in rules:
        a = _normalize(rule.get("ingredient_a", ""))
        b = _normalize(rule.get("ingredient_b", ""))
        rule_lookup[(a, b)] = rule
        rule_lookup[(b, a)] = rule

    for cand_ing in candidate_ingredients:
        for med in existing_meds:
            for med_ing in med.active_ingredients:
                key_lookup = (_normalize(cand_ing.name), _normalize(med_ing.name))
                rule = rule_lookup.get(key_lookup)
                if rule is None:
                    continue
                dedup_key = (_normalize(cand_ing.name), _normalize(med_ing.name), med.id)
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                severity = rule.get("severity", "moderate")
                if severity not in ("major", "moderate", "minor"):
                    severity = "moderate"

                conflicts.append(InteractionConflict(
                    ingredient_a=cand_ing.name,
                    ingredient_b=med_ing.name,
                    with_medication_id=med.id,
                    with_medication_name=med.display_name,
                    severity=severity,
                    reason=rule.get("reason", ""),
                    auto_reschedulable=bool(rule.get("auto_reschedulable", False)),
                    separation_hours=rule.get("separation_hours"),
                    guidance=rule.get("guidance", ""),
                ))
    return conflicts


# ── Gemini-powered interaction check ─────────────────────────────

def _parse_gemini_conflicts(raw_results: list[dict]) -> tuple[list[DuplicateRisk], list[InteractionConflict]]:
    """Parse Gemini's raw JSON results into typed models."""
    duplicates: list[DuplicateRisk] = []
    conflicts: list[InteractionConflict] = []

    for item in raw_results:
        try:
            if item.get("type") == "duplicate_ingredient":
                duplicates.append(DuplicateRisk(
                    ingredient=item.get("ingredient_a", ""),
                    with_medication_id=item.get("with_medication_id", ""),
                    with_medication_name=item.get("with_medication_name", ""),
                    reason=item.get("reason", "Duplicate ingredient detected"),
                ))
            elif item.get("type") == "interaction":
                severity = item.get("severity", "moderate")
                if severity not in ("major", "moderate", "minor"):
                    severity = "moderate"
                conflicts.append(InteractionConflict(
                    ingredient_a=item.get("ingredient_a", ""),
                    ingredient_b=item.get("ingredient_b", ""),
                    with_medication_id=item.get("with_medication_id", ""),
                    with_medication_name=item.get("with_medication_name", ""),
                    severity=severity,
                    reason=item.get("reason", ""),
                    auto_reschedulable=bool(item.get("auto_reschedulable", False)),
                    separation_hours=item.get("separation_hours"),
                    guidance=item.get("guidance", ""),
                ))
        except Exception:
            continue

    return duplicates, conflicts


async def check_interactions(
    candidate_ingredients: list[ActiveIngredient],
    existing_meds: list[Medication],
) -> tuple[list[DuplicateRisk], list[InteractionConflict]]:
    """Check for duplicates and interactions using Gemini, with local fallback."""
    local_duplicates = check_duplicates(candidate_ingredients, existing_meds)

    candidate_payload = [
        {"name": i.name, "strength": i.strength} for i in candidate_ingredients
    ]
    existing_payload = [
        {
            "id": med.id,
            "display_name": med.display_name,
            "normalized_name": med.normalized_name,
            "active_ingredients": [
                {"name": i.name, "strength": i.strength} for i in med.active_ingredients
            ],
        }
        for med in existing_meds
    ]

    db_conflicts = _check_interactions_from_db(candidate_ingredients, existing_meds)

    try:
        gemini_results = await check_interactions_gemini(candidate_payload, existing_payload)
        gemini_duplicates, gemini_conflicts = _parse_gemini_conflicts(gemini_results)

        seen_dup_keys: set[tuple[str, str]] = set()
        merged_duplicates: list[DuplicateRisk] = []
        for d in gemini_duplicates + local_duplicates:
            key = (_normalize(d.ingredient), d.with_medication_id)
            if key not in seen_dup_keys:
                seen_dup_keys.add(key)
                merged_duplicates.append(d)

        seen_conflict_keys: set[tuple[str, str, str]] = set()
        merged_conflicts: list[InteractionConflict] = []
        for c in db_conflicts + gemini_conflicts:
            key = (_normalize(c.ingredient_a), _normalize(c.ingredient_b), c.with_medication_id)
            if key not in seen_conflict_keys:
                seen_conflict_keys.add(key)
                merged_conflicts.append(c)

        return merged_duplicates, merged_conflicts

    except Exception:
        return local_duplicates, db_conflicts


# ── Schedule suggestions ─────────────────────────────────────────
# Point 7: now includes target_medication_id + target_medication_name
# so frontend knows which existing med needs the schedule change.

def generate_schedule_suggestions(
    candidate_schedule: Schedule,
    conflicts: list[InteractionConflict],
    existing_meds: list[Medication],
    candidate_display_name: str = "new medication",
) -> list[ScheduleSuggestion]:
    """Generate schedule adjustment suggestions.

    Prefer adjusting the existing medication when the conflict points to one.
    Fall back to adjusting the candidate medication.
    """
    suggestions: list[ScheduleSuggestion] = []

    med_lookup = {m.id: m for m in existing_meds}

    for conflict in conflicts:
        if not conflict.auto_reschedulable:
            suggestions.append(
                ScheduleSuggestion(
                    target_medication_id="candidate",
                    target_medication_name=candidate_display_name,
                    is_candidate=True,
                    allowed=False,
                    reason=f"Major interaction cannot be safely auto-rescheduled: {conflict.reason}",
                    change_type=None,
                    separation_hours=None,
                    original_schedule=candidate_schedule,
                    suggested_schedule=None,
                )
            )
            continue

        sep = conflict.separation_hours or 2

        # Prefer adjusting the existing medication if we can find it
        target_med = med_lookup.get(conflict.with_medication_id)

        if target_med:
            original_schedule = target_med.schedule
            new_times: list[str] = []
            for t in original_schedule.times:
                h, m = map(int, t.split(":"))
                new_h = (h + sep) % 24
                new_times.append(f"{new_h:02d}:{m:02d}")

            suggestions.append(
                ScheduleSuggestion(
                    target_medication_id=target_med.id,
                    target_medication_name=target_med.display_name,
                    is_candidate=False,
                    allowed=True,
                    reason=f"Separate {target_med.display_name} from {candidate_display_name} by at least {sep} hours",
                    change_type="separate_by_hours",
                    separation_hours=sep,
                    original_schedule=original_schedule,
                    suggested_schedule=Schedule(
                        recurrence_type=original_schedule.recurrence_type,
                        days_of_week=original_schedule.days_of_week,
                        times=new_times,
                    ),
                )
            )
        else:
            # Fall back to adjusting the candidate medication
            new_times: list[str] = []
            for t in candidate_schedule.times:
                h, m = map(int, t.split(":"))
                new_h = (h + sep) % 24
                new_times.append(f"{new_h:02d}:{m:02d}")

            suggestions.append(
                ScheduleSuggestion(
                    target_medication_id="candidate",
                    target_medication_name=candidate_display_name,
                    is_candidate=True,
                    allowed=True,
                    reason=f"Separate from {conflict.with_medication_name} by at least {sep} hours",
                    change_type="separate_by_hours",
                    separation_hours=sep,
                    original_schedule=candidate_schedule,
                    suggested_schedule=Schedule(
                        recurrence_type=candidate_schedule.recurrence_type,
                        days_of_week=candidate_schedule.days_of_week,
                        times=new_times,
                    ),
                )
            )

    return suggestions