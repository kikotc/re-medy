export type RecurrenceType = "daily" | "weekly";

export type Severity = "minor" | "moderate" | "major";
export type SymptomSeverity = "mild" | "moderate" | "severe";
export type Likelihood = "high" | "possible" | "unlikely";
export type MedicationSource = "photo" | "text" | "manual";

export interface ActiveIngredient {
  name: string;
  strength: string;
}

export interface MedicationSchedule {
  recurrence_type: RecurrenceType;
  days_of_week: string[];
  times: string[];
}

export interface ParsedMedicationCandidate {
  display_name: string;
  normalized_name: string;
  active_ingredients: ActiveIngredient[];
  dosage_text: string;
  instructions: string;
  schedule: MedicationSchedule;
  needs_review: boolean;
  confidence: number;
}

export interface MedicationCreateRequest {
  user_id: string;
  display_name: string;
  normalized_name: string;
  active_ingredients: ActiveIngredient[];
  dosage_text: string;
  instructions: string;
  start_date: string;
  source: MedicationSource;
  schedule: MedicationSchedule;
}

export interface Medication {
  id: string;
  user_id: string;
  display_name: string;
  normalized_name: string;
  active_ingredients: ActiveIngredient[];
  dosage_text: string;
  instructions: string;
  start_date: string;
  source: MedicationSource;
  schedule: MedicationSchedule;
  created_at: string;
}

export interface DuplicateRisk {
  type: "duplicate_ingredient";
  ingredient: string;
  with_medication_id: string;
  with_medication_name: string;
  reason: string;
}

export interface InteractionConflict {
  type: "interaction";
  ingredient_a: string;
  ingredient_b: string;
  with_medication_id: string;
  with_medication_name: string;
  severity: Severity;
  reason: string;
  auto_reschedulable: boolean;
  separation_hours: number | null;
  guidance: string;
}

export interface ScheduleSuggestion {
  allowed: boolean;
  reason: string;
  change_type: "separate_by_hours" | null;
  separation_hours: number | null;
  original_schedule: MedicationSchedule;
  suggested_schedule: MedicationSchedule | null;
}

export interface MedicationCreateResponse {
  medication: Medication;
  duplicates: DuplicateRisk[];
  conflicts: InteractionConflict[];
  schedule_suggestions: ScheduleSuggestion[];
  status: "saved" | "saved_with_warnings" | "blocked_pending_review";
}

export interface ScheduleItem {
  schedule_item_id: string;
  medication_id: string;
  display_name: string;
  date: string;
  scheduled_time: string;
  taken: boolean;
}

export interface ScheduleDay {
  date: string;
  items: ScheduleItem[];
}

export interface WeeklyScheduleResponse {
  user_id: string;
  week_start: string;
  days: ScheduleDay[];
}

export interface MedicationLogCreateRequest {
  user_id: string;
  medication_id: string;
  date: string;
  scheduled_time: string;
  taken: boolean;
}

export interface SideEffectLogCreateRequest {
  user_id: string;
  effect: string;
  severity: SymptomSeverity;
  date: string;
  notes: string;
}

export interface CulpritMedication {
  medication_id: string;
  display_name: string;
  likelihood: Likelihood;
  reason: string;
}

export interface ADRAnalysisResponse {
  effect: string;
  likely_culprits: CulpritMedication[];
  warning_level: "low" | "medium" | "high";
  disclaimer: string;
}