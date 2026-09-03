import { useEffect, useState } from "react";
import { DECK_PRESETS, DEFAULT_DECK_PRESET_ID, deckPreset } from "../deck/cards";
import type { Stack } from "../deck/state";

interface StackListProps {
  stacks: Stack[];
  isGM: boolean;
  /** DM-configured cap on cards a single player may hold at once, or null for no limit. */
  maxHandSize: number | null;
  /** How many cards the current viewer is holding right now, across all decks. */
  myHandSize: number;
  onDraw: (stackId: string) => void;
  onShuffle: (stackId: string) => void;
  onReset: (stackId: string) => void;
  onRename: (stackId: string, name: string) => void;
  onDelete: (stackId: string) => void;
  onCreate: (name: string, includeJokers: boolean, deckSizeId: string) => void;
  onSetMaxHandSize: (max: number | null) => void;
}

export function StackList({
  stacks,
  isGM,
  maxHandSize,
  myHandSize,
  onDraw,
  onShuffle,
  onReset,
  onRename,
  onDelete,
  onCreate,
  onSetMaxHandSize,
}: StackListProps) {
  const atHandLimit = maxHandSize != null && myHandSize >= maxHandSize;

  return (
    <section className="panel" aria-labelledby="decks-heading">
      <h2 id="decks-heading" className="panel-title">
        Decks
      </h2>

      <HandLimitSettings isGM={isGM} maxHandSize={maxHandSize} onSetMaxHandSize={onSetMaxHandSize} />

      {stacks.length === 0 && (
        <p className="empty-state">
          {isGM
            ? "No decks yet — create one below to get started."
            : "The DM hasn't set up a deck yet."}
        </p>
      )}

      <ul className="stack-list">
        {stacks.map((stack) => (
          <StackRow
            key={stack.id}
            stack={stack}
            isGM={isGM}
            drawDisabled={stack.drawPile.length === 0 || atHandLimit}
            drawTitle={atHandLimit ? `Hand limit reached (max ${maxHandSize})` : undefined}
            onDraw={() => onDraw(stack.id)}
            onShuffle={() => onShuffle(stack.id)}
            onReset={() => onReset(stack.id)}
            onRename={(name) => onRename(stack.id, name)}
            onDelete={() => onDelete(stack.id)}
          />
        ))}
      </ul>

      {isGM && <NewStackForm onCreate={onCreate} />}
    </section>
  );
}

function HandLimitSettings({
  isGM,
  maxHandSize,
  onSetMaxHandSize,
}: {
  isGM: boolean;
  maxHandSize: number | null;
  onSetMaxHandSize: (max: number | null) => void;
}) {
  const [enabled, setEnabled] = useState(maxHandSize != null);
  const [draft, setDraft] = useState(maxHandSize != null ? String(maxHandSize) : "5");

  // Stay in sync if another GM client changes this (or on first load).
  useEffect(() => {
    setEnabled(maxHandSize != null);
    if (maxHandSize != null) setDraft(String(maxHandSize));
  }, [maxHandSize]);

  if (!isGM) {
    return maxHandSize != null ? (
      <p className="hand-limit-readout">
        Hand limit: {maxHandSize} card{maxHandSize === 1 ? "" : "s"}
      </p>
    ) : null;
  }

  function apply(nextEnabled: boolean, nextDraft: string) {
    if (!nextEnabled) {
      onSetMaxHandSize(null);
      return;
    }
    const n = parseInt(nextDraft, 10);
    if (Number.isFinite(n) && n > 0) onSetMaxHandSize(n);
  }

  return (
    <div className="hand-limit-settings">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            apply(e.target.checked, draft);
          }}
        />
        Limit cards per hand
      </label>
      {enabled && (
        <input
          type="number"
          className="text-input hand-limit-input"
          aria-label="Max cards per hand"
          min={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => apply(enabled, draft)}
          onKeyDown={(e) => e.key === "Enter" && apply(enabled, draft)}
        />
      )}
    </div>
  );
}

interface StackRowProps {
  stack: Stack;
  isGM: boolean;
  drawDisabled: boolean;
  drawTitle: string | undefined;
  onDraw: () => void;
  onShuffle: () => void;
  onReset: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function StackRow({
  stack,
  isGM,
  drawDisabled,
  drawTitle,
  onDraw,
  onShuffle,
  onReset,
  onRename,
  onDelete,
}: StackRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(stack.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function commitRename() {
    onRename(draftName);
    setEditing(false);
  }

  return (
    <li className="stack-row">
      <div className="stack-row-main">
        {editing ? (
          <input
            className="text-input"
            aria-label="Deck name"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraftName(stack.name);
                setEditing(false);
              }
            }}
          />
        ) : isGM ? (
          <button
            type="button"
            className="stack-name stack-name--editable"
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {stack.name}
          </button>
        ) : (
          <span className="stack-name">{stack.name}</span>
        )}
        {deckPreset(stack.deckSizeId).tag && (
          <span className="stack-tag">{deckPreset(stack.deckSizeId).tag}</span>
        )}
        <span className="stack-counts">
          {stack.drawPile.length} left · {stack.discardPile.length} discarded
        </span>
      </div>

      <div className="stack-row-actions">
        <button className="btn btn-primary" onClick={onDraw} disabled={drawDisabled} title={drawTitle}>
          Draw
        </button>
        {isGM && (
          <>
            <button className="btn btn-ghost" onClick={onShuffle} title="Shuffle the draw pile">
              Shuffle
            </button>
            <button
              className="btn btn-ghost"
              onClick={onReset}
              title="Return discards and outstanding hands to the draw pile, then shuffle"
            >
              Reset
            </button>
            {confirmingDelete ? (
              <>
                <button className="btn btn-danger" onClick={onDelete}>
                  Confirm delete
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function NewStackForm({
  onCreate,
}: {
  onCreate: (name: string, includeJokers: boolean, deckSizeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Inspiration Deck");
  const [includeJokers, setIncludeJokers] = useState(false);
  const [deckSizeId, setDeckSizeId] = useState(DEFAULT_DECK_PRESET_ID);

  if (!open) {
    return (
      <button className="btn btn-ghost new-stack-toggle" onClick={() => setOpen(true)}>
        + New deck
      </button>
    );
  }

  function submit() {
    onCreate(name, includeJokers, deckSizeId);
    setName("Inspiration Deck");
    setIncludeJokers(false);
    setDeckSizeId(DEFAULT_DECK_PRESET_ID);
    setOpen(false);
  }

  const preset = deckPreset(deckSizeId);
  const totalCards = preset.ranks.length * 4 * preset.deckCount + (includeJokers ? 2 * preset.deckCount : 0);

  return (
    <form
      className="new-stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="text-input"
        aria-label="Deck name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Deck name"
        autoFocus
      />
      <label className="select-label">
        Deck size
        <select
          className="select-input"
          value={deckSizeId}
          onChange={(e) => setDeckSizeId(e.target.value)}
        >
          {DECK_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={includeJokers}
          onChange={(e) => setIncludeJokers(e.target.checked)}
        />
        Include jokers
      </label>
      <p className="new-stack-total">{totalCards} cards total</p>
      <div className="new-stack-form-actions">
        <button type="submit" className="btn btn-primary">
          Create
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
