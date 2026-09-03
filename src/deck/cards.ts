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

/** Build the 52 card ids for a full deck, optionally with 2 jokers. */
export function createDeck(includeJokers: boolean): CardId[] {
  const cards: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(`${suit}-${rank}`);
    }
  }
  if (includeJokers) {
    cards.push("JOKER-1", "JOKER-2");
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
