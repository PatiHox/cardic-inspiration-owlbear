import { useEffect, useRef, useState } from "react";
import type { FaceCardScale } from "../deck/cards";
import { BugIcon, CrownIcon, HandIcon } from "./icons";
import { SettingRow, Toggle } from "./SettingRow";

const BUG_REPORT_URL = "https://github.com/PatiHox/owlbear-ext/issues/new";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  isGM: boolean;
  maxHandSize: number | null;
  onSetMaxHandSize: (max: number | null) => void;
  faceCardScale: FaceCardScale;
  onSetFaceCardScale: (scale: FaceCardScale) => void;
}

export function SettingsModal({
  open,
  onClose,
  isGM,
  maxHandSize,
  onSetMaxHandSize,
  faceCardScale,
  onSetFaceCardScale,
}: SettingsModalProps) {
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
          <div>
            <h2 id="settings-heading">Settings</h2>
            <p className="modal-subtitle">Cardic Inspiration</p>
          </div>
          <div className="icon-button-row">
            <a
              className="btn btn-ghost btn-icon"
              href={BUG_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Report a bug on GitHub (opens in a new tab)"
              title="Report a bug"
            >
              <BugIcon />
            </a>
            <button
              ref={closeButtonRef}
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={onClose}
              aria-label="Close settings"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="setting-list">
          <HandLimitSetting isGM={isGM} maxHandSize={maxHandSize} onSetMaxHandSize={onSetMaxHandSize} />
          <FaceCardScaleSetting isGM={isGM} scale={faceCardScale} onSetScale={onSetFaceCardScale} />
        </div>
      </div>
    </div>
  );
}

function HandLimitSetting({
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

  function apply(nextEnabled: boolean, nextDraft: string) {
    if (!nextEnabled) {
      onSetMaxHandSize(null);
      return;
    }
    const n = parseInt(nextDraft, 10);
    if (Number.isFinite(n) && n > 0) onSetMaxHandSize(n);
  }

  if (!isGM) {
    return (
      <SettingRow
        icon={<HandIcon />}
        title="Limit cards per hand"
        description={
          maxHandSize != null
            ? `The DM has capped hands at ${maxHandSize} card${maxHandSize === 1 ? "" : "s"}.`
            : "No limit set by the DM."
        }
      >
        <span className="setting-readout">{maxHandSize ?? "Off"}</span>
      </SettingRow>
    );
  }

  return (
    <SettingRow
      icon={<HandIcon />}
      title="Limit cards per hand"
      description="Cap how many cards a player can hold across all decks at once."
    >
      {enabled && (
        <input
          type="number"
          className="text-input setting-number-input"
          aria-label="Max cards per hand"
          min={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => apply(enabled, draft)}
          onKeyDown={(e) => e.key === "Enter" && apply(enabled, draft)}
        />
      )}
      <Toggle
        checked={enabled}
        onChange={(next) => {
          setEnabled(next);
          apply(next, draft);
        }}
        label="Limit cards per hand"
      />
    </SettingRow>
  );
}

function FaceCardScaleSetting({
  isGM,
  scale,
  onSetScale,
}: {
  isGM: boolean;
  scale: FaceCardScale;
  onSetScale: (scale: FaceCardScale) => void;
}) {
  const isOrdinal = scale === "ordinal";
  // Static regardless of the current value — swapping this text on every
  // toggle click was distracting; the toggle position and the readout
  // (in the read-only view) already show the current value.
  const description = "Flat +10 for J/Q/K, or their ordinal value (J=11, Q=12, K=13).";

  if (!isGM) {
    return (
      <SettingRow icon={<CrownIcon />} title="Face card value" description={description}>
        <span className="setting-readout">{isOrdinal ? "11–13" : "+10"}</span>
      </SettingRow>
    );
  }

  return (
    <SettingRow icon={<CrownIcon />} title="Face card value" description={description}>
      <Toggle
        checked={isOrdinal}
        onChange={(next) => onSetScale(next ? "ordinal" : "cap10")}
        label="Use J/Q/K's ordinal value instead of a flat +10"
      />
    </SettingRow>
  );
}
