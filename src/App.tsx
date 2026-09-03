import { useEffect, type CSSProperties } from "react";
import type { Theme } from "@owlbear-rodeo/sdk";
import { useOwlbear } from "./obr/useOwlbear";
import {
  createStack,
  deleteStack,
  discardCard,
  drawCard,
  ensureDefaultStack,
  flipCard,
  handSize,
  renameStack,
  resetStack,
  setMaxHandSize,
  shuffleStack,
} from "./deck/state";
import { StackList } from "./components/StackList";
import { HandsBoard } from "./components/HandsBoard";
import "./App.css";

function themeVars(theme: Theme | null): CSSProperties {
  if (!theme) return {};
  return {
    "--obr-bg": theme.background.default,
    "--obr-bg-paper": theme.background.paper,
    "--obr-text": theme.text.primary,
    "--obr-text-secondary": theme.text.secondary,
    "--obr-primary": theme.primary.main,
    "--obr-primary-contrast": theme.primary.contrastText,
    "--obr-border": theme.mode === "DARK" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
  } as CSSProperties;
}

export default function App() {
  const { ready, self, theme, deckState, updateState } = useOwlbear();
  const isGM = ready && self?.role === "GM";

  // One-time setup: give a fresh room a standard deck to start with, so
  // players aren't staring at an empty list before the DM builds one. Only
  // the GM does this, and only until `initialized` flips true.
  useEffect(() => {
    if (isGM && !deckState.initialized) {
      updateState((s) => ensureDefaultStack(s));
    }
  }, [isGM, deckState.initialized, updateState]);

  if (!ready || !self) {
    return (
      <div className="app app--loading" style={themeVars(theme)} role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  return (
    <div className="app" style={themeVars(theme)}>
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="app-icon" />
        <div>
          <h1>Inspiration Cards</h1>
          <p className="app-subtitle">{isGM ? "DM view" : "Player view"}</p>
        </div>
      </header>

      <StackList
        stacks={deckState.stacks}
        isGM={isGM}
        maxHandSize={deckState.maxHandSize}
        myHandSize={handSize(deckState, self.id)}
        onDraw={(stackId) => updateState((s) => drawCard(s, stackId, self))}
        onShuffle={(stackId) => updateState((s) => shuffleStack(s, stackId))}
        onReset={(stackId) => updateState((s) => resetStack(s, stackId))}
        onRename={(stackId, name) => updateState((s) => renameStack(s, stackId, name))}
        onDelete={(stackId) => updateState((s) => deleteStack(s, stackId))}
        onCreate={(name, includeJokers, deckSizeId) =>
          updateState((s) => createStack(s, name, includeJokers, deckSizeId))
        }
        onSetMaxHandSize={(max) => updateState((s) => setMaxHandSize(s, max))}
      />

      <HandsBoard
        drawnCards={deckState.drawnCards}
        selfId={self.id}
        maxHandSize={deckState.maxHandSize}
        onFlip={(drawnCardId) => updateState((s) => flipCard(s, drawnCardId))}
        onDiscard={(drawnCardId) => updateState((s) => discardCard(s, drawnCardId))}
      />
    </div>
  );
}
