from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.medication import ParsedMedicationCandidate, ParseMedicationTextRequest
from app.services.gemini import parse_medication_text, parse_medication_photo

router = APIRouter()


@router.post("/parse-medication-text", response_model=ParsedMedicationCandidate)
async def parse_text(req: ParseMedicationTextRequest):
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text cannot be empty")
    return await parse_medication_text(req.raw_text)


@router.post("/parse-medication-photo", response_model=ParsedMedicationCandidate)
async def parse_photo(
    image: UploadFile = File(...),
    user_id: str = Form(...),
):
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file")
    content_type = image.content_type or "image/jpeg"
    return await parse_medication_photo(content, content_type)
