import type { DrawnCard } from "../deck/state";
import { CardChip } from "./CardChip";

interface HandsBoardProps {
  drawnCards: DrawnCard[];
  selfId: string;
  maxHandSize: number | null;
  onFlip: (drawnCardId: string) => void;
  onDiscard: (drawnCardId: string) => void;
}

interface Hand {
  playerId: string;
  playerName: string;
  playerColor: string;
  cards: DrawnCard[];
}

function groupByPlayer(drawnCards: DrawnCard[]): Hand[] {
  const order: string[] = [];
  const hands = new Map<string, Hand>();
  for (const card of drawnCards) {
    let hand = hands.get(card.playerId);
    if (!hand) {
      hand = {
        playerId: card.playerId,
        playerName: card.playerName,
        playerColor: card.playerColor,
        cards: [],
      };
      hands.set(card.playerId, hand);
      order.push(card.playerId);
    }
    hand.cards.push(card);
  }
  return order.map((id) => hands.get(id)!);
}

export function HandsBoard({ drawnCards, selfId, maxHandSize, onFlip, onDiscard }: HandsBoardProps) {
  const hands = groupByPlayer(drawnCards);

  return (
    <section className="panel" aria-labelledby="hands-heading">
      <h2 id="hands-heading" className="panel-title">
        Hands
      </h2>

      {hands.length === 0 && (
        <p className="empty-state">Nobody is holding a card right now.</p>
      )}

      <ul className="hands-list">
        {hands.map((hand) => (
          <li key={hand.playerId} className="hand-row">
            <div className="hand-row-header">
              <span className="player-swatch" style={{ background: hand.playerColor }} />
              <span className="player-name">
                {hand.playerId === selfId ? `${hand.playerName} (you)` : hand.playerName}
                {maxHandSize != null && ` — ${hand.cards.length}/${maxHandSize}`}
              </span>
            </div>
            <div className="hand-cards">
              {hand.cards.map((card) => {
                const isOwn = card.playerId === selfId;
                return (
                  <div key={card.id} className="hand-card">
                    <CardChip cardId={card.cardId} revealed={card.revealed} />
                    {isOwn && !card.revealed && (
                      <button className="btn btn-tiny" onClick={() => onFlip(card.id)}>
                        Flip
                      </button>
                    )}
                    {isOwn && card.revealed && (
                      <button className="btn btn-tiny" onClick={() => onDiscard(card.id)}>
                        Play
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
