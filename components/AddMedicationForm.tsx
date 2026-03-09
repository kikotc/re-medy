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

type SuggestionFlags = {
  displayName?: boolean;
  dosageText?: boolean;
  instructions?: boolean;
  recurrenceType?: boolean;
  daysOfWeek?: boolean;
  time?: boolean;
};

type FormValues = {
  displayName: string;
  dosageText: string;
  instructions: string;
  recurrenceType: "daily" | "weekly";
  daysOfWeek: string[];
  time: string;
};

type SubmitAction = "autofill" | "check";

type AddMedicationFormProps = {
  initialValues?: Partial<FormValues>;
  suggestedFields?: SuggestionFlags;
  onSubmit?: (
    values: FormValues,
    action: SubmitAction
  ) => void | Promise<void>;
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
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
          Suggested
        </span>
      )}
    </div>
  );
}

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
    time: initialValues?.time ?? "",
  });

  const [formError, setFormError] = useState("");

  useEffect(() => {
    setValues({
      displayName: initialValues?.displayName ?? "",
      dosageText: initialValues?.dosageText ?? "",
      instructions: initialValues?.instructions ?? "",
      recurrenceType: initialValues?.recurrenceType ?? "daily",
      daysOfWeek: initialValues?.daysOfWeek ?? [],
      time: initialValues?.time ?? "",
    });
    setFormError("");
  }, [initialValues]);

  const hasRequiredBaseFields =
    values.displayName.trim().length > 0 && values.dosageText.trim().length > 0;

  const isFullyReadyToCheck =
    hasRequiredBaseFields &&
    values.instructions.trim().length > 0 &&
    (values.recurrenceType !== "weekly" || values.daysOfWeek.length > 0) &&
    values.time.trim().length > 0;

  const toggleDay = (day: string) => {
    setValues((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const submitWithAction = async (action: SubmitAction) => {
    setFormError("");

    if (!values.displayName.trim()) {
      setFormError("Please enter a medication name.");
      return;
    }

    if (!values.dosageText.trim()) {
      setFormError("Please enter a dosage.");
      return;
    }

    await onSubmit?.(values, action);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFullyReadyToCheck) {
      await submitWithAction("check");
      return;
    }

    await submitWithAction("autofill");
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
      <div className="space-y-1">
        <FieldLabel
          label="Medication Name"
          suggested={suggestedFields?.displayName}
        />
        <input
          required
          value={values.displayName}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, displayName: e.target.value }))
          }
          placeholder="e.g. Advil"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:border-white/25 focus:bg-white/10 transition-all outline-none"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel label="Dosage" suggested={suggestedFields?.dosageText} />
        <input
          required
          value={values.dosageText}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, dosageText: e.target.value }))
          }
          placeholder="e.g. 200 mg"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:border-white/25 focus:bg-white/10 transition-all outline-none"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel
          label="Instructions"
          suggested={suggestedFields?.instructions}
        />
        <textarea
          value={values.instructions}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, instructions: e.target.value }))
          }
          placeholder="e.g. Take after meals"
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:border-white/25 focus:bg-white/10 transition-all outline-none"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel
          label="Recurrence"
          suggested={suggestedFields?.recurrenceType}
        />
        <select
          value={values.recurrenceType}
          onChange={(e) =>
            setValues((prev) => ({
              ...prev,
              recurrenceType: e.target.value as "daily" | "weekly",
              daysOfWeek:
                e.target.value === "weekly" ? prev.daysOfWeek : [],
            }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/25 focus:bg-white/10 transition-all outline-none"
        >
          <option value="daily" className="bg-neutral-900">Daily</option>
          <option value="weekly" className="bg-neutral-900">Weekly</option>
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
                  className={`rounded-full border border-white/10 px-3 py-1 text-sm capitalize transition-all ${
                    active ? "bg-white/20 text-white ring-1 ring-white/30" : "text-white/60 hover:bg-white/10"
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
          onChange={(e) =>
            setValues((prev) => ({ ...prev, time: e.target.value }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/25 focus:bg-white/10 transition-all outline-none"
        />
      </div>

      {formError && <p className="text-sm text-red-500">{formError}</p>}

      <div className="flex flex-wrap gap-2">
        {!isFullyReadyToCheck && (
          <button
            type="button"
            onClick={() => submitWithAction("autofill")}
            disabled={submitting || !hasRequiredBaseFields}
            className="rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-all disabled:opacity-60"
          >
            {submitting ? "Working..." : "Autofill Missing Fields"}
          </button>
        )}

        {hasRequiredBaseFields && (
          <button
            type="button"
            onClick={() => submitWithAction("check")}
            disabled={submitting}
            className="rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-all disabled:opacity-60"
          >
            {submitting ? "Working..." : "Check Medication"}
          </button>
        )}
      </div>
    </form>
  );
}