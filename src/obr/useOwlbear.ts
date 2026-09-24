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
  /** Apply a pure state transition and sync the result to room metadata. */
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
      const incoming = parseDeckState(metadata);
      // Drop echoes older than what we've already applied — see `rev` in
      // state.ts. A missing rev on either side (old room, old client)
      // means "can't tell", and the incoming state wins as before.
      setDeckState((current) =>
        incoming.rev != null && current.rev != null && incoming.rev < current.rev ? current : incoming,
      );
      setPoses(parsePoses(metadata));
    });

    return () => {
      cancelled = true;
      unsubscribePlayer();
      unsubscribeParty();
      unsubscribeTheme();
      unsubscribeRoom();
    };
  }, [sdkReady]);

  const updateState = useCallback((updater: (state: DeckState) => DeckState) => {
    const current = deckStateRef.current;
    const updated = updater(current);
    // Every state function returns its input untouched when there's
    // nothing to do (a blocked draw, an unknown id) — no write for those.
    if (updated === current) return;
    const next: DeckState = { ...updated, rev: (current.rev ?? 0) + 1 };
    deckStateRef.current = next;
    setDeckState(next);
    void OBR.room.setMetadata({ [METADATA_KEY]: next });
  }, []);

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
