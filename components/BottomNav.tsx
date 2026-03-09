"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const leftTabs = [
  { href: "/today", label: "Today" },
  { href: "/schedule", label: "Schedule" },
];

const rightTabs = [
  { href: "/meds", label: "Meds" },
  { href: "/symptoms", label: "Symptoms" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around rounded-full border border-white/15 bg-white/5 px-4 py-3 shadow-lg backdrop-blur-xl">
        {leftTabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                isActive ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}

        <Link href="/today" className="flex items-center px-2 transition-transform duration-200 ease-in-out hover:scale-110">
          <Image
            src="/icon.png"
            alt="re-medy"
            width={40}
            height={40}
            className="rounded-md"
          />
        </Link>

        {rightTabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                isActive ? "bg-white/15 text-white" : "text-white/40 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}