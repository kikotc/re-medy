"use client";

type DecisionStatus =
  | "SAFE_TO_ADD"
  | "WARNING_CONFIRM_REQUIRED"
  | "SCHEDULE_CHANGE_CONFIRM_REQUIRED"
  | "UNCERTAIN_CONFIRM_REQUIRED";

type DecisionPanelProps = {
  status: DecisionStatus;
  title?: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  details?: React.ReactNode;
  cancelFirst?: boolean;
};

export default function MedicationDecisionPanel({
  status,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  details,
  cancelFirst = false,
}: DecisionPanelProps) {
  const defaults = {
    SAFE_TO_ADD: {
      title: "Ready to add",
      confirmLabel: "Add Medication",
      cancelLabel: "Cancel",
    },
    WARNING_CONFIRM_REQUIRED: {
      title: "Warning",
      confirmLabel: "Add Anyway",
      cancelLabel: "Cancel",
    },
    SCHEDULE_CHANGE_CONFIRM_REQUIRED: {
      title: "Schedule change needed",
      confirmLabel: "Approve Change",
      cancelLabel: "Cancel",
    },
    UNCERTAIN_CONFIRM_REQUIRED: {
      title: "Not sure",
      confirmLabel: "Add Anyway",
      cancelLabel: "Cancel",
    },
  }[status];

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title || defaults.title}</h2>
        <p className="text-sm text-white/50">{message}</p>
      </div>

      {details && <div className="rounded-xl border border-white/10 bg-white/5 p-3">{details}</div>}

      <div className="flex gap-2">
        {cancelFirst ? (
          <>
            <button
              type="button"
              autoFocus
              onClick={onCancel}
              className="rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-all"
            >
              {cancelLabel || defaults.cancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/10 transition-all"
            >
              {confirmLabel || defaults.confirmLabel}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-all"
            >
              {confirmLabel || defaults.confirmLabel}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/10 transition-all"
            >
              {cancelLabel || defaults.cancelLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}