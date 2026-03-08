import {
  ADRAnalysisRequest,
  ADRAnalysisResponse,
  AutofillFieldsRequest,
  ConflictCheckRequest,
  ConflictCheckResponse,
  Medication,
  MedicationCreateRequest,
  MedicationCreateResponse,
  MedicationDraft,
  MedicationLogCreateRequest,
  MedicationSchedule,
  MonthlyScheduleResponse,
  ParsedMedicationCandidate,
  ScheduleItem,
  SideEffectLogCreateRequest,
  WeeklyScheduleResponse,
} from "./types";

// ── Config ──────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const DEMO_USER = "demo-user";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Medications CRUD ────────────────────────────────────────────

export async function getMedications(): Promise<Medication[]> {
  return apiFetch<Medication[]>(`/medications/${DEMO_USER}`);
}

export async function createMedication(
  data: MedicationCreateRequest
): Promise<MedicationCreateResponse> {
  return apiFetch<MedicationCreateResponse>("/medications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Parsing / Autofill ──────────────────────────────────────────

export async function parseMedicationText(
  rawText: string
): Promise<ParsedMedicationCandidate> {
  return apiFetch<ParsedMedicationCandidate>("/parse-medication-text", {
    method: "POST",
    body: JSON.stringify({ raw_text: rawText, user_id: DEMO_USER }),
  });
}

export async function parseMedicationPhoto(
  imageFile: File
): Promise<ParsedMedicationCandidate> {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("user_id", DEMO_USER);

  const res = await fetch(`${API_BASE}/parse-medication-photo`, {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function autofillFields(
  req: AutofillFieldsRequest
): Promise<ParsedMedicationCandidate> {
  return apiFetch<ParsedMedicationCandidate>("/autofill-fields", {
    method: "POST",
    body: JSON.stringify({ ...req, user_id: DEMO_USER }),
  });
}

// ── Conflict Check ──────────────────────────────────────────────

export async function checkConflicts(
  req: ConflictCheckRequest
): Promise<ConflictCheckResponse> {
  return apiFetch<ConflictCheckResponse>("/conflicts/check", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Schedule ────────────────────────────────────────────────────

export async function getWeeklySchedule(
  weekStart: string
): Promise<WeeklyScheduleResponse> {
  return apiFetch<WeeklyScheduleResponse>(
    `/schedule/${DEMO_USER}?week_start=${weekStart}`
  );
}

export async function getMonthlySchedule(
  year: number,
  month: number
): Promise<MonthlyScheduleResponse> {
  return apiFetch<MonthlyScheduleResponse>(
    `/schedule/${DEMO_USER}/month?year=${year}&month=${month}`
  );
}

export async function getTodaySchedule(
  targetDate?: string
): Promise<ScheduleItem[]> {
  const params = targetDate ? `?target_date=${targetDate}` : "";
  return apiFetch<ScheduleItem[]>(`/today/${DEMO_USER}${params}`);
}

// ── Medication Logs ─────────────────────────────────────────────

export async function logMedicationTaken(
  req: MedicationLogCreateRequest
): Promise<{ status: string; id: string }> {
  return apiFetch<{ status: string; id: string }>("/med-logs", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Side Effects ────────────────────────────────────────────────

export async function logSideEffect(
  data: SideEffectLogCreateRequest
): Promise<{ status: string; id: string }> {
  return apiFetch<{ status: string; id: string }>("/side-effects/log", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function analyzeSideEffect(
  req: ADRAnalysisRequest
): Promise<ADRAnalysisResponse> {
  return apiFetch<ADRAnalysisResponse>("/side-effects/analyze", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── Draft conversion helpers ────────────────────────────────────

export function medicationDraftToSchedule(
  draft: MedicationDraft
): MedicationSchedule {
  return {
    recurrence_type: draft.recurrenceType,
    days_of_week: draft.recurrenceType === "weekly" ? draft.daysOfWeek : [],
    times: draft.time ? [draft.time] : [],
  };
}

export function medicationDraftToConflictPayload(
  draft: MedicationDraft
): ConflictCheckRequest {
  return {
    user_id: DEMO_USER,
    candidate_medication: {
      display_name: draft.displayName,
      normalized_name: draft.normalizedName || null,
      active_ingredients:
        draft.activeIngredients.length > 0
          ? draft.activeIngredients.map((i) => ({
              name: i.name,
              strength: i.strength,
            }))
          : null,
      dosage_text: draft.dosageText,
      instructions: draft.instructions,
      schedule: medicationDraftToSchedule(draft),
    },
  };
}

export function medicationDraftToCreatePayload(
  draft: MedicationDraft,
  userId: string
): MedicationCreateRequest {
  return {
    user_id: userId,
    display_name: draft.displayName,
    normalized_name: draft.normalizedName,
    active_ingredients: draft.activeIngredients.map((i) => ({
      name: i.name,
      strength: i.strength,
    })),
    dosage_text: draft.dosageText,
    instructions: draft.instructions,
    start_date: new Date().toISOString().slice(0, 10),
    source: draft.source,
    schedule: medicationDraftToSchedule(draft),
  };
}
