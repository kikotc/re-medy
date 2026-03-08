from datetime import timedelta
from fastapi import APIRouter

from app.database import get_supabase
from app.models.analysis import ADRAnalysisRequest, ADRAnalysisResponse
from app.services.analysis import run_adr_analysis

router = APIRouter()


@router.post("/side-effects/analyze", response_model=ADRAnalysisResponse)
async def analyze_side_effects(req: ADRAnalysisRequest):
    db = get_supabase()

    meds_result = (
        db.table("medications")
        .select("*")
        .eq("user_id", req.user_id)
        .execute()
    )
    medications = meds_result.data or []

    start_date = (req.date - timedelta(days=7)).isoformat()
    logs_result = (
        db.table("med_logs")
        .select("*")
        .eq("user_id", req.user_id)
        .gte("date", start_date)
        .lte("date", req.date.isoformat())
        .execute()
    )
    recent_logs = logs_result.data or []

    effect_query = req.effect.strip().lower()
    side_effect_rules = []

    try:
        rules_result = (
            db.table("side_effect_rules")
            .select("*")
            .ilike("effect", f"%{effect_query}%")
            .execute()
        )
        side_effect_rules = rules_result.data or []
    except Exception:
        side_effect_rules = []

    return await run_adr_analysis(
        effect=req.effect,
        severity=req.severity,
        medications=medications,
        recent_logs=recent_logs,
        side_effect_rules=side_effect_rules,
    )