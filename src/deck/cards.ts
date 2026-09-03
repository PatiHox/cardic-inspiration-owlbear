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
 * What a revealed card is worth: a flat numeric bonus, the ace's special
 * "critical hit if applicable, otherwise `fallback`" case, or a joker's
 * wild card (no fixed effect — up to the DM).
 */
export type CardBonus =
  | { kind: "value"; amount: number }
  | { kind: "ace"; fallback: number }
  | { kind: "wild" };

/**
 * DM-configurable scale for face-card (J/Q/K/A) bonuses: "cap10" (flat +10
 * for J/Q/K, and the ace's non-crit fallback is also +10 — the default) or
 * "ordinal" (their rank position: J=11, Q=12, K=13, continuing on to the
 * ace's non-crit fallback at 14). The ace's *crit* case itself is never
 * affected — only what it falls back to when a crit doesn't apply.
 */
export type FaceCardScale = "cap10" | "ordinal";
export const DEFAULT_FACE_CARD_SCALE: FaceCardScale = "cap10";

const FACE_CARD_ORDINAL_VALUE: Record<"J" | "Q" | "K", number> = { J: 11, Q: 12, K: 13 };
/** Continues the J=11/Q=12/K=13 sequence (ace-high) for the ace's ordinal fallback. */
const ACE_ORDINAL_FALLBACK = 14;

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

/**
 * What a card is worth: number cards hold their face value, face cards
 * (J/Q/K) are either a flat +10 or their ordinal value per `faceCardScale`,
 * an ace is a critical hit where the roll allows one (otherwise the same
 * scale's fallback: +10, or +14 continuing the ordinal sequence), and
 * jokers are wild — no fixed effect, up to the DM.
 */
export function cardBonus(
  cardId: CardId,
  faceCardScale: FaceCardScale = DEFAULT_FACE_CARD_SCALE,
): CardBonus {
  if (isJoker(cardId)) return { kind: "wild" };
  const parsed = parseCard(cardId);
  if (!parsed) return { kind: "wild" };
  if (parsed.rank === "A") {
    return { kind: "ace", fallback: faceCardScale === "ordinal" ? ACE_ORDINAL_FALLBACK : 10 };
  }
  if (parsed.rank === "J" || parsed.rank === "Q" || parsed.rank === "K") {
    const amount = faceCardScale === "ordinal" ? FACE_CARD_ORDINAL_VALUE[parsed.rank] : 10;
    return { kind: "value", amount };
  }
  return { kind: "value", amount: Number(parsed.rank) };
}

/** Short on-card annotation, e.g. "+7", "+10", "+12", "Crit / +10", "Crit / +14", or "Wild". */
export function cardBonusLabel(
  cardId: CardId,
  faceCardScale: FaceCardScale = DEFAULT_FACE_CARD_SCALE,
): string {
  const bonus = cardBonus(cardId, faceCardScale);
  switch (bonus.kind) {
    case "value":
      return `+${bonus.amount}`;
    case "ace":
      return `Crit / +${bonus.fallback}`;
    case "wild":
      return "Wild";
  }
}

/** Longer description for a tooltip, spelling out the ace/joker special cases. */
export function cardBonusDescription(
  cardId: CardId,
  faceCardScale: FaceCardScale = DEFAULT_FACE_CARD_SCALE,
): string {
  const bonus = cardBonus(cardId, faceCardScale);
  switch (bonus.kind) {
    case "value":
      return `+${bonus.amount}`;
    case "ace":
      return `Critical hit if applicable, otherwise +${bonus.fallback}`;
    case "wild":
      return "Wild card — up to the DM";
  }
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
