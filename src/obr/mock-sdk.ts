/**
 * A stand-in for `@owlbear-rodeo/sdk` so the popover can be run and driven
 * in a plain browser tab, outside Owlbear Rodeo — for local development
 * of the hand-tray gestures and for automated (Playwright) checks. Only
 * used when the dev server is started with `VITE_MOCK_OBR=1` (see
 * vite.config.ts); production builds never include it.
 *
 * Covers exactly the slice of the SDK useOwlbear.ts calls. Room metadata
 * is shared between tabs of the same origin through a BroadcastChannel
 * and persisted in localStorage, so opening `/?player=Alice` and
 * `/?player=Bob&role=GM` in two tabs behaves like two people in a room:
 * every setMetadata merges top-level keys (as OBR's does) and echoes back
 * to *every* tab, including the writer, asynchronously.
 */

import type { Metadata, Player, Theme } from "@owlbear-rodeo/sdk";

const params = new URLSearchParams(window.location.search);
const name = params.get("player") ?? "Player";
const role: "GM" | "PLAYER" = params.get("role") === "GM" ? "GM" : "PLAYER";
const id = params.get("id") ?? `mock-${name.toLowerCase()}`;
const color = params.get("color") ?? (role === "GM" ? "#e0a020" : "#3c8dd0");
const mode: "DARK" | "LIGHT" = params.get("theme") === "light" ? "LIGHT" : "DARK";

const STORAGE_KEY = "cardic-mock-room-metadata";
const channel = new BroadcastChannel("cardic-mock-room");

function load(): Metadata {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

let metadata: Metadata = load();
const metadataListeners = new Set<(m: Metadata) => void>();
const partyListeners = new Set<(p: Player[]) => void>();

const self: Player = {
  id,
  connectionId: id,
  role,
  name,
  color,
  syncView: false,
  metadata: {},
};
const others = new Map<string, Player>();

function emitParty() {
  const list = [...others.values()];
  for (const l of partyListeners) l(list);
}

channel.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "metadata") {
    metadata = msg.metadata;
    for (const l of metadataListeners) l(metadata);
  } else if (msg.type === "hello") {
    others.set(msg.player.id, msg.player);
    channel.postMessage({ type: "here", player: self });
    emitParty();
  } else if (msg.type === "here") {
    others.set(msg.player.id, msg.player);
    emitParty();
  } else if (msg.type === "bye") {
    others.delete(msg.playerId);
    emitParty();
  }
};
channel.postMessage({ type: "hello", player: self });
window.addEventListener("pagehide", () => channel.postMessage({ type: "bye", playerId: id }));

const theme: Theme = {
  mode,
  primary: { light: "#a08de0", main: "#8c7ae6", dark: "#5f4bb6", contrastText: "#fff" },
  secondary: { light: "#f0c060", main: "#e0a020", dark: "#a07010", contrastText: "#000" },
  background:
    mode === "DARK" ? { default: "#222639", paper: "#2f3350" } : { default: "#f0f0f5", paper: "#ffffff" },
  text:
    mode === "DARK"
      ? { primary: "#ffffff", secondary: "rgba(255,255,255,0.7)", disabled: "rgba(255,255,255,0.4)" }
      : { primary: "#111111", secondary: "rgba(0,0,0,0.6)", disabled: "rgba(0,0,0,0.35)" },
};

const OBR = {
  onReady(cb: () => void) {
    setTimeout(cb, 0);
  },
  player: {
    id,
    getRole: () => Promise.resolve(role),
    getName: () => Promise.resolve(name),
    getColor: () => Promise.resolve(color),
    onChange: (_cb: (p: Player) => void) => () => {},
  },
  party: {
    getPlayers: () => Promise.resolve([...others.values()]),
    onChange: (cb: (p: Player[]) => void) => {
      partyListeners.add(cb);
      return () => partyListeners.delete(cb);
    },
  },
  theme: {
    getTheme: () => Promise.resolve(theme),
    onChange: (_cb: (t: Theme) => void) => () => {},
  },
  room: {
    getMetadata: () => Promise.resolve(metadata),
    setMetadata: (update: Partial<Metadata>) => {
      const next: Metadata = { ...metadata };
      for (const [k, v] of Object.entries(update)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      metadata = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      channel.postMessage({ type: "metadata", metadata: next });
      // Echo to the writer too, on a later tick, like the real round trip.
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          for (const l of metadataListeners) l(metadata);
          resolve();
        }, 20),
      );
    },
    onMetadataChange: (cb: (m: Metadata) => void) => {
      metadataListeners.add(cb);
      return () => metadataListeners.delete(cb);
    },
  },
};

export default OBR;
