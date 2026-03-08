import {
  ADRAnalysisResponse,
  Medication,
  MedicationCreateRequest,
  MedicationCreateResponse,
  MedicationDraft,
  MedicationLogCreateRequest,
  ScheduleItem,
  SideEffectLogCreateRequest,
  WeeklyScheduleResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

const DEMO_USER_ID = "demo-user";

type BackendDaySchedule = {
  date: string;
  items: ScheduleItem[];
};

export type MonthlyScheduleResponse = {
  user_id: string;
  year: number;
  month: number;
  days: BackendDaySchedule[];
};

export type ConflictDecisionStatus =
  | "SAFE_TO_ADD"
  | "WARNING_CONFIRM_REQUIRED"
  | "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
  | "UNCERTAIN_CONFIRM_REQUIRED";

export type ConflictCheckResponse = {
  decision_status: ConflictDecisionStatus;
  duplicates: Array<{
    type: "duplicate_ingredient";
    ingredient: string;
    with_medication_id: string;
    with_medication_name: string;
    reason: string;
  }>;
  conflicts: Array<{
    type: "interaction";
    ingredient_a: string;
    ingredient_b: string;
    with_medication_id: string;
    with_medication_name: string;
    severity: "major" | "moderate" | "minor";
    reason: string;
    auto_reschedulable: boolean;
    separation_hours: number | null;
    guidance: string;
  }>;
  schedule_suggestions: Array<{
    target_medication_id: string;
    target_medication_name: string;
    is_candidate: boolean;
    allowed: boolean;
    reason: string;
    change_type: string | null;
    separation_hours: number | null;
    original_schedule: {
      recurrence_type: "daily" | "weekly";
      days_of_week: string[];
      times: string[];
    } | null;
    suggested_schedule: {
      recurrence_type: "daily" | "weekly";
      days_of_week: string[];
      times: string[];
    } | null;
  }>;
  message: string;
};

type ADRAnalyzeRequest = {
  user_id: string;
  effect: string;
  severity: "mild" | "moderate" | "severe";
  date: string;
};

async function fetchJSON<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function getMedications(
  userId: string = DEMO_USER_ID
): Promise<Medication[]> {
  return fetchJSON<Medication[]>(`/medications/${userId}`);
}

export async function createMedication(
  data: MedicationCreateRequest
): Promise<MedicationCreateResponse> {
  return fetchJSON<MedicationCreateResponse>(`/medications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function checkConflicts(
  userId: string,
  payload: ReturnType<typeof medicationDraftToConflictPayload>
): Promise<ConflictCheckResponse> {
  return fetchJSON<ConflictCheckResponse>(`/conflicts/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      ...payload,
    }),
  });
}

export async function parseMedicationText(
  rawText: string,
  userId: string = DEMO_USER_ID
) {
  return fetchJSON(`/parse-medication-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw_text: rawText,
      user_id: userId,
    }),
  });
}

export async function parseMedicationPhoto(
  image: File,
  userId: string = DEMO_USER_ID
) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("user_id", userId);

  return fetchJSON(`/parse-medication-photo`, {
    method: "POST",
    body: formData,
  });
}

export async function autofillFields(
  fields: {
    display_name?: string;
    dosage_text?: string;
    instructions?: string;
    schedule?: {
      recurrence_type: "daily" | "weekly";
      days_of_week: string[];
      times: string[];
    };
  },
  userId: string = DEMO_USER_ID
) {
  return fetchJSON(`/autofill-fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      ...fields,
    }),
  });
}

export async function getMonthlySchedule(
  userId: string = DEMO_USER_ID,
  year?: number,
  month?: number
): Promise<MonthlyScheduleResponse> {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  return fetchJSON<MonthlyScheduleResponse>(
    `/schedule/${userId}/month?year=${y}&month=${m}`
  );
}

/**
 * Temporary compatibility adapter.
 * Your current Schedule page still expects WeeklyScheduleResponse,
 * so we adapt the real monthly backend response into that shape for now.
 */
export async function getWeeklySchedule(
  userId: string = DEMO_USER_ID
): Promise<WeeklyScheduleResponse> {
  const monthly = await getMonthlySchedule(userId);

  return {
    user_id: monthly.user_id,
    week_start: `${monthly.year}-${String(monthly.month).padStart(2, "0")}-01`,
    days: monthly.days,
  };
}

export async function getTodaySchedule(
  userId: string = DEMO_USER_ID,
  localDate: string = todayISO()
): Promise<ScheduleItem[]> {
  return fetchJSON<ScheduleItem[]>(
    `/today/${userId}?local_date=${localDate}`
  );
}

/**
 * Temporary compatibility signature:
 * current Today page still calls this with no args in some branches.
 */
export async function logMedicationTaken(
  data?: MedicationLogCreateRequest
): Promise<{ status?: string; id?: string; success?: true }> {
  if (!data) {
    return { success: true };
  }

  return fetchJSON(`/med-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function logSideEffect(
  data: SideEffectLogCreateRequest
): Promise<{ status?: string; id?: string; success?: true }> {
  return fetchJSON(`/side-effects/log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

/**
 * Temporary compatibility signature:
 * current Symptoms page still calls this with no payload in some branches.
 * Once you update Symptoms, pass the real request object.
 */
export async function analyzeSideEffect(
  data?: ADRAnalyzeRequest
): Promise<ADRAnalysisResponse> {
  const payload: ADRAnalyzeRequest = data ?? {
    user_id: DEMO_USER_ID,
    effect: "dizziness",
    severity: "mild",
    date: todayISO(),
  };

  return fetchJSON<ADRAnalysisResponse>(`/side-effects/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function applyScheduleSuggestion(data: {
  user_id: string;
  target_medication_id: string;
  suggested_schedule: {
    recurrence_type: "daily" | "weekly";
    days_of_week: string[];
    times: string[];
  };
  reason: string;
}) {
  return fetchJSON(`/schedule/apply-suggestion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export function medicationDraftToSchedule(draft: MedicationDraft) {
  return {
    recurrence_type: draft.recurrenceType,
    days_of_week: draft.recurrenceType === "weekly" ? draft.daysOfWeek : [],
    times: draft.time ? [draft.time] : [],
  };
}

export function medicationDraftToConflictPayload(draft: MedicationDraft) {
  return {
    candidate_medication: {
      display_name: draft.displayName,
      normalized_name: draft.normalizedName,
      active_ingredients: draft.activeIngredients.map((ingredient) => ({
        name: ingredient.name,
        strength: ingredient.strength,
      })),
      dosage_text: draft.dosageText,
      instructions: draft.instructions,
      schedule: medicationDraftToSchedule(draft),
      raw_text: `${draft.displayName} ${draft.dosageText} ${draft.instructions}`.trim(),
      needs_review: draft.needsReview,
      confidence: draft.confidence,
      uncertainty_reason: "",
    },
  };
}

export function medicationDraftToCreatePayload(
  draft: MedicationDraft,
  userId: string
) {
  return {
    user_id: userId,
    display_name: draft.displayName,
    normalized_name: draft.normalizedName,
    active_ingredients: draft.activeIngredients.map((ingredient) => ({
      name: ingredient.name,
      strength: ingredient.strength,
    })),
    dosage_text: draft.dosageText,
    instructions: draft.instructions,
    start_date: todayISO(),
    source: draft.source,
    schedule: medicationDraftToSchedule(draft),
    needs_review: draft.needsReview,
    confidence: draft.confidence,
  };
}