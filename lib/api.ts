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