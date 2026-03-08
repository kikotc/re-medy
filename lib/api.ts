import {
  ADRAnalysisResponse,
  Medication,
  MedicationCreateRequest,
  MedicationCreateResponse,
  SideEffectLogCreateRequest,
  WeeklyScheduleResponse,
} from "./types";
import {
  mockADRAnalysis,
  mockCreateMedicationResponse,
  mockMedications,
  mockWeeklySchedule,
} from "./mockData";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getMedications(): Promise<Medication[]> {
  await wait(200);
  return mockMedications;
}

export async function createMedication(
  _data: MedicationCreateRequest
): Promise<MedicationCreateResponse> {
  await wait(300);
  return mockCreateMedicationResponse;
}

export async function getWeeklySchedule(): Promise<WeeklyScheduleResponse> {
  await wait(200);
  return mockWeeklySchedule;
}

export async function getTodaySchedule() {
  await wait(150);
  return mockWeeklySchedule.days[0].items;
}

export async function logMedicationTaken() {
  await wait(150);
  return { success: true };
}

export async function logSideEffect(
  _data: SideEffectLogCreateRequest
): Promise<{ success: true }> {
  await wait(200);
  return { success: true };
}

export async function analyzeSideEffect(): Promise<ADRAnalysisResponse> {
  await wait(300);
  return mockADRAnalysis;
}

import { MedicationDraft } from "./types";

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
    start_date: new Date().toISOString().slice(0, 10),
    source: draft.source,
    schedule: medicationDraftToSchedule(draft),
  };
}