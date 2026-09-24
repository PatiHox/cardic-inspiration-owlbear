// Single source of truth for the GitHub Pages base path. Both
// vite.config.ts (asset/script URL rewriting) and
// scripts/rebase-manifest.mjs (manifest.json's icon/popover URLs) need
// this to match. If you rename the GitHub repo, update REPO_ROOT.
export const REPO_ROOT = "/cardic-inspiration-owlbear/";

// Which release channel this build is for. The deploy workflow publishes
// `main` to the site root ("prod") and the `dev` branch to a `dev/`
// subfolder, so a work-in-progress build can be installed in a real
// Owlbear Rodeo room — side by side with the released one, under its own
// manifest URL — without touching what everyone else has installed.
//   SITE_CHANNEL=dev npm run build
export const CHANNEL = process.env.SITE_CHANNEL === "dev" ? "dev" : "prod";

export const REPO_BASE = CHANNEL === "dev" ? `${REPO_ROOT}dev/` : REPO_ROOT;
