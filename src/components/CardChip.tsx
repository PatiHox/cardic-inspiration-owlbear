import { cardBonusDescription, cardBonusLabel, cardColor, cardLabel, type CardId } from "../deck/cards";

interface CardChipProps {
  cardId: CardId;
  revealed: boolean;
}

/** A small visual for a single card, either face-down or revealed. */
export function CardChip({ cardId, revealed }: CardChipProps) {
  if (!revealed) {
    // No emoji glyph here on purpose: the playing-card-suit block (🂠 etc.)
    // has patchy font coverage and renders as a broken/missing-glyph box on
    // several platforms. The diagonal stripe background alone reliably
    // reads as "face-down"; sr-only text covers screen readers, since a
    // `title` tooltip alone isn't reliably exposed to them or to touch users.
    return (
      <span className="card-chip card-chip--back" title="Face-down">
        <span className="sr-only">Face-down card</span>
      </span>
    );
  }
  const color = cardColor(cardId);
  const bonusLabel = cardBonusLabel(cardId);
  return (
    <span
      className={`card-chip card-chip--face card-chip--${color}`}
      title={`${cardLabel(cardId)} — ${cardBonusDescription(cardId)}`}
    >
      <span className="card-chip-rank">{cardLabel(cardId)}</span>
      <span className="card-chip-bonus">{bonusLabel}</span>
    </span>
  );
}
