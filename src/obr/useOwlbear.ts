import { useCallback, useEffect, useRef, useState } from "react";
import OBR, { type Metadata, type Player, type Theme } from "@owlbear-rodeo/sdk";
import { type DeckState, EMPTY_STATE, METADATA_KEY } from "../deck/state";

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

export function useOwlbear(): OwlbearContext {
  const [sdkReady, setSdkReady] = useState(false);
  const [self, setSelf] = useState<Self | null>(null);
  const [party, setParty] = useState<Player[]>([]);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [deckState, setDeckState] = useState<DeckState>(EMPTY_STATE);
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
        setMetadataLoaded(true);
      }
    });
    const unsubscribeRoom = OBR.room.onMetadataChange((metadata) => {
      setDeckState(parseDeckState(metadata));
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
    const next = updater(deckStateRef.current);
    deckStateRef.current = next;
    setDeckState(next);
    void OBR.room.setMetadata({ [METADATA_KEY]: next });
  }, []);

  return {
    ready: sdkReady && self !== null && metadataLoaded,
    self,
    party,
    theme,
    deckState,
    updateState,
  };
}
