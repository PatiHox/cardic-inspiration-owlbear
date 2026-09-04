import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small centered confirmation dialog for irreversible actions — generic,
 * not delete-specific, so anything else that needs an "are you sure?" step
 * later can reuse it. Centered rather than the right-docked style Settings
 * uses: this is a brief interruption, not a surface you'd want taking up
 * the edge of the screen.
 *
 * Replaces swapping a row's own buttons to "Confirm delete"/"Cancel" in
 * place: once Delete became a small icon button, that swap meant the row
 * suddenly jumping from a compact icon to much wider text buttons right
 * when you're about to do something irreversible — this avoids that, and
 * doesn't rely on a bare, unstyled `window.confirm()` either (untested
 * whether that's even reliably available inside an OBR extension's iframe,
 * and it can't be styled to match anything regardless).
 *
 * Focus defaults to Cancel, not the destructive action, so an accidental
 * Enter press right after opening doesn't confirm it. Escape and clicking
 * outside both cancel too.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  // Portaled out from wherever it's nested (some `.panel` row), not
  // rendered in place: `.panel` sets its own `backdrop-filter` for the
  // glass look, and per spec that makes it a containing block for
  // `position: fixed` descendants — so rendered in place, this overlay's
  // "fixed, cover the viewport" would actually only cover that one panel.
  //
  // Targets `#app-root` (the top-level `.app` div — see App.tsx) rather
  // than `document.body`: `.app` fills the whole viewport itself, so it's
  // just as good a home for a full-extension overlay, and — unlike
  // `document.body` — it's where App.tsx puts the `--obr-*` theme
  // variables and `colorScheme` as inline styles. Those only cascade to
  // this dialog if it's still inside `.app`'s DOM subtree; portaling all
  // the way to `document.body` escaped them too and left the dialog stuck
  // on its hardcoded light-mode fallback colors regardless of the real
  // theme. Falls back to `document.body` only if `#app-root` isn't there
  // (shouldn't happen — kept purely defensive).
  const portalTarget = document.getElementById("app-root") ?? document.body;

  return createPortal(
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </p>
        <p id="confirm-dialog-description" className="confirm-dialog-description">
          {description}
        </p>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
