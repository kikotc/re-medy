"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today" },
  { href: "/schedule", label: "Schedule" },
  { href: "/meds", label: "Meds" },
  { href: "/symptoms", label: "Symptoms" },
];

export default function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden border-b bg-white md:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
        <div className="text-lg font-semibold">re-medy</div>
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-sm font-medium ${
                  isActive ? "text-black" : "text-gray-400"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}