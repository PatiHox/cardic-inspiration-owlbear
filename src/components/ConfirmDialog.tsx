import { useEffect, useRef } from "react";

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

  return (
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
    </div>
  );
}
