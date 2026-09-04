/**
 * Custom drag MIME type carrying the source stack's id. Deliberately not
 * "text/plain": that would let this get interpreted as draggable text
 * anywhere outside the app (e.g. dropped onto another window), which isn't
 * what it is.
 */
export const GIVE_CARD_DRAG_TYPE = "application/x-cardic-give-stack-id";

interface DeckCardControlProps {
  isGM: boolean;
  /** The stack's draw pile is empty — nothing to click or drag either way. */
  stackEmpty: boolean;
  /** The viewer's own hand is at the room's hand-size cap, carrying the
   * limit itself for the tooltip; `false` when not capped. Blocks a regular
   * player from drawing for themselves, whether by click or by dragging
   * onto their own row. Never blocks a GM: giving a card to anyone —
   * including themselves — is a DM action that bypasses the cap, the same
   * way giving to a different player already does. */
  selfAtHandLimit: number | false;
  /** Click, or drag onto your own row: draw the top card into your own hand
   * (a GM's own click/self-drop bypasses the cap; onDraw is wired to route
   * accordingly). */
  onDraw: () => void;
  /** Drag start: supplies the stack id for the drop handler. Anyone can
   * start a drag — where it's allowed to land is decided by the drop
   * target (Hands), not here: everyone can drop onto their own row
   * (same as clicking), only a GM can drop onto someone else's. */
  onDragStartStackId: () => string;
}

/**
 * The deck's top card, face-down — the single control for a stack now, no
 * separate "Draw" button. Click it, or drag it onto your own row in Hands,
 * to draw into your own hand. A GM can also drag it onto a *different*
 * player's row to give them that card directly, bypassing the hand-size
 * cap. Drag is available to everyone (not GM-only): for a regular player
 * it's just an alternate gesture for exactly what clicking already does,
 * so there's no capability hiding behind mouse-only drag for them — the
 * GM's *give-to-someone-else* power specifically is still drag-only, with
 * no keyboard/touch equivalent yet (worth a fallback later if that turns
 * out to matter).
 */
export function DeckCardControl({
  isGM,
  stackEmpty,
  selfAtHandLimit,
  onDraw,
  onDragStartStackId,
}: DeckCardControlProps) {
  // The hand-size cap only ever constrains a regular player's own hand — a
  // GM giving a card to anyone, themselves included, is a DM action that
  // bypasses it (see giveCard in state.ts).
  const capped = !isGM && selfAtHandLimit;
  const canClick = !stackEmpty && !capped;
  // Dragging is at least as capable as clicking: dropping on your own row
  // does the same thing, and a GM can additionally drop onto someone
  // else's row to give them the card.
  const canDrag = !stackEmpty && (isGM || canClick);
  const inert = !canClick && !canDrag;

  let title: string;
  if (stackEmpty) {
    title = "Deck is empty";
  } else if (isGM) {
    title = "Click to draw a card, or drag onto a player in Hands to give them one";
  } else if (inert) {
    title = `Hand limit reached (max ${selfAtHandLimit})`;
  } else {
    title = "Click, or drag onto your own hand, to draw a card";
  }

  return (
    <button
      type="button"
      className="deck-card-control card-chip card-chip--back"
      disabled={inert}
      title={title}
      aria-label="Draw a card"
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(GIVE_CARD_DRAG_TYPE, onDragStartStackId());
      }}
      onClick={() => {
        if (canClick) onDraw();
      }}
    />
  );
}
