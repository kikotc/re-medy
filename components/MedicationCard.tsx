import { Medication } from "@/lib/types";

function formatRecurrence(med: Medication) {
  if (med.schedule.recurrence_type === "daily") {
    return "Daily";
  }

  return `Weekly · ${med.schedule.days_of_week
    .map((day) => day.slice(0, 3))
    .join(", ")}`;
}

function formatTimes(times: string[]) {
  return times.join(", ");
}

export default function MedicationCard({ med }: { med: Medication }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{med.display_name}</div>
          <div className="text-sm text-gray-500">{med.dosage_text}</div>
        </div>

        <span className="rounded-full border px-2 py-1 text-xs text-gray-500">
          {formatRecurrence(med)}
        </span>
      </div>

      {med.instructions && (
        <div className="mt-3 text-sm text-gray-500">{med.instructions}</div>
      )}

      <div className="mt-3 text-sm">
        <span className="text-gray-500">Time</span>
        <div className="mt-1 font-medium">{formatTimes(med.schedule.times)}</div>
      </div>
    </div>
  );
}