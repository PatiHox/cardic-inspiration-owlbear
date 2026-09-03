import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { REPO_BASE } from "./site.config.mjs";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves project sites from /<repo-name>/, so the production
  // build needs that base path. Keep the dev server at "/" so `npm run dev`
  // still matches manifest.json's root-relative icon/popover urls unmodified.
  // public/manifest.json itself always uses root-relative paths (as OBR's own
  // examples do); scripts/rebase-manifest.mjs rewrites the *built* copy under
  // REPO_BASE after `vite build`, since OBR's frontend expects those fields
  // to already be full paths rather than resolving them itself.
  base: command === "build" ? REPO_BASE : "/",
  server: {
    // Owlbear Rodeo needs to be able to load this dev server in an iframe.
    // Vite disables CORS by default since v6.0.9, so it must be re-enabled
    // for the OBR origin explicitly.
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
}));
