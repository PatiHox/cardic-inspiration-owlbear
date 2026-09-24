# Cardic Inspiration

> **AI use disclosure:** This extension was written entirely by an AI
> coding agent. See [AI_DISCLOSURE.md](AI_DISCLOSURE.md) for details.

An [Owlbear Rodeo](https://www.owlbear.rodeo/) extension for tracking
card-draw "inspiration" decks at the table: when a player gets inspiration,
they draw a card from a shared deck; later they can flip it to reveal its
value and use it as a bonus on a roll. There's no automatic roll integration
— the extension just tracks whose hand has what.

## How it works

- The DM creates one or more standard 52-card decks (with an optional pair
  of jokers) from the extension popover.
- Any player can draw a card from a deck into their own hand. It shows up
  face-down for everyone, in that player's **hand tray** — a space they
  can arrange however they like (see below).
- **A card's value is secret from everyone — including the DM — until the
  owning player flips it.** Before that, all anyone sees is a face-down
  count per player. There's no server enforcing this; it's just what the UI
  shows, which is enough for a table of friends but not a hard guarantee
  (nothing stops someone from reading the room metadata directly via
  devtools).
- Once flipped, the card's rank/suit is visible to everyone, annotated with
  what it's worth:
  - Number cards (2-10) hold their face value.
  - Face cards (J/Q/K) are, per the **Settings** panel's "Face card value"
    toggle, either a flat **+10** each (the default) or their ordinal rank
    (**J=11, Q=12, K=13**).
  - An **ace** is a critical hit where the roll allows one, otherwise the
    same toggle's fallback value (**+10**, or **+14** continuing the
    ordinal sequence) — shown as e.g. "Crit / +10". The extension doesn't
    know what roll it's for, so it can't decide which half applies
    automatically; the player/DM applies whichever is relevant at the table.
  - **Jokers are wild** — no fixed effect, entirely up to the DM.

  Edit `cardBonus`/`cardBonusLabel` in [`src/deck/cards.ts`](src/deck/cards.ts)
  if your table plays a different scale entirely. After a card's been used,
  the player plays it, returning it to that deck's discard pile.
- DM-only controls: create/rename/delete a deck, shuffle its draw pile,
  "reset" a deck (shuffles the discard pile and any outstanding hands back
  into the draw pile), remove a single card from any player's hand, and — via the ⚙ **Settings** popup — cap how many
  cards a single player may hold across all decks at once, and set the
  face-card value scale above.

### Handling your cards

Your own hand is a tray you handle directly — there are no buttons under
the cards. Everything works the same with a mouse, a finger or a pen:

- **Move** a card by dragging it anywhere in your tray.
- **Lift** a card by tapping it. A lifted card hovers above the tray and
  shows a frame: drag an edge handle to stretch it along one axis, a
  corner to stretch both freely (hold Shift to keep its proportions), or
  the knob above it to rotate (Shift snaps to 15°). On a touchscreen, pinch a lifted card to
  scale it and twist to rotate.
- **Flip** a card by double-tapping (double-clicking) it. A single tap
  only lifts it, and a slow second tap does nothing, so an idle click
  can't reveal a card: **a flipped card can never be flipped back**, and
  its value is visible to the whole table from then on.
- **Play** a revealed card by dragging it out of your tray and dropping it
  on its deck's discard pile, which lights up as you approach.
- **Discard without flipping**: a face-down card can be dragged to the
  discard pile the same way. It goes back unseen — nobody, you included,
  ever learns what it was.
- **Long-press or right-click** a card for a menu with Flip / Discard
  without flipping (face-down) or Play (revealed), Bring to front and
  Reset shape.
- **Keyboard**: Tab to a card (that lifts it), Enter flips a face-down one,
  arrow keys move it, `[` and `]` rotate, `+`/`-` resize, Delete plays a
  revealed one or discards a face-down one unseen, Escape puts it down.

Everyone sees your cards where and how you've placed them, mirrored
smaller under your name in their view, and they see them move as you drag
(streamed at a bounded rate so a long drag doesn't flood the room). Only
you can place and shape your own cards — nobody else's tray is editable,
the DM's included. The one exception: the DM can **remove** a card from
any player's hand by dragging it onto its deck's discard pile (a ghost
of the card follows the pointer; the card itself never moves, and letting
go anywhere else just puts the ghost away). Right-click or long-press for
a menu, or focus the card and press Delete, do the same. Removal returns
the card to the discard pile without revealing it and without disturbing
the rest of that player's arrangement.

All state lives in the Owlbear Rodeo room's metadata, which OBR syncs live
to every connected client — that's what makes the popover "shared": every
player who opens it sees the same live state. Nobody's client ever writes
on a timer: the deck state changes only when someone acts, and each action
is re-applied to the room's *current* state right before it's written, so
a client whose view has fallen behind can't write its stale copy back over
other people's changes. Card poses (position, stretch, rotation) are kept
in a separate metadata key per player, so two players rearranging at the
same moment can't overwrite each other, and that traffic never touches the
deck state itself.

## Installing in Owlbear Rodeo

Each player (DM included) who wants to see the extension needs to add it to
their own Owlbear Rodeo profile once:

1. Open [Owlbear Rodeo](https://www.owlbear.rodeo/) and open your room.
2. Bottom left, click **Extras**.
3. Go to the **Extensions** tab.
4. Top right, click **Add Custom Extension**.
5. Paste this link and confirm:

   ```
   https://patihox.github.io/cardic-inspiration-owlbear/manifest.json
   ```

6. The extension's icon now shows up in the room's action toolbar.

## Development

```bash
npm install
npm run dev
```

This starts a Vite dev server at `http://localhost:5173`.

To load the extension in Owlbear Rodeo while developing:

1. In your OBR profile, click **Add Extension** and use
   `http://localhost:5173/manifest.json` as the install link.
2. Enable it when creating (or editing) a room.
3. Open the room — the extension's icon appears in the action toolbar.

Open the same room in a second browser profile (or an incognito window)
signed in as a different player to see live syncing between GM and player
views.

### Running without Owlbear Rodeo

```bash
npm run dev:mock
```

swaps the OBR SDK for [`src/obr/mock-sdk.ts`](src/obr/mock-sdk.ts), so
the popover runs in a plain browser tab. Query parameters pick who you
are: `http://localhost:5173/?player=Alice` and
`http://localhost:5173/?player=DM&role=GM` in two tabs behave like two
people in one room (state is shared between tabs and persisted in
`localStorage`; add `&theme=light` for the light theme). Handy for working
on the hand-tray gestures, or for driving the popover with a browser
automation tool. The mock is never part of a production build.

## Deploying

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the site and publishes it to GitHub Pages. Once Pages is
enabled for the repo (Settings → Pages → Source: GitHub Actions), the
extension's manifest will be available at:

```
https://<your-github-username>.github.io/cardic-inspiration-owlbear/manifest.json
```

Use that URL as the install link instead of the localhost one. If you
rename the repository, update `REPO_ROOT` in
[`site.config.mjs`](site.config.mjs) to match.

### Dev channel

The same Pages site also carries a second, independent build under
`/dev/`, so a work-in-progress branch can be installed in a real Owlbear
Rodeo room — alongside the released extension, as a separate entry named
"Cardic Inspiration (dev)" — without touching what everyone else has
installed:

```
https://<your-github-username>.github.io/cardic-inspiration-owlbear/dev/manifest.json
```

Whatever is on the `dev` branch is what's published there. To put a
branch on the dev channel, push it to `dev`:

```bash
git push --force origin my-feature-branch:dev
```

Every deploy (a push to `main` *or* `dev`) rebuilds both channels from
their own branches — the root from `main`, `/dev/` from `dev` — so
neither can clobber the other, and if there's no `dev` branch only the
root is published. The dev build is a normal `npm run build` with
`SITE_CHANNEL=dev`, which changes the base path and adds the "(dev)"
suffix to the manifest; both channels share the same room-metadata key,
so switching a room from one to the other shows the same decks and hands.

One-time setup: GitHub's auto-created `github-pages` environment only
lets the default branch deploy, so a push to `dev` is rejected until you
add `dev` to its allowed deployment branches (repo **Settings →
Environments → github-pages → Deployment branches and tags**).

### Why `manifest.json` needs a rebase step

[`public/manifest.json`](public/manifest.json) uses root-relative paths
(`/icon.svg`, popover `/`), matching Owlbear Rodeo's own tutorial examples —
that's required because OBR's frontend expects those fields to already
resolve against the extension's own origin rather than resolving them
itself; a bare relative path like `"icon.svg"` or `"./"` throws
`Failed to construct 'URL': Invalid URL` inside Owlbear Rodeo. That's
correct for local dev (served from the origin root), but wrong once
deployed under GitHub Pages' `/cardic-inspiration-owlbear/` subpath. `npm run build` runs
[`scripts/rebase-manifest.mjs`](scripts/rebase-manifest.mjs) after `vite
build` to prefix those paths with `REPO_BASE` in the built
`dist/manifest.json` only — the source file in `public/` is untouched.

## Project layout

```
public/manifest.json          Extension manifest (root-relative paths, for local dev)
site.config.mjs                REPO_BASE — the GitHub Pages repo path, single source of truth
scripts/rebase-manifest.mjs    Post-build step: rewrites dist/manifest.json under REPO_BASE
src/deck/cards.ts              Card ids, labels, shuffling
src/deck/state.ts              Deck/hand state shape + pure state-transition functions
src/deck/pose.ts               Card poses (position/stretch/rotation) + transform-frame geometry
src/obr/useOwlbear.ts          Hook wrapping the OBR SDK: ready state, player/role,
                                party roster, theme, synced deck state and poses
src/obr/mock-sdk.ts            Stand-in SDK for `npm run dev:mock` (never built)
src/components/                UI: stack list, DM controls, per-player hands
```

## License

[MIT](LICENSE)
