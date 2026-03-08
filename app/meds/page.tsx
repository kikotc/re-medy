"use client";

import { useEffect, useMemo, useState } from "react";
import AddMedicationForm from "@/components/AddMedicationForm";
import MedicationCard from "@/components/MedicationCard";
import MedicationDecisionPanel from "@/components/MedicationDecisionPanel";
import PhotoUploadPanel from "@/components/PhotoUploadPanel";
import {
  autofillFields,
  checkConflicts,
  createMedication,
  getMedications,
  medicationDraftToConflictPayload,
  medicationDraftToCreatePayload,
  type ConflictCheckResponse,
} from "@/lib/api";
import {
  emptyMedicationDraft,
  Medication,
  MedicationDraft,
} from "@/lib/types";

const DEMO_USER_ID = "demo-user";

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

type ParsedMedicationResponse = {
  display_name?: string;
  normalized_name?: string;
  active_ingredients?: Array<{ name: string; strength: string }>;
  dosage_text?: string;
  instructions?: string;
  schedule?: {
    recurrence_type?: "daily" | "weekly";
    days_of_week?: string[];
    times?: string[];
  } | null;
  needs_review?: boolean;
  confidence?: number;
};

function mergeParsedIntoDraft(
  base: MedicationDraft,
  parsed: ParsedMedicationResponse
): MedicationDraft {
  return {
    ...base,
    displayName: parsed.display_name || base.displayName,
    dosageText: parsed.dosage_text || base.dosageText,
    instructions: parsed.instructions || base.instructions,
    recurrenceType:
      parsed.schedule?.recurrence_type || base.recurrenceType || "daily",
    daysOfWeek: parsed.schedule?.days_of_week || base.daysOfWeek,
    time: parsed.schedule?.times?.[0] || base.time,
    normalizedName: parsed.normalized_name || base.normalizedName,
    activeIngredients: parsed.active_ingredients || base.activeIngredients,
    needsReview: parsed.needs_review ?? base.needsReview,
    confidence: parsed.confidence ?? base.confidence,
  };
}

export default function MedsPage() {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [entryMode, setEntryMode] = useState<"photo" | "manual" | null>(null);
  const [draft, setDraft] = useState<MedicationDraft>(emptyMedicationDraft);
  const [suggestedFields, setSuggestedFields] = useState<SuggestedFields>({});
  const [decision, setDecision] = useState<ConflictCheckResponse | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formSeed, setFormSeed] = useState(0);

  useEffect(() => {
    async function loadMedications() {
      try {
        const data = await getMedications(DEMO_USER_ID);
        setMedications(data);
      } catch (error) {
        console.error("Failed to load medications:", error);
      } finally {
        setLoadingMeds(false);
      }
    }

    loadMedications();
  }, []);

  const resetAddFlow = () => {
    setEntryMode(null);
    setDraft(emptyMedicationDraft);
    setSuggestedFields({});
    setFormSeed((prev) => prev + 1);
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
    setFormSeed((prev) => prev + 1);
  };

  const handleManualSubmit = async (values: VisibleFormValues) => {
    let nextDraft: MedicationDraft = {
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
      needsReview: false,
      confidence: Math.max(draft.confidence ?? 0, 0.75),
      source: draft.source || "manual",
    };

    setSubmitting(true);

    try {
      const shouldAutofill =
        !nextDraft.normalizedName ||
        nextDraft.activeIngredients.length === 0 ||
        !nextDraft.dosageText.trim() ||
        !nextDraft.instructions.trim();

      if (shouldAutofill) {
        const autofill = (await autofillFields({
          display_name: nextDraft.displayName,
          dosage_text: nextDraft.dosageText,
          instructions: nextDraft.instructions,
          schedule: {
            recurrence_type: nextDraft.recurrenceType,
            days_of_week:
              nextDraft.recurrenceType === "weekly"
                ? nextDraft.daysOfWeek
                : [],
            times: nextDraft.time ? [nextDraft.time] : [],
          },
        })) as ParsedMedicationResponse;

        nextDraft = {
          ...mergeParsedIntoDraft(nextDraft, autofill),
          needsReview: false,
          confidence: Math.max(autofill.confidence ?? 0, 0.75),
        };

        setDraft(nextDraft);
        setSuggestedFields({
          displayName: !!autofill.display_name,
          dosageText: !!autofill.dosage_text,
          instructions: !!autofill.instructions,
          recurrenceType:
            !!autofill.schedule?.recurrence_type &&
            !!autofill.schedule?.times?.length,
          daysOfWeek: !!autofill.schedule?.days_of_week?.length,
          time: !!autofill.schedule?.times?.length,
        });
        setFormSeed((prev) => prev + 1);
      } else {
        setDraft(nextDraft);
      }

      const result = await checkConflicts(
        DEMO_USER_ID,
        medicationDraftToConflictPayload(nextDraft)
      );

      setDecision(result);
    } catch (error) {
      console.error("Failed to process medication:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAdd = async () => {
    setSubmitting(true);

    try {
      const saved = await createMedication(
        medicationDraftToCreatePayload(draft, DEMO_USER_ID)
      );

      setMedications((prev) => [saved.medication, ...prev]);
      setDecision(null);
      setShowAddPanel(false);
      resetAddFlow();
    } catch (error) {
      console.error("Failed to save medication:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const formInitialValues = useMemo(
    () => ({
      displayName: draft.displayName,
      dosageText: draft.dosageText,
      instructions: draft.instructions,
      recurrenceType: draft.recurrenceType,
      daysOfWeek: draft.daysOfWeek,
      time: draft.time,
    }),
    [draft]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meds</h1>
        <button
          onClick={() => {
            setShowAddPanel((prev) => !prev);
            if (showAddPanel) {
              resetAddFlow();
              setDecision(null);
            }
          }}
          className="rounded-full border px-4 py-2 text-sm font-medium"
        >
          {showAddPanel ? "Close" : "Add Medication"}
        </button>
      </div>

      {decision && (
        <MedicationDecisionPanel
          status={decision.decision_status}
          message={
            decision.message ||
            (decision.decision_status === "SAFE_TO_ADD"
              ? "No conflicts were found."
              : decision.decision_status === "WARNING_CONFIRM_REQUIRED"
                ? "This medication may conflict with another one you already take."
                : decision.decision_status ===
                    "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
                  ? "A schedule adjustment is recommended before adding this medication."
                  : "We could not confidently determine whether this medication is safe.")
          }
          onConfirm={handleConfirmAdd}
          onCancel={() => setDecision(null)}
          confirmLabel={submitting ? "Saving..." : undefined}
        />
      )}

      {showAddPanel && (
        <div className={decision ? "pointer-events-none opacity-50" : ""}>
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
                    key={formSeed}
                    initialValues={formInitialValues}
                    suggestedFields={suggestedFields}
                    onSubmit={handleManualSubmit}
                    submitting={submitting}
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
                key={formSeed}
                initialValues={formInitialValues}
                suggestedFields={suggestedFields}
                onSubmit={handleManualSubmit}
                submitting={submitting}
              />
            </div>
          </>
        </div>
      )}

      <div className="space-y-3">
        {loadingMeds ? (
          <div className="rounded-2xl border p-4 text-sm text-gray-500">
            Loading medications...
          </div>
        ) : medications.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-gray-500">
            No medications added yet.
          </div>
        ) : (
          medications.map((med) => <MedicationCard key={med.id} med={med} />)
        )}
      </div>
    </div>
  );
}