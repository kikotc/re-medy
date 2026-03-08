"use client";

import { useState } from "react";
import AddMedicationForm from "@/components/AddMedicationForm";
import MedicationCard from "@/components/MedicationCard";
import MedicationDecisionPanel from "@/components/MedicationDecisionPanel";
import PhotoUploadPanel from "@/components/PhotoUploadPanel";
import {
  medicationDraftToConflictPayload,
  medicationDraftToCreatePayload,
} from "@/lib/api";
import { mockMedications } from "@/lib/mockData";
import {
  emptyMedicationDraft,
  Medication,
  MedicationDraft,
} from "@/lib/types";

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
  const [mockDecisionStatus, setMockDecisionStatus] = useState<
    | "SAFE_TO_ADD"
    | "WARNING_CONFIRM_REQUIRED"
    | "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
    | "UNCERTAIN_CONFIRM_REQUIRED"
    | null
  >(null);
  const [medications, setMedications] = useState<Medication[]>(mockMedications);

  const resetAddFlow = () => {
    setEntryMode(null);
    setDraft(emptyMedicationDraft);
    setSuggestedFields({});
  };

  const draftToMedication = (currentDraft: MedicationDraft): Medication => {
    const now = new Date().toISOString();

    return {
      id: `med_${Date.now()}`,
      user_id: "demo-user",
      display_name: currentDraft.displayName,
      normalized_name:
        currentDraft.normalizedName || currentDraft.displayName.toLowerCase(),
      active_ingredients: currentDraft.activeIngredients,
      dosage_text: currentDraft.dosageText,
      instructions: currentDraft.instructions,
      start_date: now.slice(0, 10),
      source: currentDraft.source,
      schedule: {
        recurrence_type: currentDraft.recurrenceType,
        days_of_week:
          currentDraft.recurrenceType === "weekly" ? currentDraft.daysOfWeek : [],
        times: currentDraft.time ? [currentDraft.time] : [],
      },
      created_at: now,
    };
  };

  const handleParsed = (
    values: Partial<MedicationDraft>,
    suggested: SuggestedFields
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

    setMockDecisionStatus("WARNING_CONFIRM_REQUIRED");
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
            if (showAddPanel) {
              resetAddFlow();
              setMockDecisionStatus(null);
            }
          }}
          className="rounded-full border px-4 py-2 text-sm font-medium"
        >
          {showAddPanel ? "Close" : "Add Medication"}
        </button>
      </div>

      {mockDecisionStatus && (
        <MedicationDecisionPanel
          status={mockDecisionStatus}
          message={
            mockDecisionStatus === "SAFE_TO_ADD"
              ? "No conflicts were found."
              : mockDecisionStatus === "WARNING_CONFIRM_REQUIRED"
                ? "This medication may conflict with another one you already take."
                : mockDecisionStatus ===
                    "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
                  ? "A schedule adjustment is recommended before adding this medication."
                  : "We could not confidently determine whether this medication is safe."
          }
          onConfirm={() => {
            const newMedication = draftToMedication(draft);
            setMedications((prev) => [newMedication, ...prev]);
            setMockDecisionStatus(null);
            setShowAddPanel(false);
            resetAddFlow();
          }}
          onCancel={() => {
            console.log("cancelled");
            setMockDecisionStatus(null);
          }}
        />
      )}

      {showAddPanel && (
        <div
          className={mockDecisionStatus ? "pointer-events-none opacity-50" : ""}
        >
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
        </div>
      )}

      <div className="space-y-3">
        {medications.map((med) => (
          <MedicationCard key={med.id} med={med} />
        ))}
      </div>
    </div>
  );
}