// public/manifest.json ships with root-relative paths ("/icon.svg", "/"),
// matching Owlbear Rodeo's own examples — OBR's frontend expects these
// fields to resolve directly against the extension's own origin rather than
// resolving them itself as relative URLs (a bare "icon.svg" or "./" throws
// "Failed to construct 'URL': Invalid URL" inside Owlbear Rodeo).
//
// That's correct for local dev, served from the origin root, but wrong once
// deployed to GitHub Pages under REPO_BASE ("/owlbear-ext/"). This script
// runs after `vite build` and rewrites the *built* dist/manifest.json to
// prefix those root-relative paths with REPO_BASE.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { REPO_BASE } from "../site.config.mjs";

const manifestPath = fileURLToPath(new URL("../dist/manifest.json", import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const prefix = REPO_BASE.replace(/\/$/, ""); // "/owlbear-ext"

function rebase(value) {
  if (typeof value === "string" && value.startsWith("/")) {
    return prefix + value;
  }
  return value;
}

manifest.icon = rebase(manifest.icon);
if (manifest.action) {
  manifest.action.icon = rebase(manifest.action.icon);
  manifest.action.popover = rebase(manifest.action.popover);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Rebased dist/manifest.json paths under ${REPO_BASE}`);
