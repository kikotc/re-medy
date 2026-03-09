"use client";

import Aurora from "@/components/Aurora";

export default function AuroraBackground() {
  return (
    <div className="fixed inset-0 z-0 opacity-50 pointer-events-none">
      <Aurora
        colorStops={["#9b3fbf", "#7a2d8f", "#2a2a2a"]}
        amplitude={0.6}
        blend={0.8}
        speed={0.5}
      />
    </div>
  );
}
