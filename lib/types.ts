export type RecurrenceType = "daily" | "weekly";

export type Severity = "minor" | "moderate" | "major";
export type SymptomSeverity = "mild" | "moderate" | "severe";
export type Likelihood = "high" | "possible" | "unlikely";
export type MedicationSource = "photo" | "text" | "manual";

export type ConflictDecisionStatus =
  | "SAFE_TO_ADD"
  | "WARNING_CONFIRM_REQUIRED"
  | "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
  | "UNCERTAIN_CONFIRM_REQUIRED";

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

export interface MedicationDraft {
  displayName: string;
  dosageText: string;
  instructions: string;
  recurrenceType: "daily" | "weekly";
  daysOfWeek: string[];
  time: string;

  normalizedName: string;
  activeIngredients: ActiveIngredient[];
  needsReview: boolean;
  confidence: number;
  source: MedicationSource;
}

export const emptyMedicationDraft: MedicationDraft = {
  displayName: "",
  dosageText: "",
  instructions: "",
  recurrenceType: "daily",
  daysOfWeek: [],
  time: "",

  normalizedName: "",
  activeIngredients: [],
  needsReview: false,
  confidence: 0,
  source: "manual",
};

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
  target_medication_id: string | null;
  target_medication_name: string | null;
  allowed: boolean;
  reason: string;
  change_type: "separate_by_hours" | null;
  separation_hours: number | null;
  original_schedule: MedicationSchedule;
  suggested_schedule: MedicationSchedule | null;
}

// Backend save endpoint — save-only, no conflict data
export interface MedicationCreateResponse {
  medication: Medication;
  status: "saved";
}

// Backend conflict check endpoint — separate from save
export interface ConflictCheckResponse {
  decision_status: ConflictDecisionStatus;
  duplicates: DuplicateRisk[];
  conflicts: InteractionConflict[];
  schedule_suggestions: ScheduleSuggestion[];
  uncertainty_message: string | null;
  normalized_name: string | null;
  active_ingredients: ActiveIngredient[] | null;
}

export interface ConflictCheckRequest {
  user_id: string;
  candidate_medication: {
    display_name: string;
    normalized_name?: string | null;
    active_ingredients?: ActiveIngredient[] | null;
    dosage_text: string;
    instructions: string;
    schedule: MedicationSchedule;
  };
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

export interface MonthlyScheduleResponse {
  user_id: string;
  year: number;
  month: number;
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

export interface ADRAnalysisRequest {
  user_id: string;
  effect: string;
  severity: SymptomSeverity;
  date: string;
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

export interface AutofillFieldsRequest {
  user_id: string;
  display_name?: string;
  dosage_text?: string;
  instructions?: string;
  schedule?: MedicationSchedule;
}
