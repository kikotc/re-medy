import {
  ADRAnalysisResponse,
  Medication,
  MedicationCreateResponse,
  WeeklyScheduleResponse,
} from "./types";

export const DEMO_USER_ID = "demo-user";

export const mockMedications: Medication[] = [
  {
    id: "med_1",
    user_id: DEMO_USER_ID,
    display_name: "Advil",
    normalized_name: "ibuprofen",
    active_ingredients: [{ name: "ibuprofen", strength: "200 mg" }],
    dosage_text: "200 mg",
    instructions: "Take after meals",
    start_date: "2026-03-07",
    source: "manual",
    schedule: {
      recurrence_type: "daily",
      days_of_week: [],
      times: ["09:00", "21:00"],
    },
    created_at: "2026-03-07T14:30:00Z",
  },
  {
    id: "med_2",
    user_id: DEMO_USER_ID,
    display_name: "Vitamin D",
    normalized_name: "vitamin d",
    active_ingredients: [{ name: "vitamin d", strength: "1000 IU" }],
    dosage_text: "1000 IU",
    instructions: "Take with food",
    start_date: "2026-03-07",
    source: "manual",
    schedule: {
      recurrence_type: "weekly",
      days_of_week: ["monday"],
      times: ["09:00"],
    },
    created_at: "2026-03-07T14:35:00Z",
  },
];

export const mockCreateMedicationResponse: MedicationCreateResponse = {
  medication: mockMedications[0],
  duplicates: [],
  conflicts: [
    {
      type: "interaction",
      ingredient_a: "ibuprofen",
      ingredient_b: "aspirin",
      with_medication_id: "med_3",
      with_medication_name: "Aspirin",
      severity: "major",
      reason: "Both may increase bleeding risk",
      auto_reschedulable: false,
      separation_hours: null,
      guidance: "Confirm with a pharmacist or doctor before taking together",
    },
  ],
  schedule_suggestions: [],
  status: "saved_with_warnings",
};

export const mockWeeklySchedule: WeeklyScheduleResponse = {
  user_id: DEMO_USER_ID,
  week_start: "2026-03-09",
  days: [
    {
      date: "2026-03-09",
      items: [
        {
          schedule_item_id: "sched_1",
          medication_id: "med_1",
          display_name: "Advil",
          date: "2026-03-09",
          scheduled_time: "09:00",
          taken: false,
        },
        {
          schedule_item_id: "sched_2",
          medication_id: "med_2",
          display_name: "Vitamin D",
          date: "2026-03-09",
          scheduled_time: "09:00",
          taken: false,
        },
        {
          schedule_item_id: "sched_3",
          medication_id: "med_1",
          display_name: "Advil",
          date: "2026-03-09",
          scheduled_time: "21:00",
          taken: false,
        },
      ],
    },
    {
      date: "2026-03-10",
      items: [
        {
          schedule_item_id: "sched_4",
          medication_id: "med_1",
          display_name: "Advil",
          date: "2026-03-10",
          scheduled_time: "09:00",
          taken: true,
        },
        {
          schedule_item_id: "sched_5",
          medication_id: "med_1",
          display_name: "Advil",
          date: "2026-03-10",
          scheduled_time: "21:00",
          taken: false,
        },
      ],
    },
    { date: "2026-03-11", items: [] },
    { date: "2026-03-12", items: [] },
    { date: "2026-03-13", items: [] },
    { date: "2026-03-14", items: [] },
    { date: "2026-03-15", items: [] },
  ],
};

export const mockADRAnalysis: ADRAnalysisResponse = {
  effect: "dizziness",
  likely_culprits: [
    {
      medication_id: "med_1",
      display_name: "Advil",
      likelihood: "possible",
      reason: "Can cause dizziness, but it is less characteristic",
    },
    {
      medication_id: "med_4",
      display_name: "Benadryl",
      likelihood: "high",
      reason: "Known to commonly cause dizziness and drowsiness",
    },
  ],
  warning_level: "low",
  disclaimer:
    "This is informational only and should be confirmed with a healthcare professional.",
};