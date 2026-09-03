import { useState } from "react";
import type { Stack } from "../deck/state";

interface StackListProps {
  stacks: Stack[];
  isGM: boolean;
  onDraw: (stackId: string) => void;
  onShuffle: (stackId: string) => void;
  onReset: (stackId: string) => void;
  onRename: (stackId: string, name: string) => void;
  onDelete: (stackId: string) => void;
  onCreate: (name: string, includeJokers: boolean) => void;
}

export function StackList({
  stacks,
  isGM,
  onDraw,
  onShuffle,
  onReset,
  onRename,
  onDelete,
  onCreate,
}: StackListProps) {
  return (
    <section className="panel">
      <h2 className="panel-title">Decks</h2>

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
  onDraw: () => void;
  onShuffle: () => void;
  onReset: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function StackRow({ stack, isGM, onDraw, onShuffle, onReset, onRename, onDelete }: StackRowProps) {
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
        ) : (
          <span
            className={"stack-name" + (isGM ? " stack-name--editable" : "")}
            onClick={() => isGM && setEditing(true)}
            title={isGM ? "Click to rename" : undefined}
          >
            {stack.name}
          </span>
        )}
        <span className="stack-counts">
          {stack.drawPile.length} left · {stack.discardPile.length} discarded
        </span>
      </div>

      <div className="stack-row-actions">
        <button className="btn btn-primary" onClick={onDraw} disabled={stack.drawPile.length === 0}>
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
              <button className="btn btn-ghost" onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function NewStackForm({ onCreate }: { onCreate: (name: string, includeJokers: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Inspiration Deck");
  const [includeJokers, setIncludeJokers] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-ghost new-stack-toggle" onClick={() => setOpen(true)}>
        + New deck
      </button>
    );
  }

  function submit() {
    onCreate(name, includeJokers);
    setName("Inspiration Deck");
    setIncludeJokers(false);
    setOpen(false);
  }

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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Deck name"
        autoFocus
      />
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={includeJokers}
          onChange={(e) => setIncludeJokers(e.target.checked)}
        />
        Include jokers
      </label>
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
