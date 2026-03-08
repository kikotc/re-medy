"use client";

import { useEffect, useMemo, useState } from "react";

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

function getAutofillSuggestions(values: FormValues): {
  nextValues: Partial<FormValues>;
  nextFlags: SuggestionFlags;
} {
  const name = values.displayName.trim().toLowerCase();

  let defaults: Partial<FormValues> = {};

  if (name.includes("advil") || name.includes("ibuprofen")) {
    defaults = {
      displayName: "Advil",
      dosageText: "200 mg",
      instructions: "Take after meals",
      recurrenceType: "daily",
      time: "09:00",
    };
  } else if (name.includes("tylenol") || name.includes("acetaminophen")) {
    defaults = {
      displayName: "Tylenol",
      dosageText: "500 mg",
      instructions: "Take as needed",
      recurrenceType: "daily",
      time: "09:00",
    };
  } else if (name.includes("vitamin d")) {
    defaults = {
      displayName: "Vitamin D",
      dosageText: "1000 IU",
      instructions: "Take with food",
      recurrenceType: "weekly",
      daysOfWeek: ["monday"],
      time: "09:00",
    };
  } else {
    defaults = {
      displayName: values.displayName || "Tylenol",
      dosageText: "500 mg",
      instructions: "Take as directed",
      recurrenceType: values.recurrenceType || "daily",
      daysOfWeek:
        values.recurrenceType === "weekly" && values.daysOfWeek.length === 0
          ? ["monday"]
          : values.daysOfWeek,
      time: "09:00",
    };
  }

  const nextValues: Partial<FormValues> = {};
  const nextFlags: SuggestionFlags = {};

  if (!values.displayName.trim() && defaults.displayName) {
    nextValues.displayName = defaults.displayName;
    nextFlags.displayName = true;
  }

  if (!values.dosageText.trim() && defaults.dosageText) {
    nextValues.dosageText = defaults.dosageText;
    nextFlags.dosageText = true;
  }

  if (!values.instructions.trim() && defaults.instructions) {
    nextValues.instructions = defaults.instructions;
    nextFlags.instructions = true;
  }

  if (!values.time.trim() && defaults.time) {
    nextValues.time = defaults.time;
    nextFlags.time = true;
  }

  if (!values.recurrenceType && defaults.recurrenceType) {
    nextValues.recurrenceType = defaults.recurrenceType;
    nextFlags.recurrenceType = true;
  }

  if (
    values.recurrenceType === "weekly" &&
    values.daysOfWeek.length === 0 &&
    defaults.daysOfWeek &&
    defaults.daysOfWeek.length > 0
  ) {
    nextValues.daysOfWeek = defaults.daysOfWeek;
    nextFlags.daysOfWeek = true;
  }

  return { nextValues, nextFlags };
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
      time: initialValues?.time ?? "",
    }),
    [initialValues]
  );

  const [displayName, setDisplayName] = useState(defaults.displayName);
  const [dosageText, setDosageText] = useState(defaults.dosageText);
  const [instructions, setInstructions] = useState(defaults.instructions);
  const [recurrenceType, setRecurrenceType] = useState<"daily" | "weekly">(
    defaults.recurrenceType
  );
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(defaults.daysOfWeek);
  const [time, setTime] = useState(defaults.time);

  useEffect(() => {
    setDisplayName(defaults.displayName);
    setDosageText(defaults.dosageText);
    setInstructions(defaults.instructions);
    setRecurrenceType(defaults.recurrenceType);
    setDaysOfWeek(defaults.daysOfWeek);
    setTime(defaults.time);
  }, [defaults]);

  const [aiFlags, setAiFlags] = useState<SuggestionFlags>({
    displayName: suggestedFields?.displayName ?? false,
    dosageText: suggestedFields?.dosageText ?? false,
    instructions: suggestedFields?.instructions ?? false,
    recurrenceType: suggestedFields?.recurrenceType ?? false,
    daysOfWeek: suggestedFields?.daysOfWeek ?? false,
    time: suggestedFields?.time ?? false,
  });

  const [isAutofilling, setIsAutofilling] = useState(false);

  const clearFlag = (key: keyof SuggestionFlags) => {
    setAiFlags((prev) => ({ ...prev, [key]: false }));
  };

  const isComplete =
    displayName.trim().length > 0 &&
    dosageText.trim().length > 0 &&
    time.trim().length > 0 &&
    (recurrenceType === "daily" || daysOfWeek.length > 0);

  const toggleDay = (day: string) => {
    clearFlag("daysOfWeek");
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const runAutofill = async () => {
    setIsAutofilling(true);

    const currentValues: FormValues = {
      displayName,
      dosageText,
      instructions,
      recurrenceType,
      daysOfWeek,
      time,
    };

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const { nextValues, nextFlags } = getAutofillSuggestions(currentValues);

    if (nextValues.displayName) setDisplayName(nextValues.displayName);
    if (nextValues.dosageText) setDosageText(nextValues.dosageText);
    if (nextValues.instructions) setInstructions(nextValues.instructions);
    if (nextValues.recurrenceType) setRecurrenceType(nextValues.recurrenceType);
    if (nextValues.daysOfWeek) setDaysOfWeek(nextValues.daysOfWeek);
    if (nextValues.time) setTime(nextValues.time);

    setAiFlags((prev) => ({ ...prev, ...nextFlags }));
    setIsAutofilling(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isComplete) {
      await runAutofill();
      return;
    }

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
              setDaysOfWeek([]);
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
                  className={`rounded-full border px-3 py-2 text-sm capitalize transition ${
                    selected
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-white border-white/40"
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

      {!isComplete && (
        <p className="text-sm text-gray-500">
          This says Autofill because some required fields are missing. AI will
          suggest missing details and will not overwrite what you already typed.
        </p>
      )}

      <button
        type="submit"
        disabled={isAutofilling}
        className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {isAutofilling ? "Autofilling..." : isComplete ? "Submit" : "Autofill"}
      </button>
    </form>
  );
}