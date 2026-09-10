// Every production dependency we ship (see `dependencies` in package.json,
// plus their own runtime deps) is MIT or BSD-3-Clause — both permissive, but
// both require the copyright notice to travel with the software. Vite's
// minified bundle strips that out, so this script collects each package's
// license text into dist/THIRD-PARTY-LICENSES.txt after the build.
//
// The dependency list itself comes from `npm ls`, not a hardcoded array, so
// it can't silently go stale as deps are added/removed/upgraded.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const nodeModulesDir = path.join(rootDir, "node_modules");
const outPath = path.join(rootDir, "dist", "THIRD-PARTY-LICENSES.txt");

const tree = JSON.parse(
  execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], {
    cwd: rootDir,
    encoding: "utf8",
  }),
);

// Flatten the (possibly nested) dependency tree into a unique set of
// name@version pairs, keyed by name so a dep that appears both top-level and
// nested (e.g. react under react-dom) is only reported once.
const packages = new Map();
function collect(deps) {
  if (!deps) return;
  for (const [name, info] of Object.entries(deps)) {
    if (!packages.has(name)) packages.set(name, info.version);
    collect(info.dependencies);
  }
}
collect(tree.dependencies);

// npm hoists production deps to the top-level node_modules whenever there's
// no version conflict (true for all of ours today), so a flat lookup works;
// fall back to a shallow search under node_modules/*/node_modules for any
// that ever end up nested instead of silently omitting them.
function findPackageDir(name) {
  const flat = path.join(nodeModulesDir, name);
  if (existsSync(path.join(flat, "package.json"))) return flat;
  for (const entry of readdirSync(nodeModulesDir)) {
    const nested = path.join(nodeModulesDir, entry, "node_modules", name);
    if (existsSync(path.join(nested, "package.json"))) return nested;
  }
  return null;
}

function findLicenseFile(dir) {
  const match = readdirSync(dir).find((f) => /^licen[sc]e/i.test(f));
  return match ? readFileSync(path.join(dir, match), "utf8").trim() : null;
}

const sections = [];
const missing = [];

for (const name of [...packages.keys()].sort()) {
  const version = packages.get(name);
  const dir = findPackageDir(name);
  if (!dir) {
    missing.push(`${name}@${version}`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
  const license = pkg.license ?? (pkg.licenses ? JSON.stringify(pkg.licenses) : "UNKNOWN");
  const licenseText = findLicenseFile(dir);

  sections.push(
    [
      "=".repeat(70),
      `${name}@${version} (${license})`,
      "=".repeat(70),
      licenseText ?? "(no LICENSE file included in the package; see the license field above)",
    ].join("\n"),
  );
}

if (missing.length > 0) {
  throw new Error(
    `generate-license-notices: couldn't locate installed package(s) for: ${missing.join(", ")}. ` +
      "Run `npm install` and retry.",
  );
}

const header = [
  "Third-party notices",
  "====================",
  "",
  "This extension is MIT-licensed. It bundles the following third-party",
  "packages, each under its own permissive license reproduced below.",
  "Generated automatically by scripts/generate-license-notices.mjs from the",
  "production dependency tree — do not edit by hand.",
  "",
].join("\n");

writeFileSync(outPath, header + sections.join("\n\n") + "\n");
console.log(`Wrote ${packages.size} package notices to dist/THIRD-PARTY-LICENSES.txt`);
