"""ADR (Adverse Drug Reaction) analysis service."""

from app.models.analysis import ADRAnalysisResponse, LikelyCulprit
from app.services.gemini import analyze_adr


async def run_adr_analysis(
    effect: str,
    severity: str,
    medications: list[dict],
    recent_logs: list[dict],
    side_effect_rules: list[dict] | None = None,
) -> ADRAnalysisResponse:
    """Run Gemini-powered ADR analysis and return validated response."""
    result = await analyze_adr(
        effect, severity, medications, recent_logs,
        side_effect_rules=side_effect_rules or [],
    )

    culprits = []
    for c in result.get("likely_culprits", []):
        try:
            culprits.append(LikelyCulprit(**c))
        except Exception:
            continue

    warning = result.get("warning_level", "low")
    if warning not in ("low", "medium", "high"):
        warning = "low"

    return ADRAnalysisResponse(
        effect=effect,
        likely_culprits=culprits,
        warning_level=warning,
    )
