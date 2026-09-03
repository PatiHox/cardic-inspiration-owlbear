/**
 * Standard playing-card identity and rendering helpers.
 *
 * A CardId is a compact string like "S-K" (King of Spades), "H-10" (Ten of
 * Hearts) or "JOKER-1". Kept as plain strings (rather than an object) so
 * they're cheap to store in arrays inside room metadata.
 */

export type CardId = string;

export const SUITS = ["S", "H", "D", "C"] as const;
export type Suit = (typeof SUITS)[number];

const SUIT_SYMBOL: Record<Suit, string> = {
  S: "♠", // ♠
  H: "♥", // ♥
  D: "♦", // ♦
  C: "♣", // ♣
};

const SUIT_COLOR: Record<Suit, "red" | "black"> = {
  S: "black",
  H: "red",
  D: "red",
  C: "black",
};

export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;
export type Rank = (typeof RANKS)[number];

/**
 * The roll bonus each rank is worth, ace-high: 2-10 face value, J=11, Q=12,
 * K=13, A=14. Change this if your table plays ace-low (A=1) instead.
 */
const RANK_BONUS: Record<Rank, number> = {
  A: 14,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

/** The 6-A short deck used by Six Plus Hold'em and by Schnapsen/Sixty-Six. */
const SHORT_DECK_RANKS: readonly Rank[] = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export interface DeckPreset {
  /** Stable id, stored on a Stack so it survives if labels change later. */
  id: string;
  /** Full label for the size picker, e.g. "36 cards — Short Deck (6-A)". */
  label: string;
  /** Short badge shown on a deck's row, or null for the unremarkable default. */
  tag: string | null;
  /** Ranks present in a single copy. */
  ranks: readonly Rank[];
  /** How many copies of that rank set are combined (a multi-deck "shoe"). */
  deckCount: number;
}

/**
 * The standard deck sizes offered in the UI: the 36-card short deck (Six
 * Plus Hold'em / Schnapsen), a normal 52-card deck, and the multi-deck
 * "shoe" sizes casinos use (2/4/6/8 combined 52-card decks) for a bigger
 * table that wants more cards in circulation before a reshuffle.
 */
export const DECK_PRESETS: DeckPreset[] = [
  { id: "36", label: "36 cards — Short Deck (6-A)", tag: "Short Deck", ranks: SHORT_DECK_RANKS, deckCount: 1 },
  { id: "52", label: "52 cards — 1 deck", tag: null, ranks: RANKS, deckCount: 1 },
  { id: "104", label: "104 cards — 2 decks", tag: "2 decks", ranks: RANKS, deckCount: 2 },
  { id: "208", label: "208 cards — 4 decks", tag: "4 decks", ranks: RANKS, deckCount: 4 },
  { id: "312", label: "312 cards — 6 decks", tag: "6 decks", ranks: RANKS, deckCount: 6 },
  { id: "416", label: "416 cards — 8 decks", tag: "8 decks", ranks: RANKS, deckCount: 8 },
];
export const DEFAULT_DECK_PRESET_ID = "52";

export function deckPreset(id: string): DeckPreset {
  return DECK_PRESETS.find((p) => p.id === id) ?? DECK_PRESETS.find((p) => p.id === DEFAULT_DECK_PRESET_ID)!;
}

/**
 * Build the card ids for one deck preset, optionally with 2 jokers per deck
 * copy. Duplicate ids across copies are fine — plain arrays, not a set,
 * hold the draw/discard piles.
 */
export function createDeck(preset: DeckPreset, includeJokers: boolean): CardId[] {
  const singleDeck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of preset.ranks) {
      singleDeck.push(`${suit}-${rank}`);
    }
  }
  if (includeJokers) {
    singleDeck.push("JOKER-1", "JOKER-2");
  }
  const cards: CardId[] = [];
  for (let i = 0; i < preset.deckCount; i++) {
    cards.push(...singleDeck);
  }
  return cards;
}

export function isJoker(cardId: CardId): boolean {
  return cardId.startsWith("JOKER");
}

/** Parse a CardId back into its rank/suit, or null for a joker/invalid id. */
export function parseCard(cardId: CardId): { suit: Suit; rank: Rank } | null {
  const [suit, rank] = cardId.split("-") as [Suit, Rank];
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) return null;
  return { suit, rank };
}

/** Short label for a card, e.g. "K♠", "10♥", "Joker". */
export function cardLabel(cardId: CardId): string {
  if (isJoker(cardId)) return "Joker";
  const parsed = parseCard(cardId);
  if (!parsed) return cardId;
  return `${parsed.rank}${SUIT_SYMBOL[parsed.suit]}`;
}

/** The numeric roll bonus for a card, or null for a joker (no fixed value). */
export function cardBonus(cardId: CardId): number | null {
  if (isJoker(cardId)) return null;
  const parsed = parseCard(cardId);
  return parsed ? RANK_BONUS[parsed.rank] : null;
}

/** Short annotation for a revealed card's bonus, e.g. "+11", or "Wild" for a joker. */
export function cardBonusLabel(cardId: CardId): string {
  const bonus = cardBonus(cardId);
  return bonus === null ? "Wild" : `+${bonus}`;
}

/** "red" | "black" for styling a revealed card face; jokers render black. */
export function cardColor(cardId: CardId): "red" | "black" {
  if (isJoker(cardId)) return "black";
  const parsed = parseCard(cardId);
  return parsed ? SUIT_COLOR[parsed.suit] : "black";
}

/** Fisher-Yates shuffle. Returns a new array, does not mutate the input. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
