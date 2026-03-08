"use client";

import { useEffect, useState } from "react";

const weekDays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DEFAULT_MED_TIME = "21:00";

type SuggestionFlags = {
  displayName?: boolean;
  dosageText?: boolean;
  instructions?: boolean;
  recurrenceType?: boolean;
  daysOfWeek?: boolean;
  time?: boolean;
};

type ManualOverrides = {
  displayName: boolean;
  dosageText: boolean;
  instructions: boolean;
  recurrenceType: boolean;
  daysOfWeek: boolean;
  time: boolean;
};

type FormValues = {
  displayName: string;
  dosageText: string;
  instructions: string;
  recurrenceType: "daily" | "weekly";
  daysOfWeek: string[];
  time: string;
};

type SubmitMeta = {
  manualOverrides: ManualOverrides;
};

type AddMedicationFormProps = {
  initialValues?: Partial<FormValues>;
  suggestedFields?: SuggestionFlags;
  onSubmit?: (values: FormValues, meta: SubmitMeta) => void | Promise<void>;
  submitting?: boolean;
};

function FieldLabel({
  label,
  suggested,
}: {
  label: string;
  suggested?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">{label}</label>
      {suggested && (
        <span className="rounded-full border px-2 py-0.5 text-xs text-gray-500">
          Suggested
        </span>
      )}
    </div>
  );
}

const emptyManualOverrides: ManualOverrides = {
  displayName: false,
  dosageText: false,
  instructions: false,
  recurrenceType: false,
  daysOfWeek: false,
  time: false,
};

export default function AddMedicationForm({
  initialValues,
  suggestedFields,
  onSubmit,
  submitting = false,
}: AddMedicationFormProps) {
  const [values, setValues] = useState<FormValues>({
    displayName: initialValues?.displayName ?? "",
    dosageText: initialValues?.dosageText ?? "",
    instructions: initialValues?.instructions ?? "",
    recurrenceType: initialValues?.recurrenceType ?? "daily",
    daysOfWeek: initialValues?.daysOfWeek ?? [],
    time: initialValues?.time ?? DEFAULT_MED_TIME,
  });

  const [manualOverrides, setManualOverrides] =
    useState<ManualOverrides>(emptyManualOverrides);

  const [formError, setFormError] = useState("");

  useEffect(() => {
    setValues({
      displayName: initialValues?.displayName ?? "",
      dosageText: initialValues?.dosageText ?? "",
      instructions: initialValues?.instructions ?? "",
      recurrenceType: initialValues?.recurrenceType ?? "daily",
      daysOfWeek: initialValues?.daysOfWeek ?? [],
      time: initialValues?.time ?? DEFAULT_MED_TIME,
    });
    setManualOverrides(emptyManualOverrides);
    setFormError("");
  }, [initialValues]);

  const hasMissingDetails =
    !values.displayName.trim() ||
    !values.dosageText.trim() ||
    !values.instructions.trim();

  const toggleDay = (day: string) => {
    setValues((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
    setManualOverrides((prev) => ({ ...prev, daysOfWeek: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!values.displayName.trim()) {
      setFormError("Please enter a medication name.");
      return;
    }

    if (!values.time) {
      setFormError("Please choose a time.");
      return;
    }

    if (values.recurrenceType === "weekly" && values.daysOfWeek.length === 0) {
      setFormError("Please choose at least one day of the week.");
      return;
    }

    await onSubmit?.(values, { manualOverrides });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
      <div className="space-y-1">
        <FieldLabel
          label="Medication Name"
          suggested={suggestedFields?.displayName}
        />
        <input
          required
          value={values.displayName}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, displayName: e.target.value }));
            setManualOverrides((prev) => ({ ...prev, displayName: true }));
          }}
          placeholder="e.g. Advil"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel label="Dosage" suggested={suggestedFields?.dosageText} />
        <input
          value={values.dosageText}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, dosageText: e.target.value }));
            setManualOverrides((prev) => ({ ...prev, dosageText: true }));
          }}
          placeholder="e.g. 200 mg"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel
          label="Instructions"
          suggested={suggestedFields?.instructions}
        />
        <textarea
          value={values.instructions}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, instructions: e.target.value }));
            setManualOverrides((prev) => ({ ...prev, instructions: true }));
          }}
          placeholder="e.g. Take after meals"
          rows={3}
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel
          label="Recurrence"
          suggested={suggestedFields?.recurrenceType}
        />
        <select
          value={values.recurrenceType}
          onChange={(e) => {
            setValues((prev) => ({
              ...prev,
              recurrenceType: e.target.value as "daily" | "weekly",
              daysOfWeek:
                e.target.value === "weekly" ? prev.daysOfWeek : [],
            }));
            setManualOverrides((prev) => ({ ...prev, recurrenceType: true }));
          }}
          className="w-full rounded-xl border px-3 py-2"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      {values.recurrenceType === "weekly" && (
        <div className="space-y-2">
          <FieldLabel
            label="Days of Week"
            suggested={suggestedFields?.daysOfWeek}
          />
          <div className="flex flex-wrap gap-2">
            {weekDays.map((day) => {
              const active = values.daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-3 py-1 text-sm capitalize ${
                    active ? "bg-black text-white" : ""
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <FieldLabel label="Time" suggested={suggestedFields?.time} />
        <input
          type="time"
          value={values.time}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, time: e.target.value }));
            setManualOverrides((prev) => ({ ...prev, time: true }));
          }}
          className="w-full rounded-xl border px-3 py-2"
          required
        />
      </div>

      {formError && <p className="text-sm text-red-500">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {submitting
          ? "Working..."
          : hasMissingDetails
            ? "Autofill Missing Fields"
            : "Check Medication"}
      </button>
    </form>
  );
}