"use client";

import { useEffect, useState } from "react";
import { getTodaySchedule, logMedicationTaken } from "@/lib/api";
import { ScheduleItem } from "@/lib/types";

export default function TodayPage() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function loadToday() {
      try {
        const data = await getTodaySchedule(todayStr);
        const sorted = [...data].sort((a, b) =>
          a.scheduled_time.localeCompare(b.scheduled_time)
        );
        setItems(sorted);
      } catch (err) {
        console.error("Failed to load today's schedule:", err);
      } finally {
        setLoading(false);
      }
    }

    loadToday();
  }, [todayStr]);

  const handleToggleTaken = async (item: ScheduleItem) => {
    const newTaken = !item.taken;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.schedule_item_id === item.schedule_item_id
          ? { ...i, taken: newTaken }
          : i
      )
    );

    try {
      await logMedicationTaken({
        user_id: "demo-user",
        medication_id: item.medication_id,
        date: item.date,
        scheduled_time: item.scheduled_time,
        taken: newTaken,
      });
    } catch (err) {
      console.error("Failed to log medication:", err);
      // Revert on failure
      setItems((prev) =>
        prev.map((i) =>
          i.schedule_item_id === item.schedule_item_id
            ? { ...i, taken: !newTaken }
            : i
        )
      );
    }
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
              className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-4 cursor-pointer"
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
