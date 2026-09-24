import { useMemo, useRef, useState } from "react";
import type { FaceCardScale } from "../deck/cards";
import type { DrawnCard, PlayerRef } from "../deck/state";
import type { PoseMap, PosesByPlayer } from "../deck/pose";
import { GIVE_CARD_DRAG_TYPE } from "./DeckCardControl";
import { HandTray, OwnHandTray, type PlayDrag } from "./HandTray";
import { useOwnPoses } from "./useOwnPoses";

interface HandsBoardProps {
  drawnCards: DrawnCard[];
  self: PlayerRef;
  /** Other players in the room — shown even if they're holding nothing, so
   * there's always a place to see (and drop a card onto) everyone, not
   * just people already holding something. */
  party: PlayerRef[];
  isGM: boolean;
  maxHandSize: number | null;
  faceCardScale: FaceCardScale;
  /** Ids of every GM currently in the room, so their row(s) can be filtered
   * out for a player viewer when `gmHandVisibleToPlayers` is off. */
  gmPlayerIds: Set<string>;
  /** DM setting: can players see a GM's hand? Ignored for a GM viewer, who
   * always sees every hand regardless. */
  gmHandVisibleToPlayers: boolean;
  onFlip: (drawnCardId: string) => void;
  onDiscard: (drawnCardId: string) => void;
  /** Dropping a deck's card onto your own row: draw it into your own hand,
   * same as clicking it. Respects the hand-size cap for a regular player;
   * a GM bypasses it for themselves too, same as when giving to someone
   * else. */
  onDraw: (stackId: string) => void;
  /** DM only: dropping a deck's card onto a *different* player's row gives
   * it to them directly, bypassing the cap. */
  onGiveCard: (stackId: string, player: PlayerRef) => void;
  /** Every player's card poses (where/how each card sits in their tray). */
  poses: PosesByPlayer;
  /** Write the viewer's own pose map to the room (null clears it). */
  writeOwnPoses: (poses: PoseMap | null) => Promise<void>;
  /** The viewer is dragging a revealed card toward its discard pile. */
  onPlayDragChange: (drag: PlayDrag | null) => void;
}

interface Hand {
  player: PlayerRef;
  cards: DrawnCard[];
}

function buildRoster(self: PlayerRef, party: PlayerRef[], drawnCards: DrawnCard[]): Hand[] {
  const roster = new Map<string, Hand>();
  for (const player of [self, ...party]) {
    roster.set(player.id, { player, cards: [] });
  }
  for (const card of drawnCards) {
    // A card can belong to someone no longer in the roster passed in (e.g.
    // OBR hasn't reported them via party yet) — fall back to the name/color
    // recorded on the card itself rather than dropping it.
    if (!roster.has(card.playerId)) {
      roster.set(card.playerId, {
        player: { id: card.playerId, name: card.playerName, color: card.playerColor },
        cards: [],
      });
    }
    roster.get(card.playerId)!.cards.push(card);
  }
  // Self first, then everyone else in the order they were passed.
  const order = [self.id, ...party.map((p) => p.id)];
  return order.filter((id) => roster.has(id)).map((id) => roster.get(id)!);
}

export function HandsBoard({
  drawnCards,
  self,
  party,
  isGM,
  maxHandSize,
  faceCardScale,
  gmPlayerIds,
  gmHandVisibleToPlayers,
  onFlip,
  onDiscard,
  onDraw,
  onGiveCard,
  poses,
  writeOwnPoses,
  onPlayDragChange,
}: HandsBoardProps) {
  // A GM viewer always sees every hand; a player viewer only sees a GM's
  // hand when the DM has left it visible.
  const hands = buildRoster(self, party, drawnCards).filter(
    (hand) => isGM || gmHandVisibleToPlayers || !gmPlayerIds.has(hand.player.id),
  );

  // Memoised on the *ids* (not the card objects) so useOwnPoses' pruning
  // effect only re-runs when a card actually appears or disappears.
  const ownIdsKey = drawnCards
    .filter((c) => c.playerId === self.id)
    .map((c) => c.id)
    .join("\u0000");
  const ownCardIds = useMemo(() => (ownIdsKey ? ownIdsKey.split("\u0000") : []), [ownIdsKey]);
  const ownPoses = useOwnPoses(poses[self.id], ownCardIds, writeOwnPoses);

  return (
    <section className="panel" aria-labelledby="hands-heading">
      <h2 id="hands-heading" className="panel-title">
        Hands
      </h2>

      <ul className="hands-list">
        {hands.map((hand) => {
          const isSelf = hand.player.id === self.id;
          // Everyone can drop onto their own row (same as clicking); only
          // a GM can drop onto someone else's — "a player should only be
          // able to drop cards onto themselves."
          const isDropTarget = isSelf || isGM;
          return (
            <HandRow
              key={hand.player.id}
              hand={hand}
              isSelf={isSelf}
              isDropTarget={isDropTarget}
              maxHandSize={maxHandSize}
              faceCardScale={faceCardScale}
              poses={isSelf ? ownPoses.poses : poses[hand.player.id] ?? EMPTY_POSES}
              ownPoses={isSelf ? ownPoses : null}
              canRemove={isGM && !isSelf}
              onFlip={onFlip}
              onDiscard={onDiscard}
              onDropCard={(stackId) => (isSelf ? onDraw(stackId) : onGiveCard(stackId, hand.player))}
              onPlayDragChange={onPlayDragChange}
            />
          );
        })}
      </ul>
    </section>
  );
}

const EMPTY_POSES: PoseMap = {};

function HandRow({
  hand,
  isSelf,
  isDropTarget,
  maxHandSize,
  faceCardScale,
  poses,
  ownPoses,
  canRemove,
  onFlip,
  onDiscard,
  onDropCard,
  onPlayDragChange,
}: {
  hand: Hand;
  isSelf: boolean;
  isDropTarget: boolean;
  maxHandSize: number | null;
  faceCardScale: FaceCardScale;
  poses: PoseMap;
  /** Only for the viewer's own row: the editable pose map. */
  ownPoses: ReturnType<typeof useOwnPoses> | null;
  /** A DM looking at someone else's row may remove cards from it (and nothing more). */
  canRemove: boolean;
  onFlip: (drawnCardId: string) => void;
  onDiscard: (drawnCardId: string) => void;
  onDropCard: (stackId: string) => void;
  onPlayDragChange: (drag: PlayDrag | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  // dragenter/dragleave fire again on every child element the pointer
  // crosses — the row's header, its cards, its empty-state text — not just
  // at the row's own outer edge. Moving from the row's own box onto any of
  // those children fires a dragleave(row) + dragenter(child, bubbles to
  // row) pair, which a plain boolean can't tell apart from actually
  // leaving the row: whichever of that pair happens to land last wins,
  // so the highlight could end up stuck off the instant the pointer moved
  // off the outer edge onto the header underneath it. A counter fixes
  // this — enter/leave both bubble from every nested element, so they
  // increment and decrement in matching pairs, and the count only reaches
  // zero once the pointer has genuinely left every element in the row.
  const dragDepth = useRef(0);

  const dropHandlers = isDropTarget
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes(GIVE_CARD_DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        },
        onDragEnter: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes(GIVE_CARD_DRAG_TYPE)) return;
          dragDepth.current++;
          setDragOver(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes(GIVE_CARD_DRAG_TYPE)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          dragDepth.current = 0;
          const stackId = e.dataTransfer.getData(GIVE_CARD_DRAG_TYPE);
          setDragOver(false);
          if (stackId) {
            e.preventDefault();
            onDropCard(stackId);
          }
        },
      }
    : {};

  const emptyHint = isSelf
    ? "No cards — click or drag a deck's card here to draw one."
    : isDropTarget
      ? "No cards — drag a deck's card here to give one."
      : "No cards yet.";

  return (
    <li className={"hand-row" + (dragOver ? " hand-row--drop-target" : "")} {...dropHandlers}>
      <div className="hand-row-header">
        <span className="player-swatch" style={{ background: hand.player.color }} />
        <span className="player-name">
          {isSelf ? `${hand.player.name} (you)` : hand.player.name}
          {maxHandSize != null && ` — ${hand.cards.length}/${maxHandSize}`}
        </span>
      </div>

      {hand.cards.length === 0 ? (
        <p className="hand-empty">{emptyHint}</p>
      ) : ownPoses ? (
        <OwnHandTray
          cards={hand.cards}
          poses={ownPoses.poses}
          faceCardScale={faceCardScale}
          setPose={ownPoses.setPose}
          flush={ownPoses.flush}
          onFlip={onFlip}
          onDiscard={onDiscard}
          onPlayDragChange={onPlayDragChange}
        />
      ) : (
        <HandTray
          cards={hand.cards}
          poses={poses}
          faceCardScale={faceCardScale}
          playerName={hand.player.name}
          onRemove={canRemove ? onDiscard : undefined}
        />
      )}
    </li>
  );
}
