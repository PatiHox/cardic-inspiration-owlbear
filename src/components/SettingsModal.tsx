import { useEffect, useRef, useState } from "react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isGM: boolean;
  maxHandSize: number | null;
  onSetMaxHandSize: (max: number | null) => void;
}

export function SettingsModal({ open, onClose, isGM, maxHandSize, onSetMaxHandSize }: SettingsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-heading">Settings</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <HandLimitSettings isGM={isGM} maxHandSize={maxHandSize} onSetMaxHandSize={onSetMaxHandSize} />
      </div>
    </div>
  );
}

function HandLimitSettings({
  isGM,
  maxHandSize,
  onSetMaxHandSize,
}: {
  isGM: boolean;
  maxHandSize: number | null;
  onSetMaxHandSize: (max: number | null) => void;
}) {
  const [enabled, setEnabled] = useState(maxHandSize != null);
  const [draft, setDraft] = useState(maxHandSize != null ? String(maxHandSize) : "5");

  // Stay in sync if another GM client changes this (or on first load).
  useEffect(() => {
    setEnabled(maxHandSize != null);
    if (maxHandSize != null) setDraft(String(maxHandSize));
  }, [maxHandSize]);

  if (!isGM) {
    return (
      <p className="hand-limit-readout">
        {maxHandSize != null
          ? `Hand limit: ${maxHandSize} card${maxHandSize === 1 ? "" : "s"}`
          : "No hand limit set."}
      </p>
    );
  }

  function apply(nextEnabled: boolean, nextDraft: string) {
    if (!nextEnabled) {
      onSetMaxHandSize(null);
      return;
    }
    const n = parseInt(nextDraft, 10);
    if (Number.isFinite(n) && n > 0) onSetMaxHandSize(n);
  }

  return (
    <div className="hand-limit-settings">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            apply(e.target.checked, draft);
          }}
        />
        Limit cards per hand
      </label>
      {enabled && (
        <input
          type="number"
          className="text-input hand-limit-input"
          aria-label="Max cards per hand"
          min={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => apply(enabled, draft)}
          onKeyDown={(e) => e.key === "Enter" && apply(enabled, draft)}
        />
      )}
    </div>
  );
}
