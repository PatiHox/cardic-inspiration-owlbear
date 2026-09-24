import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { cardBonusDescription, cardLabel, type FaceCardScale } from "../deck/cards";
import type { DrawnCard } from "../deck/state";
import {
  CARD_H,
  CARD_W,
  MAX_SCALE,
  MIN_SCALE,
  ROTATE_KNOB_OFFSET,
  STRETCH_HANDLES,
  TRAY_ASPECT,
  angleTo,
  clamp,
  clampPose,
  defaultPose,
  normalizeAngle,
  poseToBox,
  snapAngle,
  stretchPose,
  topZ,
  type CardPose,
  type HandleDir,
  type Point,
  type PoseMap,
} from "../deck/pose";
import { CardChip } from "./CardChip";

/** Other players' trays render the same space at this fraction of full size. */
export const COMPACT_TRAY_SCALE = 0.66;

/** Pointer travel before a press stops being a tap and becomes a drag. */
const TAP_SLOP_PX = 6;
/** Hold without moving this long to open the card menu (touch users' route to it). */
const LONG_PRESS_MS = 500;
const ROTATE_SNAP_DEG = 15;
const NUDGE_PX = 4;
const KEY_SCALE_STEP = 0.1;
/** Auto-scroll the popover when a ghost drag gets this close to its edge. */
const EDGE_SCROLL_ZONE_PX = 48;

/** Attribute a discard pile carries so a dragged card can find it by hit-test. */
export const DISCARD_DROP_ATTR = "data-discard-stack-id";

// ---------------------------------------------------------------------------
// Shared: measuring the tray and resolving poses
// ---------------------------------------------------------------------------

interface Size {
  w: number;
  h: number;
}

function useElementSize(ref: React.RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface Resolved {
  card: DrawnCard;
  pose: CardPose;
  /** Has the owner ever touched this card, or is it still in its default slot? */
  posed: boolean;
}

/**
 * Every card gets a pose: the stored one, or a default slot derived from
 * its position in the hand (so every client agrees without a write).
 * Computed in *logical* tray units (full-size px) so a compact tray lands
 * on exactly the same fractions as the owner's own.
 */
function resolvePoses(cards: DrawnCard[], poses: PoseMap, logical: Size): Resolved[] {
  return cards.map((card, i) => {
    const stored = poses[card.id];
    return {
      card,
      pose: stored ?? defaultPose(i, logical.w, logical.h),
      posed: stored != null,
    };
  });
}

function cardTransform(pose: CardPose, tray: Size, scale: number): string {
  const w = CARD_W * scale;
  const h = CARD_H * scale;
  const cx = pose.x * tray.w;
  const cy = pose.y * tray.h;
  return `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${pose.rotation}deg) scale(${pose.scaleX}, ${pose.scaleY})`;
}

function cardAccessibleName(card: DrawnCard, faceCardScale: FaceCardScale): string {
  return card.revealed
    ? `${cardLabel(card.cardId)} — ${cardBonusDescription(card.cardId, faceCardScale)}`
    : "Face-down card";
}

// ---------------------------------------------------------------------------
// The card itself: pose transform outside, 3D flip inside
// ---------------------------------------------------------------------------

interface TrayCardProps {
  card: DrawnCard;
  pose: CardPose;
  tray: Size;
  scale: number;
  faceCardScale: FaceCardScale;
  selected?: boolean;
  /** Mid-gesture: no transform transition, so the card tracks the pointer. */
  active?: boolean;
  /** Hidden while its ghost is floating outside the tray. */
  hidden?: boolean;
  interactive?: boolean;
  /** A DM viewing someone else's tray: focusable, draggable to the discard pile, nothing else. */
  removable?: boolean;
  /** The DM is carrying this card's ghost right now; the card itself stays put, dimmed. */
  carried?: boolean;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: (e: ReactFocusEvent<HTMLDivElement>) => void;
  describedBy?: string;
}

function TrayCard({
  card,
  pose,
  tray,
  scale,
  faceCardScale,
  selected = false,
  active = false,
  hidden = false,
  interactive = false,
  removable = false,
  carried = false,
  onKeyDown,
  onFocus,
  onBlur,
  describedBy,
}: TrayCardProps) {
  const style: CSSProperties = {
    width: CARD_W * scale,
    height: CARD_H * scale,
    transform: cardTransform(pose, tray, scale),
    zIndex: 1 + pose.z,
  };
  const className =
    "tray-card" +
    (selected ? " tray-card--lifted" : "") +
    (active ? " tray-card--active" : "") +
    (hidden ? " tray-card--hidden" : "") +
    (interactive ? " tray-card--own" : "") +
    (removable ? " tray-card--removable" : "") +
    (carried ? " tray-card--carried" : "");
  const name = cardAccessibleName(card, faceCardScale);
  const focusable = interactive || removable;
  return (
    <div
      className={className}
      style={style}
      data-card-id={card.id}
      role={focusable ? "button" : "listitem"}
      tabIndex={focusable ? 0 : undefined}
      aria-label={interactive && selected ? `${name}, lifted` : name}
      aria-pressed={interactive ? selected : undefined}
      title={removable ? "Drag onto the deck's discard pile to remove this card from the hand" : undefined}
      aria-describedby={describedBy}
      draggable={false}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Both faces are always in the DOM so a reveal is a real 3D turn
          rather than a swap. `revealed` only ever goes false→true (see
          flipCard in state.ts), so this animation only ever plays one way
          — a flipped card is flipped for everyone, permanently. */}
      <div className={"tray-card-flipper" + (card.revealed ? " tray-card-flipper--flipped" : "")}>
        <div className="tray-card-face tray-card-face--back" aria-hidden="true">
          <CardChip cardId={card.cardId} revealed={false} faceCardScale={faceCardScale} />
        </div>
        <div className="tray-card-face tray-card-face--front" aria-hidden="true">
          <CardChip cardId={card.cardId} revealed={true} faceCardScale={faceCardScale} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carrying a card to a discard pile — shared by the owner's "play" drag and
// the DM's "remove" drag
// ---------------------------------------------------------------------------

export interface PlayDrag {
  stackId: string;
  /** Is the pointer currently over that stack's discard pile? */
  over: boolean;
}

interface Ghost {
  cardId: string;
  x: number;
  y: number;
}

/**
 * setPointerCapture throws for a pointer that's already gone (a touch that
 * ended before React got to the handler, a synthetic event) — a lost
 * capture just means the gesture ends at the shell's edge, never a crash.
 */
function capture(el: HTMLElement | null, pointerId: number) {
  try {
    el?.setPointerCapture(pointerId);
  } catch {
    /* see above */
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The floating copy of a card being carried across the popover, the
 * matching discard pile's highlight state, and auto-scroll near the
 * popover's edges. Purely about the carry: what happens on drop is the
 * caller's decision.
 */
function useCarryToDiscard(onPlayDragChange: (drag: PlayDrag | null) => void, isCarrying: () => boolean) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  /** The matching pile currently under the pointer, if any. */
  const dropStackId = useRef<string | null>(null);
  const lastClient = useRef<Point | null>(null);
  const scrollRaf = useRef<number | null>(null);
  const onChange = useRef(onPlayDragChange);
  onChange.current = onPlayDragChange;
  const carrying = useRef(isCarrying);
  carrying.current = isCarrying;

  const stopEdgeScroll = useCallback(() => {
    if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = null;
  }, []);

  const ensureEdgeScroll = useCallback(() => {
    if (scrollRaf.current != null) return;
    const step = () => {
      const p = lastClient.current;
      if (!p || !carrying.current()) {
        scrollRaf.current = null;
        return;
      }
      const h = window.innerHeight;
      let dy = 0;
      if (p.y < EDGE_SCROLL_ZONE_PX) dy = -Math.ceil((EDGE_SCROLL_ZONE_PX - p.y) / 4);
      else if (p.y > h - EDGE_SCROLL_ZONE_PX) dy = Math.ceil((p.y - (h - EDGE_SCROLL_ZONE_PX)) / 4);
      if (dy !== 0) (document.scrollingElement ?? document.documentElement).scrollBy(0, dy);
      scrollRaf.current = requestAnimationFrame(step);
    };
    scrollRaf.current = requestAnimationFrame(step);
  }, []);

  /** Pointer moved while carrying `card`: update ghost, pile highlight, scrolling. */
  const track = useCallback(
    (card: DrawnCard, client: Point, showGhost: boolean) => {
      lastClient.current = client;
      setGhost(showGhost ? { cardId: card.id, x: client.x, y: client.y } : null);
      let over: string | null = null;
      for (const el of document.elementsFromPoint(client.x, client.y)) {
        const pile = (el as HTMLElement).closest?.(`[${DISCARD_DROP_ATTR}]`) as HTMLElement | null;
        if (pile) {
          over = pile.getAttribute(DISCARD_DROP_ATTR);
          break;
        }
      }
      const matches = over === card.stackId;
      const next = matches ? card.stackId : null;
      if (next !== dropStackId.current) {
        dropStackId.current = next;
        onChange.current({ stackId: card.stackId, over: matches });
      }
      if (showGhost) ensureEdgeScroll();
      else stopEdgeScroll();
    },
    [ensureEdgeScroll, stopEdgeScroll],
  );

  /** The carry is over (dropped, cancelled, or turned into something else). */
  const end = useCallback(
    (wasCarrying: boolean) => {
      setGhost(null);
      stopEdgeScroll();
      if (dropStackId.current !== null || wasCarrying) {
        dropStackId.current = null;
        onChange.current(null);
      }
    },
    [stopEdgeScroll],
  );

  return { ghost, dropStackId, track, end };
}

function CarryGhost({
  ghost,
  card,
  pose,
  faceCardScale,
}: {
  ghost: Ghost;
  card: DrawnCard;
  pose: CardPose;
  faceCardScale: FaceCardScale;
}) {
  // Portaled to the app root (see ConfirmDialog.tsx for why not body): it
  // floats over every panel, and `.panel`'s backdrop-filter would otherwise
  // trap a fixed-position child inside that one panel.
  const portalTarget = document.getElementById("app-root") ?? document.body;
  return createPortal(
    <div
      className="tray-ghost"
      aria-hidden="true"
      style={{
        left: ghost.x,
        top: ghost.y,
        width: CARD_W,
        height: CARD_H,
        transform: `translate(-50%, -50%) rotate(${pose.rotation}deg) scale(${pose.scaleX}, ${pose.scaleY})`,
      }}
    >
      <CardChip cardId={card.cardId} revealed={card.revealed} faceCardScale={faceCardScale} />
    </div>,
    portalTarget,
  );
}

// ---------------------------------------------------------------------------
// Read-only tray: everyone else's hands
// ---------------------------------------------------------------------------

interface HandTrayProps {
  cards: DrawnCard[];
  poses: PoseMap;
  faceCardScale: FaceCardScale;
  playerName: string;
  /**
   * DM only: take a card out of this hand, back to its deck's discard
   * pile. Drag it there: a ghost follows the pointer while the card itself
   * stays exactly where its owner put it, and a drop anywhere else simply
   * lets go. Right-click / long-press menu and Delete on a focused card
   * do the same without a pointer. That is the *only* thing a DM can do
   * here — the owner's placement and shaping are theirs alone, and a
   * face-down card stays face-down.
   */
  onRemove?: (drawnCardId: string) => void;
  /** With onRemove: the DM is carrying one of these cards toward its discard pile. */
  onPlayDragChange?: (drag: PlayDrag | null) => void;
}

/**
 * Someone else's hand, mirrored at COMPACT_TRAY_SCALE. Incoming pose
 * changes are streamed at a bounded rate by their owner, so cards here
 * animate between updates (see .tray-card's transition) instead of
 * teleporting. Never writes a pose.
 */
export function HandTray({ cards, poses, faceCardScale, playerName, onRemove, onPlayDragChange }: HandTrayProps) {
  const trayRef = useRef<HTMLDivElement>(null);
  const tray = useElementSize(trayRef);
  const scale = COMPACT_TRAY_SCALE;
  const logical = { w: tray.w / scale, h: tray.h / scale };
  const resolved = resolvePoses(cards, poses, logical);
  const byId = new Map(resolved.map((r) => [r.card.id, r]));

  const shellRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  /** The card the DM is currently carrying (dimmed in place; its ghost follows the pointer). */
  const [carriedId, setCarriedId] = useState<string | null>(null);
  type RemoveGesture =
    | { kind: "press"; cardId: string; pointerId: number; start: Point; timer: ReturnType<typeof setTimeout> }
    | { kind: "carry"; cardId: string; pointerId: number };
  const gesture = useRef<RemoveGesture | null>(null);
  const carry = useCarryToDiscard(onPlayDragChange ?? (() => {}), () => gesture.current?.kind === "carry");
  const hintId = `hand-tray-remove-hint-${playerName.replace(/\W+/g, "-")}`;

  useEffect(() => {
    if (menu && !byId.has(menu.cardId)) setMenu(null);
    if (carriedId && !byId.has(carriedId)) setCarriedId(null);
  });

  const endRemoveGesture = () => {
    const g = gesture.current;
    if (g?.kind === "press") clearTimeout(g.timer);
    gesture.current = null;
    setCarriedId(null);
    carry.end(g?.kind === "carry");
  };

  const cardIdAt = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null;

  const removeHandlers = onRemove
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const cardId = cardIdAt(e.target);
          if (!cardId || !trayRef.current?.contains(e.target as Node)) return;
          e.preventDefault();
          endRemoveGesture();
          setMenu(null);
          capture(shellRef.current, e.pointerId);
          const client = { x: e.clientX, y: e.clientY };
          const timer = setTimeout(() => {
            // Held still: open the menu instead of carrying.
            if (gesture.current?.kind === "press" && gesture.current.cardId === cardId) {
              gesture.current = null;
              setMenu({ cardId, ...client });
            }
          }, LONG_PRESS_MS);
          gesture.current = { kind: "press", cardId, pointerId: e.pointerId, start: client, timer };
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          let g = gesture.current;
          if (!g || g.pointerId !== e.pointerId) return;
          const client = { x: e.clientX, y: e.clientY };
          if (g.kind === "press") {
            if (dist(g.start, client) < TAP_SLOP_PX) return;
            clearTimeout(g.timer);
            g = gesture.current = { kind: "carry", cardId: g.cardId, pointerId: e.pointerId };
            setCarriedId(g.cardId);
          }
          const r = byId.get(g.cardId);
          if (!r) return endRemoveGesture();
          // The card in the tray never moves — only its ghost does.
          carry.track(r.card, client, true);
        },
        onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
          const g = gesture.current;
          if (!g || g.pointerId !== e.pointerId) return;
          const dropped = g.kind === "carry" && carry.dropStackId.current !== null;
          const cardId = g.cardId;
          endRemoveGesture();
          if (dropped) onRemove(cardId);
        },
        onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (gesture.current?.pointerId === e.pointerId) endRemoveGesture();
        },
        onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => {
          const cardId = cardIdAt(e.target);
          if (!cardId) return;
          e.preventDefault();
          endRemoveGesture();
          if (!menu) setMenu({ cardId, x: e.clientX, y: e.clientY });
        },
      }
    : {};

  const onCardKeyDown = (cardId: string) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onRemove) return;
    switch (e.key) {
      case "Delete":
      case "Backspace":
        onRemove(cardId);
        break;
      case "Enter":
      case " ":
      case "ContextMenu":
      case "F10": {
        if (e.key === "F10" && !e.shiftKey) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setMenu({ cardId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        break;
      }
      case "Escape":
        setMenu(null);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const menuCard = menu ? byId.get(menu.cardId) ?? null : null;
  const ghostCard = carry.ghost ? byId.get(carry.ghost.cardId) ?? null : null;
  const portalTarget = document.getElementById("app-root") ?? document.body;

  return (
    <div
      ref={shellRef}
      className={
        "hand-tray-shell hand-tray-shell--compact" +
        (onRemove ? " hand-tray-shell--removable" : "") +
        (carriedId ? " hand-tray-shell--carrying" : "")
      }
      style={{ "--tray-scale": scale, "--tray-aspect": TRAY_ASPECT } as CSSProperties}
      {...removeHandlers}
    >
      {onRemove && (
        <p id={hintId} className="sr-only">
          {playerName}'s cards. As the DM you can remove a card from this hand: drag it onto its deck's discard
          pile, press Delete on it, press Enter for a menu, or right-click or long-press it.
        </p>
      )}
      <div ref={trayRef} className="hand-tray" role={onRemove ? undefined : "list"} aria-label={`${playerName}'s cards`}>
        {resolved.map(({ card, pose }) => (
          <TrayCard
            key={card.id}
            card={card}
            pose={pose}
            tray={tray}
            scale={scale}
            faceCardScale={faceCardScale}
            removable={!!onRemove}
            carried={carriedId === card.id}
            describedBy={onRemove ? hintId : undefined}
            onKeyDown={onRemove ? onCardKeyDown(card.id) : undefined}
          />
        ))}
      </div>
      {ghostCard && carry.ghost && (
        <CarryGhost ghost={carry.ghost} card={ghostCard.card} pose={ghostCard.pose} faceCardScale={faceCardScale} />
      )}
      {menuCard &&
        menu &&
        onRemove &&
        createPortal(
          <TrayMenu
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
            items={[
              {
                label: "Remove from hand",
                onSelect: () => {
                  setMenu(null);
                  onRemove(menuCard.card.id);
                },
              },
            ]}
          />,
          portalTarget,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The viewer's own tray: move / stretch / rotate / lift / flip / play
// ---------------------------------------------------------------------------

interface OwnHandTrayProps {
  cards: DrawnCard[];
  poses: PoseMap;
  faceCardScale: FaceCardScale;
  setPose: (cardId: string, pose: CardPose) => void;
  /** End of a gesture: push the resting pose to the room now. */
  flush: () => void;
  onFlip: (drawnCardId: string) => void;
  onDiscard: (drawnCardId: string) => void;
  /** A revealed card is being dragged toward (or away from) its discard pile. */
  onPlayDragChange: (drag: PlayDrag | null) => void;
}

type Gesture =
  | { kind: "press"; pointerId: number; cardId: string; start: Point; timer: ReturnType<typeof setTimeout> }
  | { kind: "move"; pointerId: number; cardId: string; startPose: CardPose; start: Point; startCenter: Point }
  | { kind: "stretch"; pointerId: number; cardId: string; startPose: CardPose; dir: HandleDir }
  | { kind: "rotate"; pointerId: number; cardId: string; startPose: CardPose; startAngle: number }
  | {
      kind: "pinch";
      cardId: string;
      pointerIds: [number, number];
      startPose: CardPose;
      startDist: number;
      startAngle: number;
      startMid: Point;
      startCenter: Point;
    };

interface Menu {
  cardId: string;
  x: number;
  y: number;
}

function handleCursor(dir: HandleDir, rotation: number): string {
  // Eight compass cursors, picked by the handle's direction after the
  // card's rotation — so the cursor still points along the axis the
  // handle actually drags, even on a card turned on its side.
  const base = (Math.atan2(dir.uy, dir.ux) * 180) / Math.PI;
  const a = ((base + rotation) % 360 + 360) % 360;
  const octant = Math.round(a / 45) % 8;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][
    octant
  ];
}

export function OwnHandTray({
  cards,
  poses,
  faceCardScale,
  setPose,
  flush,
  onFlip,
  onDiscard,
  onPlayDragChange,
}: OwnHandTrayProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const tray = useElementSize(trayRef);
  const scale = 1;
  const resolved = resolvePoses(cards, poses, tray);
  const byId = new Map(resolved.map((r) => [r.card.id, r]));

  // Kept in a ref as well as state: select() can be re-entered from the
  // focus handler it triggers, before React has committed the new state.
  const selectedRef = useRef<string | null>(null);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const setSelectedId = (id: string | null) => {
    selectedRef.current = id;
    setSelectedIdState(id);
  };
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const carry = useCarryToDiscard(onPlayDragChange, () => gesture.current?.kind === "move");
  const ghost = carry.ghost;
  const hintId = "hand-tray-keys-hint";

  // A selected card that vanished (played, deck reset) can't stay selected.
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  useEffect(() => {
    if (selectedId && !byId.has(selectedId)) setSelectedId(null);
    if (menu && !byId.has(menu.cardId)) setMenu(null);
  });

  const trayPoint = useCallback((client: Point): Point => {
    const r = trayRef.current?.getBoundingClientRect();
    if (!r) return client;
    return { x: client.x - r.left, y: client.y - r.top };
  }, []);

  const insideTray = useCallback((client: Point): boolean => {
    const r = trayRef.current?.getBoundingClientRect();
    if (!r) return true;
    return client.x >= r.left && client.x <= r.right && client.y >= r.top && client.y <= r.bottom;
  }, []);

  function bringToFront(cardId: string, base: CardPose): CardPose {
    const max = topZ(poses);
    const holders = Object.values(poses).filter((p) => p.z === max).length;
    const onTop = poses[cardId]?.z === max && holders === 1;
    const pose = onTop ? base : { ...base, z: max + 1 };
    if (!onTop || !poses[cardId]) setPose(cardId, pose);
    return pose;
  }

  function select(cardId: string | null) {
    if (selectedRef.current === cardId) return;
    selectedRef.current = cardId;
    setSelectedId(cardId);
    if (cardId) {
      const r = byId.get(cardId);
      if (r) bringToFront(cardId, r.pose);
      trayRef.current?.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`)?.focus({ preventScroll: true });
    }
  }

  // --- Gesture lifecycle ---------------------------------------------------

  const endGesture = useCallback(() => {
    const g = gesture.current;
    if (g?.kind === "press") clearTimeout(g.timer);
    gesture.current = null;
    setActiveId(null);
    carry.end(g?.kind === "move");
    flush();
  }, [flush, carry]);

  const openMenu = useCallback((cardId: string, client: Point) => {
    setMenu({ cardId, x: client.x, y: client.y });
    setSelectedId(cardId);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    // The menu and ghost are portaled out of this DOM subtree, but React
    // still bubbles their events up the *component* tree to here. Those
    // aren't tray gestures.
    if (!shellRef.current?.contains(target)) return;
    const client = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, client);

    const handleEl = target.closest<HTMLElement>("[data-handle]");
    if (handleEl && selected) {
      e.preventDefault();
      capture(shellRef.current, e.pointerId);
      const which = handleEl.dataset.handle!;
      if (which === "rotate") {
        const box = poseToBox(selected.pose, tray.w, tray.h);
        gesture.current = {
          kind: "rotate",
          pointerId: e.pointerId,
          cardId: selected.card.id,
          startPose: selected.pose,
          startAngle: angleTo({ x: box.cx, y: box.cy }, trayPoint(client)) - selected.pose.rotation,
        };
      } else {
        const [ux, uy] = which.split(",").map(Number) as [HandleDir["ux"], HandleDir["uy"]];
        gesture.current = {
          kind: "stretch",
          pointerId: e.pointerId,
          cardId: selected.card.id,
          startPose: selected.pose,
          dir: { ux, uy },
        };
      }
      setActiveId(selected.card.id);
      return;
    }

    const cardEl = target.closest<HTMLElement>("[data-card-id]");
    const cardId = cardEl?.dataset.cardId;
    const r = cardId ? byId.get(cardId) : undefined;
    if (!r) {
      // Empty tray: put the lifted card back down.
      setSelectedId(null);
      setMenu(null);
      return;
    }
    e.preventDefault();
    setMenu(null);
    capture(shellRef.current, e.pointerId);

    const g = gesture.current;
    if (g && (g.kind === "press" || g.kind === "move") && g.cardId === r.card.id) {
      // Second finger on the same card: pinch to scale, twist to rotate.
      if (g.kind === "press") clearTimeout(g.timer);
      const a = pointers.current.get(g.pointerId)!;
      const b = client;
      const pose = r.pose;
      gesture.current = {
        kind: "pinch",
        cardId: r.card.id,
        pointerIds: [g.pointerId, e.pointerId],
        startPose: pose,
        startDist: Math.max(1, dist(a, b)),
        startAngle: angleTo(a, b),
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        startCenter: { x: pose.x * tray.w, y: pose.y * tray.h },
      };
      carry.end(true);
      setActiveId(r.card.id);
      return;
    }

    const timer = setTimeout(() => {
      // Held still: this is a long-press, not a tap or a drag.
      if (gesture.current?.kind === "press" && gesture.current.cardId === r.card.id) {
        gesture.current = null;
        setActiveId(null);
        openMenu(r.card.id, client);
      }
    }, LONG_PRESS_MS);
    gesture.current = { kind: "press", pointerId: e.pointerId, cardId: r.card.id, start: client, timer };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const client = { x: e.clientX, y: e.clientY };
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, client);
    let g = gesture.current;
    if (!g) return;

    if (g.kind === "press") {
      if (g.pointerId !== e.pointerId || dist(g.start, client) < TAP_SLOP_PX) return;
      clearTimeout(g.timer);
      const r = byId.get(g.cardId);
      if (!r) return endGesture();
      const pose = bringToFront(g.cardId, r.pose);
      setSelectedId(g.cardId);
      g = gesture.current = {
        kind: "move",
        pointerId: e.pointerId,
        cardId: g.cardId,
        startPose: pose,
        start: g.start,
        startCenter: { x: pose.x * tray.w, y: pose.y * tray.h },
      };
      setActiveId(g.cardId);
    }

    const r = byId.get(g.cardId);
    if (!r) return endGesture();

    switch (g.kind) {
      case "move": {
        if (g.pointerId !== e.pointerId) return;
        const cx = g.startCenter.x + (client.x - g.start.x);
        const cy = g.startCenter.y + (client.y - g.start.y);
        setPose(g.cardId, clampPose({ ...g.startPose, x: cx / tray.w, y: cy / tray.h }));
        if (r.card.revealed) {
          // A revealed card can be carried out of the tray, to its
          // deck's discard pile. Face-down cards stay on the tray:
          // there's nowhere else for them to go.
          carry.track(r.card, client, !insideTray(client));
        }
        return;
      }
      case "stretch": {
        if (g.pointerId !== e.pointerId) return;
        const corner = g.dir.ux !== 0 && g.dir.uy !== 0;
        const uniform = corner && !e.shiftKey;
        setPose(g.cardId, stretchPose(g.startPose, g.dir, trayPoint(client), uniform, tray.w, tray.h));
        return;
      }
      case "rotate": {
        if (g.pointerId !== e.pointerId) return;
        const box = poseToBox(g.startPose, tray.w, tray.h);
        let rotation = angleTo({ x: box.cx, y: box.cy }, trayPoint(client)) - g.startAngle;
        rotation = e.shiftKey ? snapAngle(rotation, ROTATE_SNAP_DEG) : normalizeAngle(rotation);
        setPose(g.cardId, { ...g.startPose, rotation });
        return;
      }
      case "pinch": {
        const a = pointers.current.get(g.pointerIds[0]);
        const b = pointers.current.get(g.pointerIds[1]);
        if (!a || !b) return;
        const k = dist(a, b) / g.startDist;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const cx = g.startCenter.x + (mid.x - g.startMid.x);
        const cy = g.startCenter.y + (mid.y - g.startMid.y);
        setPose(
          g.cardId,
          clampPose({
            ...g.startPose,
            x: cx / tray.w,
            y: cy / tray.h,
            scaleX: clamp(g.startPose.scaleX * k, MIN_SCALE, MAX_SCALE),
            scaleY: clamp(g.startPose.scaleY * k, MIN_SCALE, MAX_SCALE),
            rotation: g.startPose.rotation + (angleTo(a, b) - g.startAngle),
          }),
        );
        return;
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      // Lifting either finger ends the pinch; the remaining one starts fresh.
      if (!g.pointerIds.includes(e.pointerId)) return;
      return endGesture();
    }
    if (g.pointerId !== e.pointerId) return;

    if (g.kind === "press") {
      // A tap. First tap lifts the card (hovering); a second tap on the
      // lifted, still face-down card turns it over.
      clearTimeout(g.timer);
      const r = byId.get(g.cardId);
      gesture.current = null;
      if (r) {
        if (selectedRef.current !== g.cardId) select(g.cardId);
        else if (!r.card.revealed) onFlip(g.cardId);
      }
      return endGesture();
    }

    if (g.kind === "move" && carry.dropStackId.current) {
      const id = g.cardId;
      endGesture();
      setSelectedId(null);
      onDiscard(id);
      return;
    }
    endGesture();
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current) endGesture();
  };

  // Right-click opens the same menu long-press does; the browser's own
  // menu would be useless here either way.
  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const cardEl = (e.target as HTMLElement).closest<HTMLElement>("[data-card-id]");
    if (!cardEl) return;
    e.preventDefault();
    if (menu) return; // a long-press already opened it
    if (gesture.current) {
      if (gesture.current.kind === "press") clearTimeout(gesture.current.timer);
      gesture.current = null;
      setActiveId(null);
    }
    openMenu(cardEl.dataset.cardId!, { x: e.clientX, y: e.clientY });
  };

  // Tapping anywhere outside the tray (or its menu) puts the card down.
  useEffect(() => {
    if (!selectedId && !menu) return;
    const onDocDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (shellRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.(".tray-menu")) return;
      setSelectedId(null);
      setMenu(null);
    };
    document.addEventListener("pointerdown", onDocDown, true);
    return () => document.removeEventListener("pointerdown", onDocDown, true);
  }, [selectedId, menu]);

  // --- Keyboard: the buttonless fallback ----------------------------------

  const onCardKeyDown = (r: Resolved) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const { card, pose } = r;
    const isSelected = selectedId === card.id;
    const step = (e.shiftKey ? 5 : 1) * NUDGE_PX;
    const nudge = (dx: number, dy: number) =>
      setPose(card.id, clampPose({ ...pose, x: pose.x + dx / tray.w, y: pose.y + dy / tray.h }));
    const rescale = (d: number) =>
      setPose(card.id, {
        ...pose,
        scaleX: clamp(pose.scaleX + d, MIN_SCALE, MAX_SCALE),
        scaleY: clamp(pose.scaleY + d, MIN_SCALE, MAX_SCALE),
      });
    switch (e.key) {
      case "Enter":
      case " ":
        if (!isSelected) select(card.id);
        else if (!card.revealed) onFlip(card.id);
        break;
      case "ArrowLeft":
        nudge(-step, 0);
        break;
      case "ArrowRight":
        nudge(step, 0);
        break;
      case "ArrowUp":
        nudge(0, -step);
        break;
      case "ArrowDown":
        nudge(0, step);
        break;
      case "[":
        setPose(card.id, { ...pose, rotation: normalizeAngle(pose.rotation - ROTATE_SNAP_DEG) });
        break;
      case "]":
        setPose(card.id, { ...pose, rotation: normalizeAngle(pose.rotation + ROTATE_SNAP_DEG) });
        break;
      case "+":
      case "=":
        rescale(KEY_SCALE_STEP);
        break;
      case "-":
      case "_":
        rescale(-KEY_SCALE_STEP);
        break;
      case "Delete":
      case "Backspace":
        if (card.revealed) {
          setSelectedId(null);
          onDiscard(card.id);
        }
        break;
      case "Escape":
        setSelectedId(null);
        setMenu(null);
        (e.currentTarget as HTMLElement).blur();
        break;
      case "ContextMenu":
      case "F10":
        if (e.key === "F10" && !e.shiftKey) return;
        {
          const rect = e.currentTarget.getBoundingClientRect();
          openMenu(card.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // --- Menu actions --------------------------------------------------------

  const menuCard = menu ? byId.get(menu.cardId) ?? null : null;
  const runMenu = (action: "flip" | "play" | "reset" | "front") => {
    if (!menuCard) return;
    const { card, pose } = menuCard;
    setMenu(null);
    switch (action) {
      case "flip":
        onFlip(card.id);
        break;
      case "play":
        setSelectedId(null);
        onDiscard(card.id);
        break;
      case "reset":
        setPose(card.id, { ...pose, scaleX: 1, scaleY: 1, rotation: 0 });
        break;
      case "front":
        bringToFront(card.id, pose);
        break;
    }
    flush();
  };

  // --- Render --------------------------------------------------------------

  const frameBox = selected ? poseToBox(selected.pose, tray.w, tray.h) : null;
  const portalTarget = document.getElementById("app-root") ?? document.body;
  const ghostCard = ghost ? byId.get(ghost.cardId) ?? null : null;

  return (
    <div
      ref={shellRef}
      className={"hand-tray-shell hand-tray-shell--own" + (activeId ? " hand-tray-shell--active" : "")}
      style={{ "--tray-scale": scale, "--tray-aspect": TRAY_ASPECT } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
    >
      <p id={hintId} className="sr-only">
        Your cards. Press Enter to lift a card, and Enter again to flip a lifted face-down card. Arrow keys move
        it, square brackets rotate it, plus and minus resize it, Delete plays a revealed card, Escape puts it
        down. With a pointer: drag to move, use the frame handles to stretch and rotate, drop a revealed card on
        its deck's discard pile to play it, and long-press or right-click for a menu.
      </p>
      <div ref={trayRef} className="hand-tray" aria-label="Your cards">
        {resolved.map((r) => (
          <TrayCard
            key={r.card.id}
            card={r.card}
            pose={r.pose}
            tray={tray}
            scale={scale}
            faceCardScale={faceCardScale}
            selected={selectedId === r.card.id}
            active={activeId === r.card.id}
            hidden={ghost?.cardId === r.card.id}
            interactive
            describedBy={hintId}
            onKeyDown={onCardKeyDown(r)}
            onFocus={() => select(r.card.id)}
            onBlur={(e) => {
              // Focus moving off to the rest of the popover (Tab to the
              // settings button, say) puts the card back down, the same as
              // tapping elsewhere does. Focus landing on another card, a
              // handle, or this tray's own menu keeps it lifted.
              const next = e.relatedTarget as HTMLElement | null;
              if (next && (shellRef.current?.contains(next) || next.closest?.(".tray-menu"))) return;
              if (selectedRef.current === r.card.id && !menu) setSelectedId(null);
            }}
          />
        ))}
      </div>

      {selected && frameBox && !ghost && (
        <div
          className="tray-frame"
          aria-hidden="true"
          style={{
            left: frameBox.cx - frameBox.w / 2,
            top: frameBox.cy - frameBox.h / 2,
            width: frameBox.w,
            height: frameBox.h,
            transform: `rotate(${frameBox.rotation}deg)`,
          }}
        >
          {STRETCH_HANDLES.map((d) => (
            <div
              key={`${d.ux},${d.uy}`}
              className="tray-handle"
              data-handle={`${d.ux},${d.uy}`}
              style={{
                left: `${50 + d.ux * 50}%`,
                top: `${50 + d.uy * 50}%`,
                cursor: handleCursor(d, frameBox.rotation),
              }}
            />
          ))}
          <div className="tray-rotate-stem" style={{ height: ROTATE_KNOB_OFFSET }} />
          <div className="tray-handle tray-handle--rotate" data-handle="rotate" style={{ top: -ROTATE_KNOB_OFFSET }} />
        </div>
      )}

      {ghostCard && ghost && (
        <CarryGhost ghost={ghost} card={ghostCard.card} pose={ghostCard.pose} faceCardScale={faceCardScale} />
      )}

      {menuCard &&
        menu &&
        createPortal(
          <TrayMenu
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
            items={[
              menuCard.card.revealed
                ? { label: "Play", onSelect: () => runMenu("play") }
                : { label: "Flip", onSelect: () => runMenu("flip") },
              { label: "Bring to front", onSelect: () => runMenu("front") },
              { label: "Reset shape", onSelect: () => runMenu("reset"), disabled: !menuCard.posed },
            ]}
          />,
          portalTarget,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Long-press / right-click menu
// ---------------------------------------------------------------------------

export interface TrayMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

function TrayMenu({
  items,
  x,
  y,
  onClose,
}: {
  items: TrayMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    // Keep the menu inside the popover, whichever corner it opened near.
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: clamp(x, 4, Math.max(4, window.innerWidth - r.width - 4)),
      y: clamp(y, 4, Math.max(4, window.innerHeight - r.height - 4)),
    });
    el.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="tray-menu" role="menu" style={{ left: pos.x, top: pos.y }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className="tray-menu-item"
          disabled={item.disabled}
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
