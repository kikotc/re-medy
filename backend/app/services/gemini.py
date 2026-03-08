"""Gemini integration for medication parsing (text + photo), autofill, interaction checking, and ADR analysis."""

import base64
import json
import logging

import google.generativeai as genai

from app.config import get_settings
from app.models.medication import AutofillFieldsRequest, ParsedMedicationCandidate, Schedule

logger = logging.getLogger(__name__)
_configured = False


def _ensure_configured():
    global _configured
    if not _configured:
        api_key = get_settings().GEMINI_API_KEY
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is missing")
        genai.configure(api_key=api_key)
        _configured = True


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


MEDICATION_JSON_SCHEMA = """\
Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "display_name": "<brand or common name, empty string if unknown>",
  "normalized_name": "<generic/active ingredient name, lowercase, or 'unknown'>",
  "active_ingredients": [
    {"name": "<ingredient>", "strength": "<e.g. 200 mg>"}
  ],
  "dosage_text": "<e.g. 200 mg, or empty string if unknown>",
  "instructions": "<e.g. take after meals, or empty string if unknown>",
  "schedule": {
    "recurrence_type": "daily" or "weekly",
    "days_of_week": [],
    "times": ["HH:MM"]
  } or null,
  "needs_review": <true if uncertain>,
  "confidence": <0.0 to 1.0>
}
Rules:
- Never return null for display_name, normalized_name, dosage_text, or instructions.
- Use empty string instead of null for missing text fields.
- Only include a schedule if the label or text actually supports it.
- If you cannot infer a schedule, set "schedule" to null and set needs_review to true.
"""


def _safe_parse_candidate(raw: str) -> ParsedMedicationCandidate:
    text = _strip_markdown_fences(raw)
    data = json.loads(text)

    if not isinstance(data, dict):
        raise ValueError("Gemini response was not a JSON object")

    schedule = data.get("schedule")
    if schedule is None:
        schedule_data = None
    else:
        schedule_data = {
            "recurrence_type": schedule.get("recurrence_type") or "daily",
            "days_of_week": schedule.get("days_of_week") or [],
            "times": schedule.get("times") or [],
        }

    cleaned = {
        "display_name": data.get("display_name") or "Unknown",
        "normalized_name": data.get("normalized_name") or "unknown",
        "active_ingredients": data.get("active_ingredients") or [],
        "dosage_text": data.get("dosage_text") or "",
        "instructions": data.get("instructions") or "",
        "schedule": schedule_data,
        "needs_review": bool(data.get("needs_review", False)),
        "confidence": float(data.get("confidence", 0.0) or 0.0),
    }

    return ParsedMedicationCandidate(**cleaned)


def _fallback_candidate(
    *,
    display_name: str,
    dosage_text: str = "",
    instructions: str = "",
    schedule: Schedule | None = None,
) -> ParsedMedicationCandidate:
    return ParsedMedicationCandidate(
        display_name=display_name or "Unknown",
        normalized_name="unknown",
        active_ingredients=[],
        dosage_text=dosage_text,
        instructions=instructions,
        schedule=schedule,
        needs_review=True,
        confidence=0.0,
    )


async def parse_medication_text(raw_text: str) -> ParsedMedicationCandidate:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    prompt = (
        "You are a medication parsing assistant. Parse the following medication text into structured JSON.\n\n"
        f'Input: "{raw_text}"\n\n'
        f"{MEDICATION_JSON_SCHEMA}"
    )

    try:
        response = model.generate_content(prompt)
        logger.info("Gemini parse_medication_text raw response: %s", response.text)
        return _safe_parse_candidate(response.text)
    except Exception as e:
        logger.exception("parse_medication_text failed: %s", e)
        return _fallback_candidate(
            display_name=raw_text.split()[0] if raw_text.strip() else "Unknown",
            instructions=raw_text,
            schedule=None,
        )


async def parse_medication_photo(
    image_bytes: bytes,
    content_type: str = "image/jpeg",
) -> ParsedMedicationCandidate:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    b64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = (
        "You are a medication parsing assistant. Look at this medication label, bottle, or box photo "
        "and extract the medication information into structured JSON.\n\n"
        f"{MEDICATION_JSON_SCHEMA}"
    )

    try:
        response = model.generate_content(
            [
                prompt,
                {"mime_type": content_type, "data": b64},
            ]
        )
        logger.info("Gemini parse_medication_photo raw response: %s", response.text)
        return _safe_parse_candidate(response.text)
    except Exception as e:
        logger.exception("parse_medication_photo failed: %s", e)
        return _fallback_candidate(
            display_name="Unknown",
            instructions="Could not parse image",
            schedule=None,
        )


async def autofill_from_fields(req: AutofillFieldsRequest) -> ParsedMedicationCandidate:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    provided_parts: list[str] = []
    if req.display_name:
        provided_parts.append(f'Medication name: "{req.display_name}"')
    if req.dosage_text:
        provided_parts.append(f'Dosage: "{req.dosage_text}"')
    if req.instructions:
        provided_parts.append(f'Instructions: "{req.instructions}"')
    if req.schedule:
        sched_desc = f"Schedule recurrence: {req.schedule.recurrence_type}"
        if req.schedule.days_of_week:
            sched_desc += f", days: {req.schedule.days_of_week}"
        if req.schedule.times:
            sched_desc += f", times: {req.schedule.times}"
        provided_parts.append(sched_desc)

    provided_text = "\n".join(provided_parts)

    prompt = (
        "You are a medication autofill assistant. A user is filling out a medication form "
        "and has provided some fields. Fill in only the missing fields.\n\n"
        f"Fields the user has already filled in:\n{provided_text}\n\n"
        "IMPORTANT RULES:\n"
        "- DO NOT change or override any field the user already provided.\n"
        "- For display_name: keep exactly what the user typed.\n"
        "- For normalized_name: provide the generic drug name in lowercase when known.\n"
        "- For active_ingredients: list known active ingredients when known.\n"
        "- For dosage_text: if already provided, keep it.\n"
        "- For instructions: if already provided, keep it.\n"
        "- For schedule: if the user already set one, keep it exactly.\n"
        "- If you cannot confidently identify the medication, set needs_review=true and confidence below 0.5.\n"
        "- If you cannot infer a schedule, set schedule to null. Do not invent 09:00.\n\n"
        f"{MEDICATION_JSON_SCHEMA}"
    )

    try:
        response = model.generate_content(prompt)
        logger.info("Gemini autofill_from_fields raw response: %s", response.text)
        candidate = _safe_parse_candidate(response.text)

        if req.display_name:
            candidate.display_name = req.display_name
        if req.dosage_text:
            candidate.dosage_text = req.dosage_text
        if req.instructions:
            candidate.instructions = req.instructions
        if req.schedule:
            candidate.schedule = req.schedule

        return candidate
    except Exception as e:
        logger.exception("autofill_from_fields failed: %s", e)
        return _fallback_candidate(
            display_name=req.display_name or "Unknown",
            dosage_text=req.dosage_text or "",
            instructions=req.instructions or "",
            schedule=req.schedule,
        )


async def check_interactions_gemini(
    candidate_ingredients: list[dict],
    existing_medications: list[dict],
) -> list[dict]:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    candidate_json = json.dumps(candidate_ingredients, indent=2, default=str)
    existing_json = json.dumps(existing_medications, indent=2, default=str)

    prompt = (
        "You are a pharmacology interaction checker. A patient wants to add a new medication.\n\n"
        f"New medication active ingredients:\n{candidate_json}\n\n"
        f"Their existing medications:\n{existing_json}\n\n"
        "Check for:\n"
        "1. Duplicate active ingredients\n"
        "2. Known drug-drug interactions\n\n"
        "Return ONLY valid JSON (no markdown) as an array of objects:\n"
        "[\n"
        "  {\n"
        '    "type": "duplicate_ingredient" or "interaction",\n'
        '    "ingredient_a": "<from new med>",\n'
        '    "ingredient_b": "<from existing med>",\n'
        '    "with_medication_id": "<id of existing>",\n'
        '    "with_medication_name": "<display_name of existing>",\n'
        '    "severity": "major" | "moderate" | "minor",\n'
        '    "reason": "<brief clinical reason>",\n'
        '    "auto_reschedulable": true/false,\n'
        '    "separation_hours": number or null,\n'
        '    "guidance": "<what patient should do>"\n'
        "  }\n"
        "]\n\n"
        "Rules:\n"
        '- For duplicates: severity="major", auto_reschedulable=false, separation_hours=null.\n'
        "- auto_reschedulable should only be true for timing or absorption-based interactions.\n"
        "- If no issues, return []\n"
        "- Be conservative. Do not invent interactions.\n"
    )

    try:
        response = model.generate_content(prompt)
        text = _strip_markdown_fences(response.text)
        result = json.loads(text)
        return result if isinstance(result, list) else []
    except Exception as e:
        logger.exception("check_interactions_gemini failed: %s", e)
        return []


async def analyze_adr(
    effect: str,
    severity: str,
    medications: list[dict],
    recent_logs: list[dict],
    side_effect_rules: list[dict] | None = None,
) -> dict:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.5-flash-lite")

    meds_json = json.dumps(medications, indent=2, default=str)
    logs_json = json.dumps(recent_logs, indent=2, default=str)

    rules_section = ""
    if side_effect_rules:
        rules_json = json.dumps(side_effect_rules, indent=2, default=str)
        rules_section = (
            "\nKnown side effect rules from our database (use these to ground your analysis):\n"
            f"{rules_json}\n"
        )

    prompt = (
        "You are a medication safety analysis assistant. A patient reported:\n\n"
        f"Effect: {effect}\n"
        f"Severity: {severity}\n\n"
        f"Current medications:\n{meds_json}\n\n"
        f"Recent medication logs (last 7 days):\n{logs_json}\n"
        f"{rules_section}\n"
        "Analyze which medications are most likely causing this side effect.\n\n"
        "Return ONLY valid JSON (no markdown):\n"
        "{\n"
        '  "likely_culprits": [\n'
        "    {\n"
        '      "medication_id": "<id from medications list>",\n'
        '      "display_name": "<name>",\n'
        '      "likelihood": "high" | "possible" | "unlikely",\n'
        '      "reason": "<brief explanation>"\n'
        "    }\n"
        "  ],\n"
        '  "warning_level": "low" | "medium" | "high"\n'
        "}\n\n"
        "Rules:\n"
        "- Rank most to least likely.\n"
        "- Only include plausible culprits.\n"
        "- Prioritize known side effect rules if provided.\n"
        "- Be concise. This is decision support, not a diagnosis.\n"
    )

    try:
        response = model.generate_content(prompt)
        text = _strip_markdown_fences(response.text)
        return json.loads(text)
    except Exception as e:
        logger.exception("analyze_adr failed: %s", e)
        return {"likely_culprits": [], "warning_level": "low"}