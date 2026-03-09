"use client";

import { useState } from "react";
import { analyzeSideEffect, logSideEffect } from "@/lib/api";
import {
  ADRAnalysisResponse,
  SideEffectLogCreateRequest,
  SymptomSeverity,
} from "@/lib/types";

const DEMO_USER_ID = "demo-user";

export default function SymptomsPage() {
  const [effect, setEffect] = useState("");
  const [severity, setSeverity] = useState<SymptomSeverity>("mild");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ADRAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const logPayload: SideEffectLogCreateRequest = {
      user_id: DEMO_USER_ID,
      effect,
      severity,
      date: today,
      notes,
    };

    await logSideEffect(logPayload);

    const analysis = await analyzeSideEffect({
      user_id: DEMO_USER_ID,
      effect,
      severity,
      date: today,
    });

    setResult(analysis);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Symptoms</h1>
        <p className="mt-1 text-sm text-white/60">
          Log a symptom and see possible medication causes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl md:p-8"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-white">Symptom</label>
          <input
            required
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            placeholder="e.g. dizziness"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 backdrop-blur-md outline-none transition-colors focus:border-white/25 focus:bg-white/10"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-white">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SymptomSeverity)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-md outline-none transition-colors focus:border-white/25 focus:bg-white/10"
          >
            <option value="mild" className="bg-neutral-900">Mild</option>
            <option value="moderate" className="bg-neutral-900">Moderate</option>
            <option value="severe" className="bg-neutral-900">Severe</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-white">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 backdrop-blur-md outline-none transition-colors focus:border-white/25 focus:bg-white/10"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all duration-150 hover:bg-white/20 disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Analyze Symptom"}
        </button>
      </form>

      {result && (
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl md:p-8">
          <div>
            <h2 className="text-lg font-bold text-white">Possible Causes</h2>
            <p className="text-sm text-white/50">{result.effect}</p>
          </div>

          <div className="space-y-2">
            {result.likely_culprits.map((culprit) => (
              <div
                key={culprit.medication_id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{culprit.display_name}</div>
                  <span className="text-sm capitalize text-white/50">
                    {culprit.likelihood}
                  </span>
                </div>
                <div className="mt-1 text-sm text-white/50">
                  {culprit.reason}
                </div>
              </div>
            ))}
          </div>

          <div className="text-sm text-white/40">{result.disclaimer}</div>
        </div>
      )}
    </div>
  );
}