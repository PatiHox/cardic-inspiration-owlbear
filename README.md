# Inspiration Cards

An [Owlbear Rodeo](https://www.owlbear.rodeo/) extension for tracking
card-draw "inspiration" decks at the table: when a player gets inspiration,
they draw a card from a shared deck; later they can flip it to reveal its
value and use it as a bonus on a roll. There's no automatic roll integration
— the extension just tracks whose hand has what.

## How it works

- The DM creates one or more standard 52-card decks (with an optional pair
  of jokers) from the extension popover.
- Any player can draw a card from a deck into their own hand. It shows up
  face-down for everyone.
- **A card's value is secret from everyone — including the DM — until the
  owning player flips it.** Before that, all anyone sees is a face-down
  count per player. There's no server enforcing this; it's just what the UI
  shows, which is enough for a table of friends but not a hard guarantee
  (nothing stops someone from reading the room metadata directly via
  devtools).
- Once flipped, the card's rank/suit is visible to everyone. After it's been
  used, the player discards it, returning it to that deck's discard pile.
- DM-only controls: create/rename/delete a deck, shuffle its draw pile, and
  "reset" a deck (shuffles the discard pile and any outstanding hands back
  into the draw pile).

All state lives in the Owlbear Rodeo room's metadata, which OBR syncs live
to every connected client — that's what makes the popover "shared": every
player who opens it sees the same live state.

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

## Deploying

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the site and publishes it to GitHub Pages. Once Pages is
enabled for the repo (Settings → Pages → Source: GitHub Actions), the
extension's manifest will be available at:

```
https://<your-github-username>.github.io/owlbear-ext/manifest.json
```

Use that URL as the install link instead of the localhost one. If you
rename the repository, update the `base` path in
[`vite.config.ts`](vite.config.ts) to match.

## Project layout

```
public/manifest.json   Extension manifest (action popover config)
src/deck/cards.ts       Card ids, labels, shuffling
src/deck/state.ts       Deck/hand state shape + pure state-transition functions
src/obr/useOwlbear.ts   Hook wrapping the OBR SDK: ready state, player/role,
                         party roster, theme, and synced deck state
src/components/         UI: stack list, DM controls, per-player hands
```
