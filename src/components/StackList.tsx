import { useState } from "react";
import { DECK_PRESETS, DEFAULT_DECK_PRESET_ID, deckPreset } from "../deck/cards";
import type { Stack } from "../deck/state";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeckCardControl } from "./DeckCardControl";
import { ResetIcon, ShuffleIcon, TrashIcon } from "./icons";

interface StackListProps {
  stacks: Stack[];
  isGM: boolean;
  /** DM-configured cap on cards a single player may hold at once, or null for no limit. */
  maxHandSize: number | null;
  /** How many cards the current viewer is holding right now, across all decks. */
  myHandSize: number;
  /** Click a deck's card: draw it into the clicking player's own hand. */
  onDraw: (stackId: string) => void;
  onShuffle: (stackId: string) => void;
  onReset: (stackId: string) => void;
  onRename: (stackId: string, name: string) => void;
  onDelete: (stackId: string) => void;
  onCreate: (name: string, includeJokers: boolean, deckSizeId: string) => void;
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
}: StackListProps) {
  const atHandLimit = maxHandSize != null && myHandSize >= maxHandSize;
  // Carries the actual limit number when capped, so DeckCardControl can put
  // it in its tooltip without needing maxHandSize as a separate prop.
  const selfAtHandLimit = atHandLimit ? maxHandSize! : false;

  return (
    <section className="panel" aria-labelledby="decks-heading">
      <h2 id="decks-heading" className="panel-title">
        Decks
      </h2>

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
            selfAtHandLimit={selfAtHandLimit}
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

interface StackRowProps {
  stack: Stack;
  isGM: boolean;
  selfAtHandLimit: number | false;
  onDraw: () => void;
  onShuffle: () => void;
  onReset: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function StackRow({
  stack,
  isGM,
  selfAtHandLimit,
  onDraw,
  onShuffle,
  onReset,
  onRename,
  onDelete,
}: StackRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(stack.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function confirmDelete() {
    setConfirmingDelete(false);
    onDelete();
  }

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
        <DeckCardControl
          isGM={isGM}
          stackEmpty={stack.drawPile.length === 0}
          selfAtHandLimit={selfAtHandLimit}
          onDraw={onDraw}
          onDragStartStackId={() => stack.id}
        />
        {isGM && (
          <div className="stack-row-secondary-actions">
            <button
              className="btn btn-ghost btn-icon btn-icon-sm"
              onClick={onShuffle}
              aria-label="Shuffle the draw pile"
              title="Shuffle the draw pile"
            >
              <ShuffleIcon />
            </button>
            <button
              className="btn btn-ghost btn-icon btn-icon-sm"
              onClick={onReset}
              aria-label="Reset this deck"
              title="Return discards and outstanding hands to the draw pile, then shuffle"
            >
              <ResetIcon />
            </button>
            <button
              className="btn btn-danger btn-icon btn-icon-sm"
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete this deck"
              title="Delete this deck"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${stack.name}"?`}
        description="This can't be undone. Any cards from this deck currently in a player's hand are removed too."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
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
