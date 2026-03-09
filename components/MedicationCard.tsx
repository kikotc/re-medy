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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl transition-all duration-200 ease-in-out hover:bg-white/10 hover:scale-[1.01]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">{med.display_name}</h3>
          {med.dosage_text && (
            <p className="text-sm text-white/50">{med.dosage_text}</p>
          )}
        </div>

        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/70">
          {med.schedule?.recurrence_type === "weekly" ? "Weekly" : "Daily"}
        </div>
      </div>

      {med.instructions && (
        <p className="mt-4 text-white/50">{med.instructions}</p>
      )}

      {times.length > 0 && (
        <div className="mt-4">
          <div className="text-white/40 text-sm">Time</div>
          <div className="mt-1 font-medium text-white">
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
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/50 transition-colors hover:bg-red-500/10 hover:border-red-400/20 hover:text-red-400 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}