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
  // Legs distributed at three different heights along an elongated body,
  // not radiating from one center point — that's what reads as "insect"
  // rather than "gear" at small sizes, where the two shapes otherwise
  // collapse into the same silhouette.
  return (
    <IconBase>
      <ellipse cx="8" cy="9.2" rx="3" ry="3.8" />
      <path d="M6.6 5.9 5.8 4.2M9.4 5.9l.8-1.7" />
      <path d="M5 7.3H3M11 7.3h2M4.8 9.2H2.8M11.2 9.2h2M5 11.1H3M11 11.1h2" />
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

/** Two crossing arrows — the standard "shuffle" glyph. */
export function ShuffleIcon() {
  return (
    <IconBase>
      <polyline points="10.5 2.2 14 2.2 14 5.7" />
      <line x1="2.2" y1="13.8" x2="14" y2="2.2" />
      <polyline points="14 10.3 14 13.8 10.5 13.8" />
      <line x1="9.5" y1="9.5" x2="14" y2="13.8" />
      <line x1="2.2" y1="2.2" x2="6" y2="6" />
    </IconBase>
  );
}

/** A circular arrow — "reshuffle everything back into the draw pile." */
export function ResetIcon() {
  return (
    <IconBase>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 3.3V7h-3.7" />
    </IconBase>
  );
}

/** A trash can, for deleting a deck. */
export function TrashIcon() {
  return (
    <IconBase>
      <path d="M3 4.3h10" />
      <path d="M6 4.3V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.3" />
      <path d="M4.5 4.3 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.7" />
      <path d="M7 6.8v4M9 6.8v4" />
    </IconBase>
  );
}

/** An eye, for the GM-hand-visibility setting row. */
export function EyeIcon() {
  return (
    <IconBase>
      <path d="M1.3 8S3.8 3.2 8 3.2 14.7 8 14.7 8 12.2 12.8 8 12.8 1.3 8 1.3 8Z" />
      <circle cx="8" cy="8" r="2" />
    </IconBase>
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
