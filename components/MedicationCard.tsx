"use client";

import { Medication } from "@/lib/types";

type MedicationCardProps = {
  med: Medication;
  onDelete?: () => void;
  deleting?: boolean;
};

function formatTime(time: string) {
  if (!time) return "";
  return time;
}

export default function MedicationCard({
  med,
  onDelete,
  deleting = false,
}: MedicationCardProps) {
  const times = med.schedule?.times || [];

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{med.display_name}</h3>
          {med.dosage_text && (
            <p className="text-sm text-gray-500">{med.dosage_text}</p>
          )}
        </div>

        <div className="rounded-full border px-3 py-1 text-sm">
          {med.schedule?.recurrence_type === "weekly" ? "Weekly" : "Daily"}
        </div>
      </div>

      {med.instructions && (
        <p className="mt-4 text-gray-500">{med.instructions}</p>
      )}

      {times.length > 0 && (
        <div className="mt-4">
          <div className="text-gray-500">Time</div>
          <div className="mt-1 font-medium">
            {times.map(formatTime).join(", ")}
          </div>
        </div>
      )}

      {onDelete && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-full border px-4 py-2 text-sm text-gray-500 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}