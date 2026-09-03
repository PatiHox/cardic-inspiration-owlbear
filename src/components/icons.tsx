// Small inline SVG icons, deliberately not emoji: we already hit one real bug
// this session from relying on an emoji glyph (patchy font coverage, broken
// on some platforms) for the face-down card back. These use `currentColor`
// so they inherit whatever color their containing button/badge sets, and
// render identically everywhere.

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function GearIcon() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
    </IconBase>
  );
}

export function BugIcon() {
  return (
    <IconBase>
      <rect x="5" y="5.5" width="6" height="7" rx="3" />
      <path d="M8 5.5V4M6.2 4.6 5.2 3.3M9.8 4.6l1-1.3M2.5 8.2h2.5M11 8.2h2.5M3.2 11.8l2-1.3M12.8 11.8l-2-1.3M3.2 5.4l2 1.4M12.8 5.4l-2 1.4" />
    </IconBase>
  );
}

/** A crown, for the face-card (J/Q/K) value setting row. */
export function CrownIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 11.5 2 5.5l3 2.3L8 4l3 3.8 3-2.3-.5 6z" />
      <path d="M2.5 11.5h11" strokeLinecap="round" />
    </svg>
  );
}

/** A small fanned pair of cards, used for the hand-size setting row. */
export function HandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <rect
        x="2.2"
        y="3"
        width="7"
        height="10"
        rx="1.2"
        fill="currentColor"
        opacity="0.35"
        transform="rotate(-8 5.7 8)"
      />
      <rect
        x="6.8"
        y="3"
        width="7"
        height="10"
        rx="1.2"
        fill="currentColor"
        opacity="0.8"
        transform="rotate(8 10.3 8)"
      />
    </svg>
  );
}
