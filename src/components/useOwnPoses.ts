import { useCallback, useEffect, useRef, useState } from "react";
import {
  POSE_ECHO_GRACE_MS,
  POSE_STREAM_INTERVAL_MS,
  posesEqual,
  type CardPose,
  type PoseMap,
} from "../deck/pose";

export interface OwnPoses {
  /** The viewer's own poses — locally authoritative while they're editing. */
  poses: PoseMap;
  /**
   * Update one card's pose. The local view updates immediately; the room
   * gets it through the throttled stream (leading + trailing edge, at
   * most one write per POSE_STREAM_INTERVAL_MS).
   */
  setPose: (cardId: string, pose: CardPose) => void;
  /** Push whatever's pending right now — call at the end of a gesture. */
  flush: () => void;
}

/**
 * Owns the viewer's pose map. Two jobs:
 *
 * 1. Throttle. Dragging fires pointer moves far faster than anyone needs
 *    to see over the wire. Local state updates every move; the room is
 *    written at most every POSE_STREAM_INTERVAL_MS, with a leading write
 *    (motion starts instantly for onlookers) and a guaranteed trailing
 *    one (the resting pose always lands), plus `flush()` on gesture end.
 *
 * 2. Don't let our own echoes fight us. Every write we make comes back
 *    through onMetadataChange, and while a stream is in flight an echo of
 *    an *earlier* write can arrive after the local pose has moved on.
 *    Applying it would snap the card backwards for a frame. So a card
 *    that's been touched locally is "dirty", and incoming remote poses are
 *    ignored for it until the room's copy matches what we have — or until
 *    POSE_ECHO_GRACE_MS have passed since it was last touched, whichever
 *    comes first. The time bound matters: if a write was lost, the room
 *    must win eventually rather than this client keeping a pose nobody
 *    else can see.
 *
 * Cards that no longer exist in `cardIds` are pruned on every write, so
 * discards and deck resets never leave orphaned poses behind.
 */
export function useOwnPoses(
  remote: PoseMap | undefined,
  cardIds: readonly string[],
  write: (poses: PoseMap | null) => Promise<void>,
): OwnPoses {
  const [poses, setPoses] = useState<PoseMap>(() => remote ?? {});
  const posesRef = useRef(poses);
  posesRef.current = poses;

  /** Cards touched locally, with when: local wins over remote for a bounded time only. */
  const dirty = useRef(new Map<string, number>());
  const cardIdsRef = useRef(cardIds);
  cardIdsRef.current = cardIds;
  const writeRef = useRef(write);
  writeRef.current = write;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  // Reconcile with the room: remote wins for anything we're not mid-editing.
  // Computed against posesRef (always the latest local map) and committed
  // as a plain value — NOT as a functional setState updater. React may run
  // an updater more than once, and later, against a different base state
  // (e.g. when a passive-effect update gets interrupted by a keypress), so
  // the `dirty` bookkeeping in here must not live inside one: a re-run
  // against a stale base once cleared a card's dirty flag just before an
  // older echo landed, snapping the card back.
  useEffect(() => {
    const incoming = remote ?? {};
    const local = posesRef.current;
    const next: PoseMap = {};
    let changed = false;
    const ids = new Set([...Object.keys(local), ...Object.keys(incoming)]);
    for (const id of ids) {
      const mine = local[id];
      const theirs = incoming[id];
      const touchedAt = dirty.current.get(id);
      if (touchedAt != null) {
        if (posesEqual(mine, theirs) || Date.now() - touchedAt > POSE_ECHO_GRACE_MS) {
          // Landed (or long enough ago that the room is the truth now).
          dirty.current.delete(id);
        } else {
          if (mine) next[id] = mine;
          else changed = true;
          continue;
        }
      }
      if (theirs) {
        next[id] = theirs;
        if (!posesEqual(mine, theirs)) changed = true;
      } else if (mine) {
        changed = true;
      }
    }
    if (changed) {
      posesRef.current = next;
      setPoses(next);
    }
  }, [remote]);

  const doWrite = useCallback(() => {
    pending.current = false;
    const live = new Set(cardIdsRef.current);
    const snapshot: PoseMap = {};
    for (const [id, pose] of Object.entries(posesRef.current)) {
      if (live.has(id)) snapshot[id] = pose;
    }
    void writeRef.current(Object.keys(snapshot).length ? snapshot : null);
  }, []);

  const schedule = useCallback(() => {
    pending.current = true;
    if (timer.current) return; // trailing edge will pick it up
    doWrite();
    const tick = () => {
      if (pending.current) {
        doWrite();
        timer.current = setTimeout(tick, POSE_STREAM_INTERVAL_MS);
      } else {
        timer.current = null;
      }
    };
    timer.current = setTimeout(tick, POSE_STREAM_INTERVAL_MS);
  }, [doWrite]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) doWrite();
  }, [doWrite]);

  const setPose = useCallback(
    (cardId: string, pose: CardPose) => {
      dirty.current.set(cardId, Date.now());
      const next = { ...posesRef.current, [cardId]: pose };
      posesRef.current = next;
      setPoses(next);
      schedule();
    },
    [schedule],
  );

  // Cards that vanished (discarded, deck reset) shouldn't linger in the
  // room's copy either — one pruning write when the set shrinks.
  const knownIds = useRef(new Set(cardIds));
  useEffect(() => {
    const now = new Set(cardIds);
    let shrank = false;
    for (const id of knownIds.current) if (!now.has(id)) shrank = true;
    knownIds.current = now;
    if (shrank && Object.keys(posesRef.current).some((id) => !now.has(id))) {
      const pruned: PoseMap = {};
      for (const [id, pose] of Object.entries(posesRef.current)) if (now.has(id)) pruned[id] = pose;
      posesRef.current = pruned;
      setPoses(pruned);
      schedule();
    }
  }, [cardIds, schedule]);

  // Never lose the resting pose to a closed tab mid-stream.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  return { poses, setPose, flush };
}
