import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { CHANNEL, REPO_BASE } from "./site.config.mjs";

/**
 * `npm run dev:mock` (vite --mode mock) swaps the real SDK for
 * src/obr/mock-sdk.ts so the popover runs in a plain tab — two tabs, two
 * players — without Owlbear Rodeo, for working on the hand-tray gestures
 * and for the automated checks. A mode, not an env var, so nothing here
 * needs Node typings; never applied to a production build.
 */
function mockOwlbearSdk(): Plugin {
  return {
    name: "cardic:mock-owlbear-sdk",
    enforce: "pre",
    resolveId(id) {
      return id === "@owlbear-rodeo/sdk" ? this.resolve("/src/obr/mock-sdk.ts") : null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react(), ...(command === "serve" && mode === "mock" ? [mockOwlbearSdk()] : [])],
  // GitHub Pages serves project sites from /<repo-name>/, so the production
  // build needs that base path. Keep the dev server at "/" so `npm run dev`
  // still matches manifest.json's root-relative icon/popover urls unmodified.
  // public/manifest.json itself always uses root-relative paths (as OBR's own
  // examples do); scripts/rebase-manifest.mjs rewrites the *built* copy under
  // REPO_BASE after `vite build`, since OBR's frontend expects those fields
  // to already be full paths rather than resolving them itself.
  base: command === "build" ? REPO_BASE : "/",
  // The release channel, baked in at build time so the popover can label
  // itself: a dev-channel build shows "(dev)" in its own header, the same
  // suffix its manifest carries, so nobody mistakes which one they're
  // looking at. Comes from SITE_CHANNEL (see site.config.mjs), which the
  // deploy workflow sets — never edited by hand.
  define: {
    __SITE_CHANNEL__: JSON.stringify(CHANNEL),
  },
  server: {
    // Owlbear Rodeo needs to be able to load this dev server in an iframe.
    // Vite disables CORS by default since v6.0.9, so it must be re-enabled
    // for the OBR origin explicitly.
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
}));
