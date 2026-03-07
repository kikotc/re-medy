from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.medication import (
    ParsedMedicationCandidate,
    ParseMedicationTextRequest,
    AutofillFieldsRequest,
)
from app.services.gemini import parse_medication_text, parse_medication_photo, autofill_from_fields

router = APIRouter()


@router.post("/parse-medication-text", response_model=ParsedMedicationCandidate)
async def parse_text(req: ParseMedicationTextRequest):
    """Parse free-form text like 'Advil 200mg twice daily after meals' into structured data."""
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text cannot be empty")
    return await parse_medication_text(req.raw_text)


@router.post("/parse-medication-photo", response_model=ParsedMedicationCandidate)
async def parse_photo(
    image: UploadFile = File(...),
    user_id: str = Form(...),
):
    """Parse a photo of a medication label/bottle into structured data."""
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file")
    content_type = image.content_type or "image/jpeg"
    return await parse_medication_photo(content, content_type)


@router.post("/autofill-fields", response_model=ParsedMedicationCandidate)
async def autofill_fields(req: AutofillFieldsRequest):
    """Autofill missing form fields using Gemini.

    Frontend sends whatever the user has already typed (e.g. just display_name='Tylenol').
    Gemini fills in normalized_name, active_ingredients, dosage, schedule, etc.
    Fields the user already provided are preserved — Gemini only fills gaps.
    """
    if not req.display_name and not req.dosage_text and not req.instructions:
        raise HTTPException(status_code=400, detail="At least one field must be provided")
    return await autofill_from_fields(req)
