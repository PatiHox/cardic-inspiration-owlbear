/**
 * A card's "pose": where it sits in its owner's hand tray and what shape
 * it's been stretched/turned into. Pure geometry, no React, no OBR.
 *
 * Poses are deliberately NOT part of DeckState. They live in a separate
 * room-metadata key per player (see poseMetadataKey), for three reasons:
 * - Two players shaping their cards at the same moment can't overwrite
 *   each other's work: each only ever writes their own key, and
 *   OBR.room.setMetadata merges top-level keys.
 * - Pose traffic (streamed while dragging) never touches the deck blob, so
 *   a mid-drag write can't clobber a draw or flip someone else just made.
 * - Existing rooms need no migration: DeckState's shape is unchanged.
 */

import { METADATA_KEY } from "./state";

export interface CardPose {
  /** Card centre, as a fraction of the tray width (0..1). */
  x: number;
  /** Card centre, as a fraction of the tray height (0..1). */
  y: number;
  /** Horizontal stretch multiplier on the base card width. */
  scaleX: number;
  /** Vertical stretch multiplier on the base card height. */
  scaleY: number;
  /** Degrees, normalised to (-180, 180]. */
  rotation: number;
  /** Stacking order — whatever was last touched has the highest z. */
  z: number;
}

/** One player's poses, keyed by DrawnCard id. */
export type PoseMap = Record<string, CardPose>;

/** Every player's poses, keyed by player id. */
export type PosesByPlayer = Record<string, PoseMap>;

/** Base (unscaled) card size inside a hand tray, in CSS px at full size. */
export const CARD_W = 56;
export const CARD_H = 72;

/**
 * The tray's aspect ratio (width / height). Positions are stored as
 * fractions, so every client must agree on this to place cards identically;
 * the CSS `aspect-ratio` on .hand-tray is derived from the same constant.
 */
export const TRAY_ASPECT = 352 / 180;

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 3;

/** How often, at most, a player's in-progress pose edits are streamed to the room. */
export const POSE_STREAM_INTERVAL_MS = 150;
/** How long a locally edited pose may override an older room echo before the room wins. */
export const POSE_ECHO_GRACE_MS = 4000;

export const DEFAULT_POSE: Readonly<Omit<CardPose, "x" | "y">> = {
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  z: 0,
};

const POSE_KEY_PREFIX = `${METADATA_KEY}/poses/`;

export function poseMetadataKey(playerId: string): string {
  return POSE_KEY_PREFIX + playerId;
}

/** The player id a pose metadata key belongs to, or null if it isn't one. */
export function playerIdFromPoseKey(key: string): string | null {
  return key.startsWith(POSE_KEY_PREFIX) ? key.slice(POSE_KEY_PREFIX.length) : null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Validate one pose read back from room metadata; null if malformed. */
export function parsePose(value: unknown): CardPose | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (
    !isFiniteNumber(p.x) ||
    !isFiniteNumber(p.y) ||
    !isFiniteNumber(p.scaleX) ||
    !isFiniteNumber(p.scaleY) ||
    !isFiniteNumber(p.rotation)
  ) {
    return null;
  }
  return clampPose({
    x: p.x,
    y: p.y,
    scaleX: p.scaleX,
    scaleY: p.scaleY,
    rotation: p.rotation,
    z: isFiniteNumber(p.z) ? p.z : 0,
  });
}

export function parsePoseMap(value: unknown): PoseMap {
  const out: PoseMap = {};
  if (!value || typeof value !== "object") return out;
  for (const [cardId, raw] of Object.entries(value as Record<string, unknown>)) {
    const pose = parsePose(raw);
    if (pose) out[cardId] = pose;
  }
  return out;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Normalise degrees into (-180, 180]. */
export function normalizeAngle(deg: number): number {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
}

/**
 * Keep a pose inside its allowed envelope: the centre stays within the
 * tray (a card may hang over an edge, but can never be lost off it), and
 * scale stays within MIN_SCALE..MAX_SCALE on each axis.
 */
export function clampPose(pose: CardPose): CardPose {
  return {
    x: clamp(pose.x, 0, 1),
    y: clamp(pose.y, 0, 1),
    scaleX: clamp(pose.scaleX, MIN_SCALE, MAX_SCALE),
    scaleY: clamp(pose.scaleY, MIN_SCALE, MAX_SCALE),
    rotation: normalizeAngle(pose.rotation),
    z: pose.z,
  };
}

export function posesEqual(a: CardPose | undefined, b: CardPose | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.rotation === b.rotation &&
    a.z === b.z
  );
}

/**
 * Where a card that has never been touched sits: bottom row of the tray,
 * left to right, wrapping up into a second row. Computed from the card's
 * index among its owner's still-unposed cards, so every client places it
 * identically without anyone having to write anything.
 */
export function defaultPose(index: number, trayWidthPx: number, trayHeightPx: number): CardPose {
  // Before the tray has been measured (first paint) there's no geometry
  // to place against; the ResizeObserver re-resolves the instant there is.
  if (trayWidthPx <= 0 || trayHeightPx <= 0) return { ...DEFAULT_POSE, x: 0.5, y: 0.5 };
  const gap = 8;
  const pad = 8;
  const pitch = CARD_W + gap;
  const perRow = Math.max(1, Math.floor((trayWidthPx - pad * 2 + gap) / pitch));
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const cx = pad + col * pitch + CARD_W / 2;
  const cy = trayHeightPx - pad - CARD_H / 2 - row * (CARD_H + gap);
  return clampPose({
    ...DEFAULT_POSE,
    x: cx / trayWidthPx,
    y: cy / trayHeightPx,
  });
}

/** Highest z among a pose map (0 if empty), so a touched card can go on top. */
export function topZ(poses: PoseMap): number {
  let max = 0;
  for (const p of Object.values(poses)) if (p.z > max) max = p.z;
  return max;
}

// ---------------------------------------------------------------------------
// Geometry for the transform frame (move / stretch / rotate handles)
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

/** Rotate a vector by `deg` degrees. */
export function rotateVec(v: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** A pose expressed in tray pixels: centre, full size and rotation. */
export interface PoseBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
}

export function poseToBox(pose: CardPose, trayW: number, trayH: number): PoseBox {
  return {
    cx: pose.x * trayW,
    cy: pose.y * trayH,
    w: CARD_W * pose.scaleX,
    h: CARD_H * pose.scaleY,
    rotation: pose.rotation,
  };
}

/**
 * A stretch handle's identity: which edge/corner of the card it sits on,
 * as unit directions in the card's own (unrotated) frame. (1,0) is the
 * right edge's midpoint, (-1,-1) the top-left corner, etc.
 */
export interface HandleDir {
  ux: -1 | 0 | 1;
  uy: -1 | 0 | 1;
}

export const STRETCH_HANDLES: readonly HandleDir[] = [
  { ux: -1, uy: -1 },
  { ux: 0, uy: -1 },
  { ux: 1, uy: -1 },
  { ux: 1, uy: 0 },
  { ux: 1, uy: 1 },
  { ux: 0, uy: 1 },
  { ux: -1, uy: 1 },
  { ux: -1, uy: 0 },
];

/** World (tray px) position of a handle on `box`. */
export function handlePosition(box: PoseBox, dir: HandleDir): Point {
  const local = { x: (dir.ux * box.w) / 2, y: (dir.uy * box.h) / 2 };
  const r = rotateVec(local, box.rotation);
  return { x: box.cx + r.x, y: box.cy + r.y };
}

/** Distance above the card's top edge the rotation knob floats at, in px. */
export const ROTATE_KNOB_OFFSET = 26;

export function rotateKnobPosition(box: PoseBox): Point {
  const r = rotateVec({ x: 0, y: -box.h / 2 - ROTATE_KNOB_OFFSET }, box.rotation);
  return { x: box.cx + r.x, y: box.cy + r.y };
}

/**
 * Resize `start` by dragging handle `dir` to the pointer at `p` (tray px).
 * The opposite edge/corner stays anchored, like every design tool. Edge
 * handles stretch one axis; corners stretch both axes independently by
 * default, or — with `uniform` (Shift held) — keep the card's aspect
 * ratio. Returns the new pose.
 */
export function stretchPose(
  start: CardPose,
  dir: HandleDir,
  p: Point,
  uniform: boolean,
  trayW: number,
  trayH: number,
): CardPose {
  const box = poseToBox(start, trayW, trayH);
  const anchor = handlePosition(box, { ux: -dir.ux as -1 | 0 | 1, uy: -dir.uy as -1 | 0 | 1 });
  // Pointer relative to the anchor, in the card's own unrotated frame.
  const local = rotateVec({ x: p.x - anchor.x, y: p.y - anchor.y }, -box.rotation);

  let w = box.w;
  let h = box.h;
  if (dir.ux !== 0 && dir.uy !== 0 && uniform) {
    // Project onto the original diagonal so both axes grow together.
    const d0 = { x: dir.ux * box.w, y: dir.uy * box.h };
    const len = Math.hypot(d0.x, d0.y);
    const k = (local.x * d0.x + local.y * d0.y) / (len * len);
    w = box.w * k;
    h = box.h * k;
  } else {
    if (dir.ux !== 0) w = local.x * dir.ux;
    if (dir.uy !== 0) h = local.y * dir.uy;
  }

  const scaleX = clamp(w / CARD_W, MIN_SCALE, MAX_SCALE);
  const scaleY = clamp(h / CARD_H, MIN_SCALE, MAX_SCALE);
  const cw = CARD_W * scaleX;
  const ch = CARD_H * scaleY;

  // Re-derive the centre from the (fixed) anchor and the clamped size, so
  // the anchored edge/corner genuinely doesn't move.
  const offset = rotateVec({ x: (dir.ux * cw) / 2, y: (dir.uy * ch) / 2 }, box.rotation);
  const cx = anchor.x + offset.x;
  const cy = anchor.y + offset.y;

  return clampPose({
    ...start,
    x: cx / trayW,
    y: cy / trayH,
    scaleX,
    scaleY,
  });
}

/** Angle from `center` to `p`, in degrees. */
export function angleTo(center: Point, p: Point): number {
  return (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
}

/** Snap an angle to the nearest multiple of `step` degrees. */
export function snapAngle(deg: number, step: number): number {
  return normalizeAngle(Math.round(deg / step) * step);
}
