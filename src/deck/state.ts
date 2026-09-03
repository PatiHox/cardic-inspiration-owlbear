import {
  DEFAULT_DECK_PRESET_ID,
  deckPreset,
  createDeck,
  shuffle,
  type CardId,
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
}

export const EMPTY_STATE: DeckState = {
  version: 1,
  stacks: [],
  drawnCards: [],
  initialized: false,
};

/** Namespaced room-metadata key, per OBR's recommended reverse-DNS convention. */
export const METADATA_KEY = "dev.owlbear-ext.inspiration-cards/state";

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createStack(
  state: DeckState,
  name: string,
  includeJokers: boolean,
  deckSizeId: string = DEFAULT_DECK_PRESET_ID,
): DeckState {
  const preset = deckPreset(deckSizeId);
  const stack: Stack = {
    id: randomId(),
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

/** Draw the top card of a stack's draw pile into `player`'s hand. */
export function drawCard(
  state: DeckState,
  stackId: string,
  player: PlayerRef,
): DeckState {
  const stack = state.stacks.find((s) => s.id === stackId);
  if (!stack || stack.drawPile.length === 0) return state;

  const drawPile = stack.drawPile.slice();
  const cardId = drawPile.pop()!;

  const drawn: DrawnCard = {
    id: randomId(),
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

/** Flip a drawn card face-up. Should only be invoked by its owning player. */
export function flipCard(state: DeckState, drawnCardId: string): DeckState {
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
