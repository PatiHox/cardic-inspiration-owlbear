import { cardColor, cardLabel, type CardId } from "../deck/cards";

interface CardChipProps {
  cardId: CardId;
  revealed: boolean;
}

/** A small visual for a single card, either face-down or revealed. */
export function CardChip({ cardId, revealed }: CardChipProps) {
  if (!revealed) {
    return (
      <span className="card-chip card-chip--back" title="Face-down">
        🂠
      </span>
    );
  }
  const color = cardColor(cardId);
  return (
    <span
      className={`card-chip card-chip--face card-chip--${color}`}
      title={cardLabel(cardId)}
    >
      {cardLabel(cardId)}
    </span>
  );
}
