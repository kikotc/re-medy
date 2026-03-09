"use client";

import { useEffect, useState } from "react";
import { getTodaySchedule, logMedicationTaken } from "@/lib/api";
import { MedicationLogCreateRequest, ScheduleItem } from "@/lib/types";

const DEMO_USER_ID = "demo-user";

export default function TodayPage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadToday() {
      const data = await getTodaySchedule(DEMO_USER_ID);

      const sorted = [...data].sort((a, b) =>
        a.scheduled_time.localeCompare(b.scheduled_time)
      );

      setItems(sorted);
      setLoading(false);
    }

    loadToday();
  }, []);

  const handleToggleTaken = async (item: ScheduleItem) => {
    const nextTaken = !item.taken;

    setItems((prev) =>
      prev.map((current) =>
        current.schedule_item_id === item.schedule_item_id
          ? { ...current, taken: nextTaken }
          : current
      )
    );

    const payload: MedicationLogCreateRequest = {
      user_id: DEMO_USER_ID,
      medication_id: item.medication_id,
      date: item.date,
      scheduled_time: item.scheduled_time,
      taken: nextTaken,
    };

    await logMedicationTaken(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-white/60">
          Track each scheduled dose for today.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-white/50">Loading...</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/50 shadow-2xl backdrop-blur-xl">
          No medications scheduled for today.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <label
              key={item.schedule_item_id}
              className="flex cursor-pointer items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl transition-all duration-200 ease-in-out hover:bg-white/10 hover:scale-[1.01]"
            >
              <div>
                <div className="font-medium text-white">{item.display_name}</div>
                <div className="mt-1 text-sm text-white/50">
                  {item.scheduled_time}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-sm ${item.taken ? "text-emerald-400/80" : "text-white/40"}`}>
                  {item.taken ? "Taken" : "Not taken"}
                </span>
                <div
                  onClick={(e) => { e.preventDefault(); handleToggleTaken(item); }}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                    item.taken
                      ? "border-emerald-400 bg-emerald-400/20 shadow-md shadow-emerald-500/20"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                  }`}
                >
                  {item.taken && (
                    <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}