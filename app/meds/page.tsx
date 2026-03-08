"use client";

import { useState } from "react";
import AddMedicationForm from "@/components/AddMedicationForm";
import MedicationCard from "@/components/MedicationCard";
import PhotoUploadPanel from "@/components/PhotoUploadPanel";
import { mockMedications } from "@/lib/mockData";
import { emptyMedicationDraft, MedicationDraft } from "@/lib/types";
import {
  medicationDraftToConflictPayload,
  medicationDraftToCreatePayload,
} from "@/lib/api";

type SuggestedFields = {
  displayName?: boolean;
  dosageText?: boolean;
  instructions?: boolean;
  recurrenceType?: boolean;
  daysOfWeek?: boolean;
  time?: boolean;
};

type VisibleFormValues = {
  displayName: string;
  dosageText: string;
  instructions: string;
  recurrenceType: "daily" | "weekly";
  daysOfWeek: string[];
  time: string;
};

export default function MedsPage() {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [entryMode, setEntryMode] = useState<"photo" | "manual" | null>(null);
  const [draft, setDraft] = useState<MedicationDraft>(emptyMedicationDraft);
  const [suggestedFields, setSuggestedFields] = useState<SuggestedFields>({});

  const resetAddFlow = () => {
    setEntryMode(null);
    setDraft(emptyMedicationDraft);
    setSuggestedFields({});
  };

  const handleParsed = (
    values: Partial<MedicationDraft>,
    suggested: SuggestedFields,
  ) => {
    setDraft((prev) => ({
      ...prev,
      ...values,
      source: "photo",
    }));

    setSuggestedFields(suggested);
    setEntryMode("manual");
  };

const handleManualSubmit = (values: VisibleFormValues) => {
  const nextDraft: MedicationDraft = {
    ...draft,

    displayName: values.displayName,
    dosageText: values.dosageText,
    instructions: values.instructions,
    recurrenceType: values.recurrenceType,
    daysOfWeek: values.daysOfWeek,
    time: values.time,

    normalizedName:
      draft.normalizedName || values.displayName.trim().toLowerCase(),

    activeIngredients: draft.activeIngredients,
    needsReview: draft.needsReview,
    confidence: draft.confidence,
    source: draft.source || "manual",
  };

  setDraft(nextDraft);

  console.log(
    "conflict payload:",
    medicationDraftToConflictPayload(nextDraft)
  );
  console.log(
    "create payload:",
    medicationDraftToCreatePayload(nextDraft, "demo-user")
  );
};

  const formInitialValues = {
    displayName: draft.displayName,
    dosageText: draft.dosageText,
    instructions: draft.instructions,
    recurrenceType: draft.recurrenceType,
    daysOfWeek: draft.daysOfWeek,
    time: draft.time,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meds</h1>
        <button
          onClick={() => {
            setShowAddPanel((prev) => !prev);
            if (showAddPanel) resetAddFlow();
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
                <PhotoUploadPanel onParsed={handleParsed} />
              </div>
            )}

            {entryMode === "manual" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={resetAddFlow}
                  className="text-sm text-gray-500"
                >
                  ← Back
                </button>
                <AddMedicationForm
                  initialValues={formInitialValues}
                  suggestedFields={suggestedFields}
                  onSubmit={handleManualSubmit}
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

            <PhotoUploadPanel onParsed={handleParsed} />
            <AddMedicationForm
              initialValues={formInitialValues}
              suggestedFields={suggestedFields}
              onSubmit={handleManualSubmit}
            />
          </div>
        </>
      )}

      <div className="space-y-3">
        {mockMedications.map((med) => (
          <MedicationCard key={med.id} med={med} />
        ))}
      </div>
    </div>
  );
}
