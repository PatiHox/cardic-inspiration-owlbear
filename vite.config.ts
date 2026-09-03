import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves project sites from /<repo-name>/, so the production
  // build needs that base path. Keep the dev server at "/" so `npm run dev`
  // still matches the manifest's popover url ("/") unmodified.
  // If you rename the GitHub repo, update this to match.
  base: command === "build" ? "/owlbear-ext/" : "/",
  server: {
    // Owlbear Rodeo needs to be able to load this dev server in an iframe.
    // Vite disables CORS by default since v6.0.9, so it must be re-enabled
    // for the OBR origin explicitly.
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
}));
