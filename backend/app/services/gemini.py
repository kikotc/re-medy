"""Gemini integration for medication parsing (text + photo), autofill, interaction checking, and ADR analysis."""

import json
import base64
import google.generativeai as genai
from app.config import get_settings
from app.models.medication import ParsedMedicationCandidate, Schedule, AutofillFieldsRequest

_configured = False


def _ensure_configured():
    global _configured
    if not _configured:
        genai.configure(api_key=get_settings().GEMINI_API_KEY)
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
  "display_name": "<brand or common name>",
  "normalized_name": "<generic/active ingredient name, lowercase>",
  "active_ingredients": [
    {"name": "<ingredient>", "strength": "<e.g. 200 mg>"}
  ],
  "dosage_text": "<e.g. 200 mg>",
  "instructions": "<e.g. take after meals>",
  "schedule": {
    "recurrence_type": "daily" or "weekly",
    "days_of_week": [],
    "times": ["HH:MM"]
  },
  "needs_review": <true if uncertain>,
  "confidence": <0.0 to 1.0>
}
Rules:
- If you can infer a schedule (e.g. "twice daily" → ["09:00","21:00"]), do so.
- If you cannot infer the schedule, use a single default time ["09:00"] and set needs_review to true.
- "weekly" recurrence_type should include days_of_week like ["monday","wednesday"].
- Confidence should reflect how sure you are about the parse.
- normalized_name should be the generic drug name in lowercase.
"""


def _safe_parse_candidate(raw: str) -> ParsedMedicationCandidate:
    text = _strip_markdown_fences(raw)
    data = json.loads(text)
    return ParsedMedicationCandidate(**data)


# ── Text parsing ────────────────────────────────────────────────

async def parse_medication_text(raw_text: str) -> ParsedMedicationCandidate:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = (
        'You are a medication parsing assistant. Parse the following medication text into structured JSON.\n\n'
        f'Input: "{raw_text}"\n\n'
        f'{MEDICATION_JSON_SCHEMA}'
    )
    try:
        response = model.generate_content(prompt)
        return _safe_parse_candidate(response.text)
    except Exception:
        return ParsedMedicationCandidate(
            display_name=raw_text.split()[0] if raw_text.strip() else "Unknown",
            normalized_name="unknown",
            active_ingredients=[],
            dosage_text="",
            instructions=raw_text,
            schedule=Schedule(),
            needs_review=True,
            confidence=0.0,
        )


# ── Photo parsing ───────────────────────────────────────────────

async def parse_medication_photo(image_bytes: bytes, content_type: str = "image/jpeg") -> ParsedMedicationCandidate:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    b64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = (
        'You are a medication parsing assistant. Look at this medication label/bottle/box photo '
        'and extract the medication information into structured JSON.\n\n'
        f'{MEDICATION_JSON_SCHEMA}'
    )
    try:
        response = model.generate_content([
            prompt,
            {"mime_type": content_type, "data": b64},
        ])
        return _safe_parse_candidate(response.text)
    except Exception:
        return ParsedMedicationCandidate(
            display_name="Unknown",
            normalized_name="unknown",
            active_ingredients=[],
            dosage_text="",
            instructions="Could not parse image",
            schedule=Schedule(),
            needs_review=True,
            confidence=0.0,
        )


# ── Autofill from partial form fields ───────────────────────────

async def autofill_from_fields(req: AutofillFieldsRequest) -> ParsedMedicationCandidate:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    provided_parts: list[str] = []
    if req.display_name:
        provided_parts.append(f'Medication name: "{req.display_name}"')
    if req.dosage_text:
        provided_parts.append(f'Dosage: "{req.dosage_text}"')
    if req.instructions:
        provided_parts.append(f'Instructions: "{req.instructions}"')
    if req.schedule:
        sched_desc = f'Schedule: {req.schedule.recurrence_type}'
        if req.schedule.days_of_week:
            sched_desc += f', days: {req.schedule.days_of_week}'
        if req.schedule.times:
            sched_desc += f', times: {req.schedule.times}'
        provided_parts.append(sched_desc)

    provided_text = "\n".join(provided_parts)

    prompt = (
        'You are a medication autofill assistant. A user is filling out a medication form '
        'and has provided some fields. Your job is to fill in the missing fields.\n\n'
        f'Fields the user has already filled in:\n{provided_text}\n\n'
        'IMPORTANT RULES:\n'
        '- DO NOT change or override any field the user already provided.\n'
        '- Fill in missing fields based on what you can infer.\n'
        '- For display_name: keep exactly what the user typed.\n'
        '- For normalized_name: provide the generic drug name in lowercase.\n'
        '- For active_ingredients: look up the known active ingredients.\n'
        '- For dosage_text: if provided, keep it. Otherwise infer a common dosage.\n'
        '- For instructions: if not provided, suggest common instructions.\n'
        '- For schedule: if the user set one, keep it. Otherwise suggest a reasonable default.\n'
        '- If you cannot confidently identify the medication, set needs_review to true and confidence below 0.5.\n'
        '- If the name looks like gibberish, still return valid JSON with needs_review=true, '
        'confidence=0.0, and active_ingredients as empty array.\n\n'
        f'{MEDICATION_JSON_SCHEMA}'
    )
    try:
        response = model.generate_content(prompt)
        candidate = _safe_parse_candidate(response.text)

        # User-provided fields always take priority
        if req.display_name:
            candidate.display_name = req.display_name
        if req.dosage_text:
            candidate.dosage_text = req.dosage_text
        if req.instructions:
            candidate.instructions = req.instructions
        if req.schedule:
            candidate.schedule = req.schedule

        return candidate
    except Exception:
        return ParsedMedicationCandidate(
            display_name=req.display_name or "Unknown",
            normalized_name="unknown",
            active_ingredients=[],
            dosage_text=req.dosage_text or "",
            instructions=req.instructions or "",
            schedule=req.schedule or Schedule(),
            needs_review=True,
            confidence=0.0,
        )


# ── Interaction checking ─────────────────────────────────────────

async def check_interactions_gemini(
    candidate_ingredients: list[dict],
    existing_medications: list[dict],
) -> list[dict]:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    candidate_json = json.dumps(candidate_ingredients, indent=2, default=str)
    existing_json = json.dumps(existing_medications, indent=2, default=str)

    prompt = (
        'You are a pharmacology interaction checker. A patient wants to add a new medication.\n\n'
        f'New medication active ingredients:\n{candidate_json}\n\n'
        f'Their existing medications:\n{existing_json}\n\n'
        'Check for:\n'
        '1. Duplicate active ingredients (same ingredient in both new and existing)\n'
        '2. Known drug-drug interactions\n\n'
        'Return ONLY valid JSON (no markdown) as an array of objects:\n'
        '[\n'
        '  {\n'
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
        '  }\n'
        ']\n\n'
        'Rules:\n'
        '- For duplicates: severity="major", auto_reschedulable=false, separation_hours=null.\n'
        '- auto_reschedulable only true for absorption-based interactions.\n'
        '- If no issues, return empty array: []\n'
        '- Be conservative. Do not invent interactions.\n'
    )
    try:
        response = model.generate_content(prompt)
        text = _strip_markdown_fences(response.text)
        result = json.loads(text)
        return result if isinstance(result, list) else []
    except Exception:
        return []


# ── ADR analysis ────────────────────────────────────────────────

async def analyze_adr(
    effect: str,
    severity: str,
    medications: list[dict],
    recent_logs: list[dict],
    side_effect_rules: list[dict] | None = None,
) -> dict:
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    meds_json = json.dumps(medications, indent=2, default=str)
    logs_json = json.dumps(recent_logs, indent=2, default=str)

    rules_section = ""
    if side_effect_rules:
        rules_json = json.dumps(side_effect_rules, indent=2, default=str)
        rules_section = (
            '\nKnown side effect rules from our database (use these to ground your analysis):\n'
            f'{rules_json}\n'
        )

    prompt = (
        'You are a medication safety analysis assistant. A patient reported:\n\n'
        f'Effect: {effect}\n'
        f'Severity: {severity}\n\n'
        f'Current medications:\n{meds_json}\n\n'
        f'Recent medication logs (last 7 days):\n{logs_json}\n'
        f'{rules_section}\n'
        'Analyze which medications are most likely causing this side effect.\n\n'
        'Return ONLY valid JSON (no markdown):\n'
        '{\n'
        '  "likely_culprits": [\n'
        '    {\n'
        '      "medication_id": "<id from medications list>",\n'
        '      "display_name": "<name>",\n'
        '      "likelihood": "high" | "possible" | "unlikely",\n'
        '      "reason": "<brief explanation>"\n'
        '    }\n'
        '  ],\n'
        '  "warning_level": "low" | "medium" | "high"\n'
        '}\n\n'
        'Rules:\n'
        '- Rank most to least likely.\n'
        '- Only include plausible culprits.\n'
        '- Prioritize known side effect rules if provided.\n'
        '- Be concise. This is decision support, not a diagnosis.\n'
    )
    try:
        response = model.generate_content(prompt)
        text = _strip_markdown_fences(response.text)
        return json.loads(text)
    except Exception:
        return {"likely_culprits": [], "warning_level": "low"}
    