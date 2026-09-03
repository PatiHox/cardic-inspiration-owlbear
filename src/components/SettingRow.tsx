import type { ReactNode } from "react";

interface SettingRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** The control(s) for this setting, right-aligned — a Toggle, a number
   * input, a read-only status, or a small group of these. */
  children: ReactNode;
}

/**
 * One row in a settings panel: icon, title + description, right-aligned
 * control. The unit every setting should be built from, so the panel reads
 * as one consistent list instead of each setting inventing its own layout.
 */
export function SettingRow({ icon, title, description, children }: SettingRowProps) {
  return (
    <div className="setting-row">
      <span className="setting-icon">{icon}</span>
      <div className="setting-text">
        <p className="setting-title">{title}</p>
        <p className="setting-description">{description}</p>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name for the control — visually hidden, since the setting's
   * own title (rendered by the enclosing SettingRow) already labels it
   * visually and would be redundant read aloud twice. */
  label: string;
}

/**
 * A real checkbox underneath (keyboard-operable, announced correctly by
 * screen readers) styled as a pill toggle to match the reference design —
 * not a div with a click handler pretending to be one.
 */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sr-only">{label}</span>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}
