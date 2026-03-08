"use client";

import { useState } from "react";
import { analyzeSideEffect, logSideEffect } from "@/lib/api";
import { ADRAnalysisResponse, SymptomSeverity } from "@/lib/types";

export default function SymptomsPage() {
  const [effect, setEffect] = useState("");
  const [severity, setSeverity] = useState<SymptomSeverity>("mild");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ADRAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      await logSideEffect({
        user_id: "demo-user",
        effect,
        severity,
        date: todayStr,
        notes,
      });

      const analysis = await analyzeSideEffect({
        user_id: "demo-user",
        effect,
        severity,
        date: todayStr,
      });

      setResult(analysis);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Symptoms</h1>
        <p className="text-sm text-gray-500">
          Log a symptom and see possible medication causes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Symptom</label>
          <input
            required
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            placeholder="e.g. dizziness"
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SymptomSeverity)}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={3}
            className="w-full rounded-xl border px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Analyze Symptom"}
        </button>
      </form>

      {result && (
        <div className="space-y-3 rounded-2xl border p-4">
          <div>
            <h2 className="text-lg font-semibold">Possible Causes</h2>
            <p className="text-sm text-gray-500">{result.effect}</p>
          </div>

          <div className="space-y-2">
            {result.likely_culprits.map((culprit) => (
              <div
                key={culprit.medication_id}
                className="rounded-xl border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{culprit.display_name}</div>
                  <span className="text-sm text-gray-500 capitalize">
                    {culprit.likelihood}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {culprit.reason}
                </div>
              </div>
            ))}
          </div>

          <div className="text-sm text-gray-500">{result.disclaimer}</div>
        </div>
      )}
    </div>
  );
}
