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


# ── Shared helpers ───────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """Remove markdown code fences from Gemini output."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


# ── Shared JSON schema prompt fragment ──────────────────────────

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
    """Parse Gemini response text into a validated Pydantic model."""
    text = _strip_markdown_fences(raw)
    data = json.loads(text)
    return ParsedMedicationCandidate(**data)


# ── Text parsing ────────────────────────────────────────────────

async def parse_medication_text(raw_text: str) -> ParsedMedicationCandidate:
    """Use Gemini to parse free-text medication entry."""
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
    """Use Gemini vision to extract medication info from a photo."""
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
    """Use Gemini to fill in missing fields from a partially completed form.

    The user may have typed just a medication name, or a name + dosage, etc.
    Gemini should fill in everything it can and preserve what the user already provided.
    """
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    # Build a description of what the user has provided
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
        'and has provided some fields. Your job is to fill in the missing fields based on '
        'what they have given you.\n\n'
        f'Fields the user has already filled in:\n{provided_text}\n\n'
        'IMPORTANT RULES:\n'
        '- DO NOT change or override any field the user already provided.\n'
        '- Fill in missing fields based on what you can infer from the provided fields.\n'
        '- For display_name: keep exactly what the user typed.\n'
        '- For normalized_name: provide the generic drug name in lowercase.\n'
        '- For active_ingredients: look up the known active ingredients for this medication.\n'
        '- For dosage_text: if the user provided it, keep it. Otherwise infer a common dosage.\n'
        '- For instructions: if not provided, suggest common instructions for this medication.\n'
        '- For schedule: if the user set a schedule, keep it. Otherwise suggest a reasonable default.\n'
        '- If you cannot confidently identify the medication, set needs_review to true and confidence below 0.5.\n'
        '- If the medication name looks like gibberish or you do not recognize it, still return valid JSON '
        'but set needs_review to true, confidence to 0.0, and leave active_ingredients as an empty array.\n\n'
        f'{MEDICATION_JSON_SCHEMA}'
    )
    try:
        response = model.generate_content(prompt)
        candidate = _safe_parse_candidate(response.text)

        # Enforce: user-provided fields take priority
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
    """Use Gemini to detect drug-drug interactions and duplicate ingredients."""
    _ensure_configured()
    model = genai.GenerativeModel("gemini-2.0-flash")

    candidate_json = json.dumps(candidate_ingredients, indent=2, default=str)
    existing_json = json.dumps(existing_medications, indent=2, default=str)

    prompt = (
        'You are a pharmacology interaction checker. A patient wants to add a new medication.\n\n'
        f'New medication active ingredients:\n{candidate_json}\n\n'
        f'Their existing medications:\n{existing_json}\n\n'
        'Check for:\n'
        '1. Duplicate active ingredients (same ingredient appearing in both new and existing)\n'
        '2. Known drug-drug interactions between any ingredient in the new med and any ingredient in existing meds\n\n'
        'Return ONLY valid JSON (no markdown, no explanation) as an array of objects:\n'
        '[\n'
        '  {\n'
        '    "type": "duplicate_ingredient" or "interaction",\n'
        '    "ingredient_a": "<ingredient from new med>",\n'
        '    "ingredient_b": "<ingredient from existing med>",\n'
        '    "with_medication_id": "<id of the existing medication>",\n'
        '    "with_medication_name": "<display_name of the existing medication>",\n'
        '    "severity": "major" | "moderate" | "minor",\n'
        '    "reason": "<brief clinical reason>",\n'
        '    "auto_reschedulable": true/false,\n'
        '    "separation_hours": number or null,\n'
        '    "guidance": "<what the patient should do>"\n'
        '  }\n'
        ']\n\n'
        'Rules:\n'
        '- For duplicates, set severity to "major", auto_reschedulable to false, separation_hours to null.\n'
        '- For interactions, assess severity based on clinical significance.\n'
        '- auto_reschedulable should ONLY be true for absorption-based interactions where time separation actually helps.\n'
        '- If separation helps, provide a realistic separation_hours value (usually 2-4).\n'
        '- If there are NO interactions or duplicates, return an empty array: []\n'
        '- Be conservative: only flag clinically established interactions.\n'
        '- Do not invent interactions. If unsure, do not include it.\n'
    )
    try:
        response = model.generate_content(prompt)
        text = _strip_markdown_fences(response.text)
        result = json.loads(text)
        if isinstance(result, list):
            return result
        return []
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
    """Use Gemini to rank likely culprit medications for a reported side effect."""
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
        'You are a medication safety analysis assistant. A patient reported the following side effect:\n\n'
        f'Effect: {effect}\n'
        f'Severity: {severity}\n\n'
        f'Their current medications:\n{meds_json}\n\n'
        f'Recent medication logs (last 7 days):\n{logs_json}\n'
        f'{rules_section}\n'
        'Analyze which medications are most likely causing this side effect.\n\n'
        'Return ONLY valid JSON (no markdown, no explanation) matching this schema:\n'
        '{\n'
        '  "likely_culprits": [\n'
        '    {\n'
        '      "medication_id": "<id from the medications list>",\n'
        '      "display_name": "<n>",\n'
        '      "likelihood": "high" | "possible" | "unlikely",\n'
        '      "reason": "<brief explanation>"\n'
        '    }\n'
        '  ],\n'
        '  "warning_level": "low" | "medium" | "high"\n'
        '}\n\n'
        'Rules:\n'
        '- Rank from most to least likely.\n'
        '- Only include medications that are plausible culprits.\n'
        '- If known side effect rules are provided above, prioritize those mappings.\n'
        '- warning_level should be "high" if a dangerous reaction is likely, "medium" for moderate concern, "low" for mild/common.\n'
        '- Be concise in reasons. This is decision support, not a diagnosis.\n'
    )
    try:
        response = model.generate_content(prompt)
        text = _strip_markdown_fences(response.text)
        return json.loads(text)
    except Exception:
        return {"likely_culprits": [], "warning_level": "low"}
    