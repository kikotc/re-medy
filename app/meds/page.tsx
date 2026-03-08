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
  deleteMedication,
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

type SubmitAction = "autofill" | "check";

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

function formatTimeLabel(time: string) {
  if (!time) return "";
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return time;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function getDecisionPresentation(decision: ConflictCheckResponse) {
  const hasMajor = decision.conflicts.some(
    (conflict) => conflict.severity === "major"
  );

  const hasTimingConflict =
    decision.conflicts.some(
      (conflict) =>
        !!conflict.auto_reschedulable || !!conflict.separation_hours
    ) || decision.schedule_suggestions.length > 0;

  const hasDuplicates = decision.duplicates.length > 0;
  const hasConflicts = decision.conflicts.length > 0;

  if (hasMajor) {
    return {
      title: "Major interaction warning",
      message:
        "A major medication interaction was found. Review the details below before adding.",
      cancelFirst: true,
    };
  }

  if (hasTimingConflict) {
    return {
      title: "Timing conflict",
      message:
        "This looks like a timing-related conflict. Review the schedule guidance below before adding.",
      cancelFirst: false,
    };
  }

  if (hasDuplicates) {
    return {
      title: "Duplicate ingredient warning",
      message:
        "A possible duplicate ingredient was found. Review the details below before adding.",
      cancelFirst: false,
    };
  }

  if (hasConflicts) {
    return {
      title: "Interaction warning",
      message:
        "A medication interaction was found. Review the details below before adding.",
      cancelFirst: false,
    };
  }

  return {
    title: "Ready to add",
    message: "No conflicts were found.",
    cancelFirst: false,
  };
}

function getConfirmButtonLabel(
  decision: ConflictCheckResponse | null,
  submitting: boolean
) {
  if (submitting) return "Saving...";

  if (!decision) return undefined;

  if (decision.decision_status === "SCHEDULE_CHANGE_CONFIRM_REQUIRED") {
    return "Use Suggested Schedule";
  }

  if (
    decision.decision_status === "WARNING_CONFIRM_REQUIRED" ||
    decision.decision_status === "UNCERTAIN_CONFIRM_REQUIRED"
  ) {
    return "Add Anyway";
  }

  return undefined;
}

function renderDecisionDetails(
  decision: ConflictCheckResponse,
  candidateDisplayName: string
) {
  const hasDuplicates = decision.duplicates.length > 0;
  const hasConflicts = decision.conflicts.length > 0;
  const hasSuggestions = decision.schedule_suggestions.length > 0;

  if (!hasDuplicates && !hasConflicts && !hasSuggestions) {
    return null;
  }

  const groupedConflicts = new Map<
    string,
    {
      withMedicationId: string;
      withMedicationName: string;
      severity: "major" | "moderate" | "minor";
      reasons: string[];
      guidance: string[];
      ingredientPairs: string[];
      separationHours: number[];
    }
  >();

  for (const conflict of decision.conflicts) {
    const key = conflict.with_medication_id || conflict.with_medication_name;

    if (!groupedConflicts.has(key)) {
      groupedConflicts.set(key, {
        withMedicationId: conflict.with_medication_id,
        withMedicationName: conflict.with_medication_name,
        severity: conflict.severity,
        reasons: [],
        guidance: [],
        ingredientPairs: [],
        separationHours: [],
      });
    }

    const group = groupedConflicts.get(key)!;

    const severityRank = { minor: 1, moderate: 2, major: 3 };
    if (severityRank[conflict.severity] > severityRank[group.severity]) {
      group.severity = conflict.severity;
    }

    if (conflict.reason && !group.reasons.includes(conflict.reason)) {
      group.reasons.push(conflict.reason);
    }

    if (conflict.guidance && !group.guidance.includes(conflict.guidance)) {
      group.guidance.push(conflict.guidance);
    }

    const pairLabel = `${conflict.ingredient_a} + ${conflict.ingredient_b}`;
    if (!group.ingredientPairs.includes(pairLabel)) {
      group.ingredientPairs.push(pairLabel);
    }

    if (
      conflict.auto_reschedulable &&
      conflict.separation_hours &&
      !group.separationHours.includes(conflict.separation_hours)
    ) {
      group.separationHours.push(conflict.separation_hours);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {hasDuplicates && (
        <div className="space-y-2">
          <div className="font-medium">Duplicate ingredients</div>
          {decision.duplicates.map((duplicate, index) => (
            <div
              key={`${duplicate.with_medication_id}-${duplicate.ingredient}-${index}`}
              className="rounded-xl border p-3"
            >
              <div className="font-medium">
                {candidateDisplayName || "This medication"} overlaps with{" "}
                {duplicate.with_medication_name}
              </div>
              <div className="mt-1 text-gray-500">{duplicate.reason}</div>
            </div>
          ))}
        </div>
      )}

      {hasConflicts && (
        <div className="space-y-2">
          <div className="font-medium">Interaction details</div>

          {Array.from(groupedConflicts.values()).map((group, index) => (
            <div
              key={`${group.withMedicationId}-${index}`}
              className="rounded-xl border p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">
                  {candidateDisplayName || "This medication"} +{" "}
                  {group.withMedicationName}
                </div>
                <span className="capitalize text-gray-500">
                  {group.severity}
                </span>
              </div>

              {group.ingredientPairs.length > 0 && (
                <div className="mt-1 text-gray-500">
                  Active ingredients involved: {group.ingredientPairs.join(", ")}
                </div>
              )}

              {group.reasons.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium">Why</div>
                  <div className="space-y-1 text-gray-500">
                    {group.reasons.map((reason, reasonIndex) => (
                      <div key={reasonIndex}>{reason}</div>
                    ))}
                  </div>
                </div>
              )}

              {group.guidance.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium">What to do</div>
                  <div className="space-y-1 text-gray-500">
                    {group.guidance.map((guidance, guidanceIndex) => (
                      <div key={guidanceIndex}>{guidance}</div>
                    ))}
                  </div>
                </div>
              )}

              {group.separationHours.length > 0 && (
                <div className="mt-2 text-gray-500">
                  Suggested separation: at least{" "}
                  {Math.max(...group.separationHours)} hour
                  {Math.max(...group.separationHours) === 1 ? "" : "s"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasSuggestions && (
        <div className="space-y-2">
          <div className="font-medium">Schedule suggestions</div>
          {decision.schedule_suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.target_medication_id}-${index}`}
              className="rounded-xl border p-3"
            >
              <div className="font-medium">
                {suggestion.target_medication_name || "Medication"}
              </div>

              <div className="mt-1 text-gray-500">{suggestion.reason}</div>

              {suggestion.suggested_schedule?.times?.length ? (
                <div className="mt-2 text-gray-500">
                  Suggested time
                  {suggestion.suggested_schedule.times.length > 1 ? "s" : ""}:{" "}
                  {suggestion.suggested_schedule.times
                    .map(formatTimeLabel)
                    .join(", ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [deletingMedicationId, setDeletingMedicationId] = useState<string | null>(null);

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

  const handleManualSubmit = async (
    values: VisibleFormValues,
    action: SubmitAction
  ) => {
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
      if (action === "autofill") {
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
        return;
      }

      setDraft(nextDraft);

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
      let finalDraft = draft;

      if (
        decision?.decision_status === "SCHEDULE_CHANGE_CONFIRM_REQUIRED" &&
        decision.schedule_suggestions.length > 0
      ) {
        const candidateSuggestion = decision.schedule_suggestions.find(
          (suggestion) => suggestion.is_candidate && suggestion.suggested_schedule
        );

        if (candidateSuggestion?.suggested_schedule) {
          finalDraft = {
            ...draft,
            recurrenceType:
              candidateSuggestion.suggested_schedule.recurrence_type ||
              draft.recurrenceType,
            daysOfWeek:
              candidateSuggestion.suggested_schedule.days_of_week || [],
            time:
              candidateSuggestion.suggested_schedule.times?.[0] || draft.time,
          };

          setDraft(finalDraft);
        }
      }

      const saved = await createMedication(
        medicationDraftToCreatePayload(finalDraft, DEMO_USER_ID)
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

  const handleDeleteMedication = async (medicationId: string) => {
    setDeletingMedicationId(medicationId);

    try {
      await deleteMedication(medicationId, DEMO_USER_ID);
      setMedications((prev) => prev.filter((med) => med.id !== medicationId));
    } catch (error) {
      console.error("Failed to delete medication:", error);
    } finally {
      setDeletingMedicationId(null);
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

  const decisionPresentation = decision
    ? getDecisionPresentation(decision)
    : null;

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

      {decision && decisionPresentation && (
        <MedicationDecisionPanel
          status={decision.decision_status}
          title={decisionPresentation.title}
          message={decision.message || decisionPresentation.message}
          details={renderDecisionDetails(decision, draft.displayName)}
          cancelFirst={decisionPresentation.cancelFirst}
          onConfirm={handleConfirmAdd}
          onCancel={() => {
            setDecision(null);
            setShowAddPanel(false);
            resetAddFlow();
          }}
          confirmLabel={getConfirmButtonLabel(decision, submitting)}
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
          medications.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              onDelete={() => handleDeleteMedication(med.id)}
              deleting={deletingMedicationId === med.id}
            />
          ))
        )}
      </div>
    </div>
  );
}