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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-gray-400">
          Track each scheduled dose for today.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-white/15 p-4 text-sm text-gray-400">
          No medications scheduled for today.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <label
              key={item.schedule_item_id}
              className="flex cursor-pointer items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <div className="font-medium">{item.display_name}</div>
                <div className="mt-1 text-sm text-gray-400">
                  {item.scheduled_time}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {item.taken ? "Taken" : "Not taken"}
                </span>
                <input
                  type="checkbox"
                  checked={item.taken}
                  onChange={() => handleToggleTaken(item)}
                  className="h-5 w-5 accent-white"
                />
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}