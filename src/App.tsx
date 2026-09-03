import type { CSSProperties } from "react";
import type { Theme } from "@owlbear-rodeo/sdk";
import { useOwlbear } from "./obr/useOwlbear";
import {
  createStack,
  deleteStack,
  discardCard,
  drawCard,
  flipCard,
  renameStack,
  resetStack,
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

  if (!ready || !self) {
    return (
      <div className="app app--loading" style={themeVars(theme)}>
        Loading…
      </div>
    );
  }

  const isGM = self.role === "GM";

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
        onDraw={(stackId) => updateState((s) => drawCard(s, stackId, self))}
        onShuffle={(stackId) => updateState((s) => shuffleStack(s, stackId))}
        onReset={(stackId) => updateState((s) => resetStack(s, stackId))}
        onRename={(stackId, name) => updateState((s) => renameStack(s, stackId, name))}
        onDelete={(stackId) => updateState((s) => deleteStack(s, stackId))}
        onCreate={(name, includeJokers) =>
          updateState((s) => createStack(s, name, includeJokers))
        }
      />

      <HandsBoard
        drawnCards={deckState.drawnCards}
        selfId={self.id}
        onFlip={(drawnCardId) => updateState((s) => flipCard(s, drawnCardId))}
        onDiscard={(drawnCardId) => updateState((s) => discardCard(s, drawnCardId))}
      />
    </div>
  );
}
