"use client";

import { useEffect, useMemo, useState } from "react";
import { getMonthlySchedule } from "@/lib/api";
import type { MonthlyScheduleResponse } from "@/lib/api";
import { ScheduleItem } from "@/lib/types";

type CalendarDay = {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  items: ScheduleItem[];
};

const weekDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEMO_USER_ID = "demo-user";

function formatMonthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatSelectedDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<MonthlyScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    async function loadSchedule() {
      const now = new Date();
      const data = await getMonthlySchedule(
        DEMO_USER_ID,
        now.getFullYear(),
        now.getMonth() + 1
      );

      setSchedule(data);

      const firstDateWithItems =
        data.days.find((day) => day.items.length > 0)?.date ??
        data.days[0]?.date ??
        "";
      setSelectedDate(firstDateWithItems);

      setLoading(false);
    }

    loadSchedule();
  }, []);

  const { monthTitle, calendarDays, selectedItems } = useMemo(() => {
    if (!schedule) {
      return {
        monthTitle: "",
        calendarDays: [] as CalendarDay[],
        selectedItems: [] as ScheduleItem[],
      };
    }

    const year = schedule.year;
    const month = schedule.month;

    const firstOfMonth = new Date(year, month - 1, 1);
    const lastOfMonth = new Date(year, month, 0);

    const itemsByDate = new Map<string, ScheduleItem[]>();
    for (const day of schedule.days) {
      itemsByDate.set(
        day.date,
        [...day.items].sort((a, b) =>
          a.scheduled_time.localeCompare(b.scheduled_time)
        )
      );
    }

    const days: CalendarDay[] = [];

    const leadingEmptyDays = firstOfMonth.getDay();
    for (let i = 0; i < leadingEmptyDays; i++) {
      days.push({
        date: `empty-${i}`,
        dayNumber: 0,
        isCurrentMonth: false,
        items: [],
      });
    }

    for (let day = 1; day <= lastOfMonth.getDate(); day++) {
      const date = new Date(year, month - 1, day);
      const isoDate = date.toISOString().slice(0, 10);

      days.push({
        date: isoDate,
        dayNumber: day,
        isCurrentMonth: true,
        items: itemsByDate.get(isoDate) ?? [],
      });
    }

    const selected = days.find(
      (day) => day.date === selectedDate && day.isCurrentMonth
    );

    return {
      monthTitle: formatMonthTitle(year, month),
      calendarDays: days,
      selectedItems: selected?.items ?? [],
    };
  }, [schedule, selectedDate]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (!schedule) {
    return (
      <div className="rounded-2xl border p-4 text-sm text-gray-500">
        Could not load schedule.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-sm text-gray-500">
          View your medication schedule by month.
        </p>
      </div>

      <div className="rounded-3xl border p-4 md:p-6">
        <div className="mb-4 text-2xl font-semibold">{monthTitle}</div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-gray-500">
          {weekDayLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            if (!day.isCurrentMonth) {
              return <div key={day.date} className="h-16 md:h-20" />;
            }

            const isSelected = day.date === selectedDate;
            const hasItems = day.items.length > 0;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`h-16 rounded-2xl border p-2 text-left transition md:h-20 ${
                  isSelected ? "border-black bg-black text-white" : "bg-white"
                }`}
              >
                <div className="text-sm font-semibold md:text-base">
                  {day.dayNumber}
                </div>

                {hasItems && (
                  <div
                    className={`mt-1 text-[11px] leading-tight ${
                      isSelected ? "text-gray-200" : "text-gray-500"
                    }`}
                  >
                    {day.items.length} med{day.items.length > 1 ? "s" : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border p-4 md:p-6">
        <div className="mb-3 text-xl font-semibold">
          {selectedDate ? formatSelectedDay(selectedDate) : "Select a day"}
        </div>

        {selectedItems.length === 0 ? (
          <div className="text-sm text-gray-500">No medications scheduled.</div>
        ) : (
          <div className="space-y-3">
            {selectedItems.map((item) => (
              <div
                key={item.schedule_item_id}
                className="rounded-2xl border p-4"
              >
                <div className="font-medium">{item.display_name}</div>
                <div className="mt-1 text-sm text-gray-500">
                  {item.scheduled_time}
                </div>
                {item.taken && (
                  <div className="mt-2 text-sm text-gray-500">Taken</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}