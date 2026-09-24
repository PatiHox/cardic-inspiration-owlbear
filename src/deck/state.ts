import {
  DEFAULT_DECK_PRESET_ID,
  DEFAULT_FACE_CARD_SCALE,
  deckPreset,
  createDeck,
  shuffle,
  type CardId,
  type FaceCardScale,
} from "./cards";

export interface Stack {
  id: string;
  name: string;
  includeJokers: boolean;
  /** Which DeckPreset (see cards.ts) this stack was built from. */
  deckSizeId: string;
  /** Remaining cards to be drawn. The top of the pile is the last element. */
  drawPile: CardId[];
  /** Cards that have been played/returned. */
  discardPile: CardId[];
}

export interface DrawnCard {
  /** Unique id for this particular draw (not the same as the card id). */
  id: string;
  cardId: CardId;
  stackId: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  /** Has the owning player flipped this card face-up yet? */
  revealed: boolean;
  drawnAt: number;
}

export interface DeckState {
  version: 1;
  stacks: Stack[];
  drawnCards: DrawnCard[];
  /** Has the one-time default deck already been created for this room? */
  initialized: boolean;
  /** Max cards a single player may hold across all decks at once, or null for no limit. */
  maxHandSize: number | null;
  /** How face-card (J/Q/K) bonuses are scaled — see FaceCardScale in cards.ts. */
  faceCardScale: FaceCardScale;
  /**
   * Can players see the cards in a GM's own hand? Default true, matching
   * prior behavior (no such filtering existed) so rooms saved before this
   * setting was added are unaffected. Consumers should treat a missing/old
   * value as visible too (`!== false`, not truthiness), the same defensive
   * pattern `faceCardScale`/`maxHandSize` already rely on for old room data.
   */
  gmHandVisibleToPlayers: boolean;
  /**
   * Monotonic write counter, bumped by every client on every write. Lets a
   * client ignore a room-metadata echo that is *older* than what it has
   * already applied locally. Every echo carries a snapshot of the whole
   * room, so the echo of a pose write (a different key, streamed while
   * dragging) still includes the deck state as it was at that moment —
   * and can land after a newer local change (a discard, a flip),
   * briefly reviving the old state until the newer write's own echo
   * arrives. Optional: rooms saved before this existed, and writes from
   * older clients, have none and are always applied.
   */
  rev?: number;
}

export const EMPTY_STATE: DeckState = {
  version: 1,
  stacks: [],
  drawnCards: [],
  initialized: false,
  maxHandSize: null,
  faceCardScale: DEFAULT_FACE_CARD_SCALE,
  gmHandVisibleToPlayers: true,
};

/** Namespaced room-metadata key, per OBR's recommended reverse-DNS convention. */
export const METADATA_KEY = "dev.owlbear-ext.inspiration-cards/state";

/**
 * A fresh id for a new stack or drawn card. Callers generate it *outside*
 * the state function (see App.tsx) so that re-applying the same action to
 * a fresher copy of the room state — which useOwlbear does before every
 * write — produces the same id the optimistic local copy already shows.
 */
export function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createStack(
  state: DeckState,
  name: string,
  includeJokers: boolean,
  deckSizeId: string = DEFAULT_DECK_PRESET_ID,
  id: string = newId(),
): DeckState {
  const preset = deckPreset(deckSizeId);
  const stack: Stack = {
    id,
    name: name.trim() || "Inspiration Deck",
    includeJokers,
    deckSizeId: preset.id,
    drawPile: shuffle(createDeck(preset, includeJokers)),
    discardPile: [],
  };
  return { ...state, stacks: [...state.stacks, stack] };
}

/**
 * One-time setup: if this room has never had a deck created (fresh
 * install), create a standard "Inspiration Deck" and mark the room as
 * initialized so this never re-creates a deck the DM has deliberately
 * cleared out later. Safe to call on every load — it's a no-op once
 * `initialized` is true.
 */
export function ensureDefaultStack(state: DeckState): DeckState {
  if (state.initialized) return state;
  return {
    ...createStack(state, "Inspiration Deck", false, DEFAULT_DECK_PRESET_ID),
    initialized: true,
  };
}

export function renameStack(
  state: DeckState,
  stackId: string,
  name: string,
): DeckState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return {
    ...state,
    stacks: state.stacks.map((s) =>
      s.id === stackId ? { ...s, name: trimmed } : s,
    ),
  };
}

export function deleteStack(state: DeckState, stackId: string): DeckState {
  return {
    ...state,
    stacks: state.stacks.filter((s) => s.id !== stackId),
    drawnCards: state.drawnCards.filter((d) => d.stackId !== stackId),
  };
}

export function shuffleStack(state: DeckState, stackId: string): DeckState {
  return {
    ...state,
    stacks: state.stacks.map((s) =>
      s.id === stackId ? { ...s, drawPile: shuffle(s.drawPile) } : s,
    ),
  };
}

/**
 * DM "reset": return every card for this stack - the discard pile and any
 * still-outstanding drawn cards - into a freshly shuffled draw pile.
 */
export function resetStack(state: DeckState, stackId: string): DeckState {
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack) return state;
  const outstanding = state.drawnCards
    .filter((d) => d.stackId === stackId)
    .map((d) => d.cardId);
  const allCards = [...stack.drawPile, ...stack.discardPile, ...outstanding];
  return {
    ...state,
    stacks: state.stacks.map((s) =>
      s.id === stackId
        ? { ...s, drawPile: shuffle(allCards), discardPile: [] }
        : s,
    ),
    drawnCards: state.drawnCards.filter((d) => d.stackId !== stackId),
  };
}

export interface PlayerRef {
  id: string;
  name: string;
  color: string;
}

/** How many cards `playerId` currently holds across every deck. */
export function handSize(state: DeckState, playerId: string): number {
  return state.drawnCards.filter((d) => d.playerId === playerId).length;
}

/** Has `playerId` reached the configured max-hand-size (always false when unset)? */
export function isHandFull(state: DeckState, playerId: string): boolean {
  return state.maxHandSize != null && handSize(state, playerId) >= state.maxHandSize;
}

/** DM setting: cap on cards a single player may hold at once. `max` <= 0 or null clears it. */
export function setMaxHandSize(state: DeckState, max: number | null): DeckState {
  const normalized = max != null && Number.isFinite(max) && max > 0 ? Math.floor(max) : null;
  return { ...state, maxHandSize: normalized };
}

/** DM setting: how face-card (J/Q/K) bonuses are scaled for every deck in this room. */
export function setFaceCardScale(state: DeckState, scale: FaceCardScale): DeckState {
  return { ...state, faceCardScale: scale };
}

/** DM setting: whether players can see the cards in a GM's own hand. */
export function setGmHandVisibleToPlayers(state: DeckState, visible: boolean): DeckState {
  return { ...state, gmHandVisibleToPlayers: visible };
}

/** Move the top card of a stack's draw pile into `player`'s hand, unconditionally. */
function takeTopCard(state: DeckState, stackId: string, player: PlayerRef, drawnId: string): DeckState {
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack || stack.drawPile.length === 0) return state;
  // Re-applied to a fresher state after this draw already landed? Then
  // the card is in a hand already — nothing to do.
  if (state.drawnCards.some((d) => d.id === drawnId)) return state;

  const drawPile = stack.drawPile.slice();
  const cardId = drawPile.pop()!;

  const drawn: DrawnCard = {
    id: drawnId,
    cardId,
    stackId,
    playerId: player.id,
    playerName: player.name,
    playerColor: player.color,
    revealed: false,
    drawnAt: Date.now(),
  };

  return {
    ...state,
    stacks: state.stacks.map((s) =>
      s.id === stackId ? { ...s, drawPile } : s,
    ),
    drawnCards: [...state.drawnCards, drawn],
  };
}

/** Draw the top card of a stack's draw pile into `player`'s hand. Blocked by the hand-size cap. */
export function drawCard(
  state: DeckState,
  stackId: string,
  player: PlayerRef,
  drawnId: string = newId(),
): DeckState {
  if (state.drawnCards.some((d) => d.id === drawnId)) return state;
  if (isHandFull(state, player.id)) return state;
  return takeTopCard(state, stackId, player, drawnId);
}

/**
 * DM action: hand the top card of a stack directly to `player`. Unlike
 * `drawCard`, this ignores the room's hand-size cap — the DM is always
 * allowed to give a player a card even if they're already at (or over)
 * their limit.
 */
export function giveCard(
  state: DeckState,
  stackId: string,
  player: PlayerRef,
  drawnId: string = newId(),
): DeckState {
  return takeTopCard(state, stackId, player, drawnId);
}

/** Flip a drawn card face-up. Should only be invoked by its owning player. */
export function flipCard(state: DeckState, drawnCardId: string): DeckState {
  const card = state.drawnCards.find((d) => d.id === drawnCardId);
  if (!card || card.revealed) return state;
  return {
    ...state,
    drawnCards: state.drawnCards.map((d) =>
      d.id === drawnCardId ? { ...d, revealed: true } : d,
    ),
  };
}

/** Return a drawn card to its stack's discard pile (the card has been "played"). */
export function discardCard(state: DeckState, drawnCardId: string): DeckState {
  const drawn = state.drawnCards.find((d) => d.id === drawnCardId);
  if (!drawn) return state;
  return {
    ...state,
    stacks: state.stacks.map((s) =>
      s.id === drawn.stackId
        ? { ...s, discardPile: [...s.discardPile, drawn.cardId] }
        : s,
    ),
    drawnCards: state.drawnCards.filter((d) => d.id !== drawnCardId),
  };
}
