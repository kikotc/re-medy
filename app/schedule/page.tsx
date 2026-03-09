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
    return <div className="text-sm text-white/40">Loading...</div>;
  }

  if (!schedule) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/40 backdrop-blur-xl">
        Could not load schedule.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-white/50">
          View your medication schedule by month.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-4 text-xl font-bold tracking-tight md:mb-5 md:text-2xl">{monthTitle}</div>

        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-white/40 md:mb-3 md:gap-2 md:text-xs">
          {weekDayLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {calendarDays.map((day) => {
            if (!day.isCurrentMonth) {
              return <div key={day.date} className="h-11 md:h-20" />;
            }

            const isSelected = day.date === selectedDate;
            const hasItems = day.items.length > 0;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={`group relative h-11 cursor-pointer rounded-xl border p-1.5 text-left transition-all duration-200 ease-in-out md:h-20 md:rounded-3xl md:p-2 ${
                  isSelected
                    ? "border-white/30 bg-white/20 shadow-lg shadow-purple-500/10 ring-1 ring-white/30 backdrop-blur-xl scale-105"
                    : "border-white/10 bg-white/5 backdrop-blur-md hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:shadow-md hover:shadow-purple-500/5"
                }`}
              >
                <div className={`text-xs font-semibold md:text-base ${isSelected ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                  {day.dayNumber}
                </div>

                {hasItems && (
                  <div
                    className={`mt-0.5 hidden text-[11px] leading-tight sm:block ${
                      isSelected ? "text-white/70 font-medium" : "text-white/40 group-hover:text-white/60"
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-4 text-xl font-bold tracking-tight">
          {selectedDate ? formatSelectedDay(selectedDate) : "Select a day"}
        </div>

        {selectedItems.length === 0 ? (
          <div className="text-sm text-white/40">No medications scheduled.</div>
        ) : (
          <div className="space-y-3">
            {selectedItems.map((item) => (
              <div
                key={item.schedule_item_id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:scale-[1.01]"
              >
                <div className="font-medium text-white">{item.display_name}</div>
                <div className="mt-1 text-sm text-white/50">
                  {item.scheduled_time}
                </div>
                {item.taken && (
                  <div className="mt-2 text-sm text-emerald-400/80">Taken</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}