"use client";

import Image from "next/image";
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
    <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 px-6 pt-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between rounded-full border border-white/15 bg-white/5 px-6 py-3 shadow-lg backdrop-blur-xl">
        <Link href="/today" className="flex items-center">
          <Image
            src="/logo.png"
            alt="re-medy"
            width={125}
            height={150}
            className="rounded-lg"
          />
        </Link>
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:bg-white/10 hover:text-white"
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