import { useEffect, useState, type CSSProperties } from "react";
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
  setFaceCardScale,
  setMaxHandSize,
  shuffleStack,
} from "./deck/state";
import { StackList } from "./components/StackList";
import { HandsBoard } from "./components/HandsBoard";
import { SettingsModal } from "./components/SettingsModal";
import { GearIcon } from "./components/icons";
import "./App.css";

function themeVars(theme: Theme | null): CSSProperties {
  if (!theme) return {};
  return {
    // Scoped to this element rather than declared globally in index.css: a
    // blanket `color-scheme: light dark` before the real theme is known
    // makes the browser paint an opaque default canvas fill wherever
    // nothing else is set, which both defeats a translucent background and
    // renders as solid black under a dark preference (confirmed live).
    // Setting it here, per the actual theme, keeps native controls
    // (checkboxes) matching without that risk.
    colorScheme: theme.mode === "DARK" ? "dark" : "light",
    "--obr-bg": theme.background.default,
    "--obr-bg-paper": theme.background.paper,
    "--obr-text": theme.text.primary,
    "--obr-text-secondary": theme.text.secondary,
    "--obr-primary": theme.primary.main,
    "--obr-primary-contrast": theme.primary.contrastText,
    "--obr-border": theme.mode === "DARK" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    // Glass opacity, asymmetric by theme like owlbear-rodeo/dice's own
    // translucent surface does (their card: 40% opaque in light, 80% in
    // dark) — a uniform percentage looked fine in dark mode but washed out
    // to nearly invisible in light mode, since blending anything into a
    // near-white base barely shifts it. --obr-glass-shell is the mostly
    // empty .app background (no text sits on it directly); --obr-glass-card
    // is the .panel/.app-header surfaces, kept more opaque since they carry
    // the actual data and rely on blur, not just alpha, to stay legible.
    "--obr-glass-shell": theme.mode === "DARK" ? "55%" : "30%",
    "--obr-glass-card": theme.mode === "DARK" ? "82%" : "70%",
    // The Settings dialog is a focused reading surface, not ambient
    // background like .app/.panel — someone opens it specifically to read
    // and change values, so it should prioritize legibility over matching
    // the scene through it. Reported as "really hard to look at" at
    // --obr-glass-card's level; re-checking the reference screenshot, its
    // dialog is close to opaque too (the glow border carries the "glass"
    // character, not visible scene bleed-through). Its own, much higher
    // floor, not shared with the ambient panels.
    "--obr-glass-modal": theme.mode === "DARK" ? "96%" : "95%",
  } as CSSProperties;
}

export default function App() {
  const { ready, self, theme, deckState, updateState } = useOwlbear();
  const isGM = ready && self?.role === "GM";
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <h1>Cardic Inspiration</h1>
          <p className="app-subtitle">{isGM ? "DM view" : "Player view"}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon app-settings-toggle"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings"
        >
          <GearIcon />
        </button>
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
      />

      <HandsBoard
        drawnCards={deckState.drawnCards}
        selfId={self.id}
        maxHandSize={deckState.maxHandSize}
        faceCardScale={deckState.faceCardScale}
        onFlip={(drawnCardId) => updateState((s) => flipCard(s, drawnCardId))}
        onDiscard={(drawnCardId) => updateState((s) => discardCard(s, drawnCardId))}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isGM={isGM}
        maxHandSize={deckState.maxHandSize}
        onSetMaxHandSize={(max) => updateState((s) => setMaxHandSize(s, max))}
        faceCardScale={deckState.faceCardScale}
        onSetFaceCardScale={(scale) => updateState((s) => setFaceCardScale(s, scale))}
      />
    </div>
  );
}
