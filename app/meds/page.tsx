"use client";

import { useState } from "react";
import AddMedicationForm from "@/components/AddMedicationForm";
import PhotoUploadPanel from "@/components/PhotoUploadPanel";
import { mockMedications } from "@/lib/mockData";

// FOR TESTING AHHHHHHH
const mockSuggestedValues = {
  displayName: "Tylenol",
  dosageText: "500 mg",
  instructions: "Take as needed",
  recurrenceType: "daily" as const,
  daysOfWeek: [],
  time: "09:00",
};

const mockSuggestedFields = {
  displayName: true,
  dosageText: true,
  instructions: true,
  recurrenceType: true,
  daysOfWeek: false,
  time: true,
};

export default function MedsPage() {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [entryMode, setEntryMode] = useState<"photo" | "manual" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meds</h1>
        <button
          onClick={() => {
            setShowAddPanel((prev) => !prev);
            if (showAddPanel) setEntryMode(null);
          }}
          className="rounded-full border px-4 py-2 text-sm font-medium"
        >
          {showAddPanel ? "Close" : "Add Medication"}
        </button>
      </div>

      {showAddPanel && (
        <>
          <div className="space-y-3 rounded-2xl border p-4 md:hidden">
            {!entryMode && (
              <>
                <div>
                  <h2 className="text-lg font-semibold">Add Medication</h2>
                  <p className="text-sm text-gray-500">
                    Taking a photo is the fastest option on mobile.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setEntryMode("photo")}
                    className="w-full rounded-2xl border px-4 py-4 text-left"
                  >
                    <div className="font-medium">Add by Photo</div>
                    <div className="text-sm text-gray-500">
                      Snap or upload a medication bottle or box
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryMode("manual")}
                    className="w-full rounded-2xl border px-4 py-4 text-left"
                  >
                    <div className="font-medium">Enter Manually</div>
                    <div className="text-sm text-gray-500">
                      Type medication details yourself
                    </div>
                  </button>
                </div>
              </>
            )}

            {entryMode === "photo" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setEntryMode(null)}
                  className="text-sm text-gray-500"
                >
                  ← Back
                </button>
                <PhotoUploadPanel />
              </div>
            )}

            {entryMode === "manual" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setEntryMode(null)}
                  className="text-sm text-gray-500"
                >
                  ← Back
                </button>
                <AddMedicationForm
                  initialValues={mockSuggestedValues}
                  suggestedFields={mockSuggestedFields}
                />
              </div>
            )}
          </div>

          <div className="hidden space-y-3 rounded-2xl border p-4 md:block">
            <div>
              <h2 className="text-lg font-semibold">Add Medication</h2>
              <p className="text-sm text-gray-500">
                Enter details manually or upload a photo.
              </p>
            </div>

            <PhotoUploadPanel />
            <AddMedicationForm
              initialValues={mockSuggestedValues}
              suggestedFields={mockSuggestedFields}
            />
          </div>
        </>
      )}

      <div className="space-y-3">
        {mockMedications.map((med) => (
          <div key={med.id} className="rounded-2xl border p-4">
            <div className="font-medium">{med.display_name}</div>
            <div className="text-sm text-gray-500">{med.dosage_text}</div>
            {med.instructions && (
              <div className="text-sm text-gray-500">{med.instructions}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
