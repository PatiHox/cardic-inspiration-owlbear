import { useCallback, useEffect, useRef, useState } from "react";
import OBR, { type Metadata, type Player, type Theme } from "@owlbear-rodeo/sdk";
import { type DeckState, EMPTY_STATE, METADATA_KEY } from "../deck/state";
import {
  parsePoseMap,
  playerIdFromPoseKey,
  poseMetadataKey,
  type PoseMap,
  type PosesByPlayer,
} from "../deck/pose";

export interface Self {
  id: string;
  role: "GM" | "PLAYER";
  name: string;
  color: string;
}

export interface OwlbearContext {
  /** True once the OBR SDK has connected and initial state has loaded. */
  ready: boolean;
  self: Self | null;
  /** Other players currently in the room (does not include `self`). */
  party: Player[];
  theme: Theme | null;
  deckState: DeckState;
  /**
   * Apply a pure state transition. The local view updates at once; the
   * room write is re-applied to the room's *current* state fetched just
   * before sending (see updateState below), so a stale local copy is
   * never written back over other people's changes. Updaters must be
   * pure and idempotent — safe to run twice, on two different bases.
   */
  updateState: (updater: (state: DeckState) => DeckState) => void;
  /**
   * Every player's card poses (position/stretch/rotation in their hand
   * tray), read from one room-metadata key per player. See pose.ts for
   * why these are kept out of `deckState`.
   */
  poses: PosesByPlayer;
  /**
   * Overwrite one player's whole pose map — the caller only ever passes
   * its own player id. `null` deletes the key outright (a player holding
   * nothing shouldn't leave an empty map behind in the room forever).
   * Only that key is written: OBR merges top-level metadata keys, so this
   * can't disturb the deck state or anyone else's poses.
   */
  writePoses: (playerId: string, poses: PoseMap | null) => Promise<void>;
}

/**
 * How long a client's optimistic local state may override an older room
 * echo while its own write is in flight. Generous next to a real round
 * trip (well under a second), but still finite.
 */
const WRITE_GRACE_MS = 4000;

function parseDeckState(metadata: Metadata): DeckState {
  const value = metadata[METADATA_KEY];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as DeckState).stacks) &&
    Array.isArray((value as DeckState).drawnCards)
  ) {
    return value as DeckState;
  }
  return EMPTY_STATE;
}

function parsePoses(metadata: Metadata): PosesByPlayer {
  const out: PosesByPlayer = {};
  for (const [key, value] of Object.entries(metadata)) {
    const playerId = playerIdFromPoseKey(key);
    if (playerId) out[playerId] = parsePoseMap(value);
  }
  return out;
}

export function useOwlbear(): OwlbearContext {
  const [sdkReady, setSdkReady] = useState(false);
  const [self, setSelf] = useState<Self | null>(null);
  const [party, setParty] = useState<Player[]>([]);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [deckState, setDeckState] = useState<DeckState>(EMPTY_STATE);
  const [poses, setPoses] = useState<PosesByPlayer>({});
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  // Kept in sync with `deckState` so `updateState` can compute a new value
  // from the latest state without needing it in its dependency array.
  const deckStateRef = useRef(deckState);
  deckStateRef.current = deckState;

  useEffect(() => OBR.onReady(() => setSdkReady(true)), []);

  // --- Deck-state writes ----------------------------------------------------
  //
  // Room metadata is last-write-wins per key, and the whole deck state is
  // one key. Writing it straight from this client's local copy would put
  // that copy's *staleness* into the room: a DM who acts a moment after a
  // player discarded, before that discard reached them, would write the
  // card right back into the player's hand. So every write is rebased:
  // the updater is re-run on the room's current metadata, fetched from
  // the OBR frontend just before sending. Writes are serialized so each
  // one sees the previous one's result.
  //
  // Stale-echo protection is *bounded*. Every change event carries a
  // snapshot of the whole room, so the echo of an older write (a streamed
  // pose, say) can arrive after a newer local change and briefly carry
  // the older deck state. Such an echo is ignored only while one of our
  // own writes is unconfirmed — until an incoming state carries our
  // written rev, or WRITE_GRACE_MS pass — never longer: past that, the
  // room is the truth even if it means our change didn't land, because a
  // client that silently keeps a state the room doesn't have is the
  // worst outcome of all (that is exactly what "cards vanish for the
  // player, still there for everyone else" looked like).
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const lastWrittenRev = useRef(0);
  const unconfirmedUntil = useRef(0);

  const applyIncoming = useCallback((incoming: DeckState) => {
    if (incoming.rev != null && incoming.rev >= lastWrittenRev.current) unconfirmedUntil.current = 0;
    const protectedWindow = Date.now() < unconfirmedUntil.current;
    setDeckState((current) => {
      const older = incoming.rev != null && current.rev != null && incoming.rev < current.rev;
      return older && protectedWindow ? current : incoming;
    });
  }, []);


  useEffect(() => {
    if (!sdkReady) return;

    let cancelled = false;

    Promise.all([OBR.player.getRole(), OBR.player.getName(), OBR.player.getColor()]).then(
      ([role, name, color]) => {
        if (!cancelled) setSelf({ id: OBR.player.id, role, name, color });
      },
    );
    const unsubscribePlayer = OBR.player.onChange((player) => {
      setSelf({ id: player.id, role: player.role, name: player.name, color: player.color });
    });

    OBR.party.getPlayers().then((players) => {
      if (!cancelled) setParty(players);
    });
    const unsubscribeParty = OBR.party.onChange((players) => setParty(players));

    OBR.theme.getTheme().then((value) => {
      if (!cancelled) setTheme(value);
    });
    const unsubscribeTheme = OBR.theme.onChange((value) => setTheme(value));

    OBR.room.getMetadata().then((metadata) => {
      if (!cancelled) {
        setDeckState(parseDeckState(metadata));
        setPoses(parsePoses(metadata));
        setMetadataLoaded(true);
      }
    });
    const unsubscribeRoom = OBR.room.onMetadataChange((metadata) => {
      applyIncoming(parseDeckState(metadata));
      setPoses(parsePoses(metadata));
    });

    return () => {
      cancelled = true;
      unsubscribePlayer();
      unsubscribeParty();
      unsubscribeTheme();
      unsubscribeRoom();
    };
  }, [sdkReady, applyIncoming]);

  const updateState = useCallback(
    (updater: (state: DeckState) => DeckState) => {
      const current = deckStateRef.current;
      const optimistic = updater(current);
      // Every state function returns its input untouched when there's
      // nothing to do (a blocked draw, an unknown id) — no write for those.
      if (optimistic === current) return;
      const localRev = Math.max(current.rev ?? 0, lastWrittenRev.current) + 1;
      const stamped: DeckState = { ...optimistic, rev: localRev };
      deckStateRef.current = stamped;
      setDeckState(stamped);
      unconfirmedUntil.current = Date.now() + WRITE_GRACE_MS;

      writeQueue.current = writeQueue.current
        .then(async () => {
          const fresh = parseDeckState(await OBR.room.getMetadata());
          const next = updater(fresh);
          if (next !== fresh) {
            const rev = Math.max(fresh.rev ?? 0, lastWrittenRev.current) + 1;
            lastWrittenRev.current = rev;
            unconfirmedUntil.current = Date.now() + WRITE_GRACE_MS;
            await OBR.room.setMetadata({ [METADATA_KEY]: { ...next, rev } });
          }
          // Whatever the room holds now — our write included, or a
          // no-op because it was already there — is what we show.
          unconfirmedUntil.current = 0;
          applyIncoming(parseDeckState(await OBR.room.getMetadata()));
        })
        .catch((err: unknown) => {
          console.error("Cardic Inspiration: room write failed", err);
          unconfirmedUntil.current = 0;
        });
    },
    [applyIncoming],
  );

  const writePoses = useCallback((playerId: string, map: PoseMap | null) => {
    // Deliberately NOT mirrored into `poses` optimistically: the writer's
    // own tray renders from its local copy (useOwnPoses), and that hook
    // relies on `poses` reflecting only what the room has actually echoed
    // back, in order, to know when its in-flight edits have landed. An
    // optimistic copy here would make an older echo look like fresh data.
    // `undefined` on a key deletes it from the room's metadata.
    return OBR.room.setMetadata({ [poseMetadataKey(playerId)]: map ?? undefined });
  }, []);

  return {
    ready: sdkReady && self !== null && metadataLoaded,
    self,
    party,
    theme,
    deckState,
    updateState,
    poses,
    writePoses,
  };
}
