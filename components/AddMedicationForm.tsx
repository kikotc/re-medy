"use client";

import { useMemo, useState } from "react";

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

type AddMedicationFormProps = {
  initialValues?: Partial<FormValues>;
  suggestedFields?: SuggestionFlags;
  onSubmit?: (values: FormValues) => void;
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

export default function AddMedicationForm({
  initialValues,
  suggestedFields,
  onSubmit,
}: AddMedicationFormProps) {
  const defaults = useMemo<FormValues>(
    () => ({
      displayName: initialValues?.displayName ?? "",
      dosageText: initialValues?.dosageText ?? "",
      instructions: initialValues?.instructions ?? "",
      recurrenceType: initialValues?.recurrenceType ?? "daily",
      daysOfWeek: initialValues?.daysOfWeek ?? [],
      time: initialValues?.time ?? "09:00",
    }),
    [initialValues],
  );

  const [displayName, setDisplayName] = useState(defaults.displayName);
  const [dosageText, setDosageText] = useState(defaults.dosageText);
  const [instructions, setInstructions] = useState(defaults.instructions);
  const [recurrenceType, setRecurrenceType] = useState<"daily" | "weekly">(
    defaults.recurrenceType,
  );
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(defaults.daysOfWeek);
  const [time, setTime] = useState(defaults.time);

  const [aiFlags, setAiFlags] = useState<SuggestionFlags>({
    displayName: suggestedFields?.displayName ?? false,
    dosageText: suggestedFields?.dosageText ?? false,
    instructions: suggestedFields?.instructions ?? false,
    recurrenceType: suggestedFields?.recurrenceType ?? false,
    daysOfWeek: suggestedFields?.daysOfWeek ?? false,
    time: suggestedFields?.time ?? false,
  });

  const clearFlag = (key: keyof SuggestionFlags) => {
    setAiFlags((prev) => ({ ...prev, [key]: false }));
  };

  const toggleDay = (day: string) => {
    clearFlag("daysOfWeek");
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit?.({
      displayName,
      dosageText,
      instructions,
      recurrenceType,
      daysOfWeek,
      time,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
      <div className="space-y-1">
        <FieldLabel label="Medication name" suggested={aiFlags.displayName} />
        <input
          required
          value={displayName}
          onChange={(e) => {
            clearFlag("displayName");
            setDisplayName(e.target.value);
          }}
          placeholder="e.g. Advil"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel label="Dosage" suggested={aiFlags.dosageText} />
        <input
          required
          value={dosageText}
          onChange={(e) => {
            clearFlag("dosageText");
            setDosageText(e.target.value);
          }}
          placeholder="e.g. 200 mg"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <FieldLabel label="Instructions" suggested={aiFlags.instructions} />
        <input
          value={instructions}
          onChange={(e) => {
            clearFlag("instructions");
            setInstructions(e.target.value);
          }}
          placeholder="Optional"
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel label="Schedule" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              clearFlag("recurrenceType");
              setRecurrenceType("daily");
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium border transition ${
              recurrenceType === "daily"
                ? "bg-white text-black border-white"
                : "bg-transparent text-white border-white/40"
            }`}
          >
            Daily
          </button>

          <button
            type="button"
            onClick={() => {
              clearFlag("recurrenceType");
              setRecurrenceType("weekly");
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium border transition ${
              recurrenceType === "weekly"
                ? "bg-white text-black border-white"
                : "bg-transparent text-white border-white/40"
            }`}
          >
            Weekly
          </button>
        </div>
        {aiFlags.recurrenceType && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-gray-500">
            Suggested
          </span>
        )}
      </div>

      {recurrenceType === "weekly" && (
        <div className="space-y-2">
          <FieldLabel label="Days of week" suggested={aiFlags.daysOfWeek} />
          <div className="flex flex-wrap gap-2">
            {weekDays.map((day) => {
              const selected = daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-3 py-2 text-sm capitalize ${
                    selected ? "bg-black text-white" : ""
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
        <FieldLabel label="Time" suggested={aiFlags.time} />
        <input
          type="time"
          value={time}
          onChange={(e) => {
            clearFlag("time");
            setTime(e.target.value);
          }}
          className="w-full rounded-xl border px-3 py-2"
        />
      </div>

      <button
        type="submit"
        className="rounded-full border px-4 py-2 text-sm font-medium"
      >
        Save
      </button>
    </form>
  );
}
