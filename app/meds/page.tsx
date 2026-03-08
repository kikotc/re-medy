"use client";

import { useEffect, useState } from "react";
import AddMedicationForm from "@/components/AddMedicationForm";
import MedicationCard from "@/components/MedicationCard";
import MedicationDecisionPanel from "@/components/MedicationDecisionPanel";
import PhotoUploadPanel from "@/components/PhotoUploadPanel";
import {
  checkConflicts,
  createMedication,
  getMedications,
  medicationDraftToConflictPayload,
  medicationDraftToCreatePayload,
} from "@/lib/api";
import {
  ConflictCheckResponse,
  ConflictDecisionStatus,
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
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Conflict check result
  const [conflictResult, setConflictResult] =
    useState<ConflictCheckResponse | null>(null);

  // Load medications on mount
  useEffect(() => {
    async function load() {
      try {
        const meds = await getMedications();
        setMedications(meds);
      } catch (err) {
        console.error("Failed to load medications:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const resetAddFlow = () => {
    setEntryMode(null);
    setDraft(emptyMedicationDraft);
    setSuggestedFields({});
    setConflictResult(null);
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

  const handleManualSubmit = async (values: VisibleFormValues) => {
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
    setChecking(true);

    try {
      const payload = medicationDraftToConflictPayload(nextDraft);
      const result = await checkConflicts(payload);

      // Update draft with normalized data from backend
      if (result.normalized_name) {
        nextDraft.normalizedName = result.normalized_name;
      }
      if (result.active_ingredients && result.active_ingredients.length > 0) {
        nextDraft.activeIngredients = result.active_ingredients;
      }
      setDraft(nextDraft);

      if (result.decision_status === "SAFE_TO_ADD") {
        // Auto-save if no issues
        await saveMedication(nextDraft);
      } else {
        // Show decision panel
        setConflictResult(result);
      }
    } catch (err) {
      console.error("Conflict check failed:", err);
      // Show as uncertain so user can still proceed
      setConflictResult({
        decision_status: "UNCERTAIN_CONFIRM_REQUIRED",
        duplicates: [],
        conflicts: [],
        schedule_suggestions: [],
        uncertainty_message:
          "Could not check for conflicts. You may still add this medication.",
        normalized_name: nextDraft.normalizedName,
        active_ingredients: nextDraft.activeIngredients,
      });
    } finally {
      setChecking(false);
    }
  };

  const saveMedication = async (currentDraft: MedicationDraft) => {
    setSaving(true);
    try {
      const payload = medicationDraftToCreatePayload(currentDraft, "demo-user");
      const response = await createMedication(payload);
      setMedications((prev) => [response.medication, ...prev]);
      setShowAddPanel(false);
      resetAddFlow();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save medication. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    await saveMedication(draft);
    setConflictResult(null);
  };

  const handleCancel = () => {
    setConflictResult(null);
  };

  const decisionMessage = (status: ConflictDecisionStatus, result: ConflictCheckResponse): string => {
    if (status === "SAFE_TO_ADD") return "No conflicts were found.";
    if (status === "UNCERTAIN_CONFIRM_REQUIRED")
      return result.uncertainty_message || "We could not confidently determine whether this medication is safe.";
    if (status === "SCHEDULE_CHANGE_CONFIRM_REQUIRED")
      return "A schedule adjustment is recommended before adding this medication.";
    // WARNING_CONFIRM_REQUIRED
    const reasons = result.conflicts.map((c) => c.reason);
    const dupReasons = result.duplicates.map((d) => d.reason);
    return [...reasons, ...dupReasons].join(" ") || "This medication may conflict with another one you already take.";
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
            }
          }}
          className="rounded-full border px-4 py-2 text-sm font-medium"
        >
          {showAddPanel ? "Close" : "Add Medication"}
        </button>
      </div>

      {conflictResult && (
        <MedicationDecisionPanel
          status={conflictResult.decision_status}
          message={decisionMessage(conflictResult.decision_status, conflictResult)}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          details={
            conflictResult.conflicts.length > 0 ? (
              <div className="space-y-2 text-sm">
                {conflictResult.conflicts.map((c, i) => (
                  <div key={i}>
                    <span className="font-medium capitalize">{c.severity}:</span>{" "}
                    {c.ingredient_a} + {c.ingredient_b} — {c.guidance}
                  </div>
                ))}
              </div>
            ) : undefined
          }
        />
      )}

      {showAddPanel && (
        <div
          className={
            conflictResult || checking || saving
              ? "pointer-events-none opacity-50"
              : ""
          }
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

      {loading ? (
        <div className="text-sm text-gray-500">Loading medications...</div>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <MedicationCard key={med.id} med={med} />
          ))}
          {medications.length === 0 && (
            <div className="rounded-2xl border p-4 text-sm text-gray-500">
              No medications added yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
