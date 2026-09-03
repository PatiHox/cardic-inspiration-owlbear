---
name: owlbear-extension-theming
description: How to theme an Owlbear Rodeo extension's popover/action UI to match OBR's native look — dark mode, the "Overlay Effect" (Glass/Transparent) setting, translucent backgrounds, and backdrop-filter blur. Use this whenever touching this extension's CSS/theme code, especially anything involving `color-scheme`, dark mode, transparency, opacity, "glass" effects, matching OBR's native panels, or when a translucent/blurred surface looks wrong, inconsistent, or renders as solid black. Also consult before writing any local test for iframe transparency or backdrop-filter, since the naive test gives a false negative.
---

# Owlbear Rodeo extension theming: glass effects and dark mode

An OBR extension's action popover is a normal web page loaded in an iframe. Nothing about "looking native" is automatic — OBR gives you a `theme` object with colors, nothing else. Matching the platform's own translucent, blurred "Glass" look is achievable entirely from your own CSS, but two non-obvious browser behaviors will silently sabotage it if you don't know about them going in. This skill exists because both cost a full debugging session to track down.

## The trap: don't declare `color-scheme` globally

Never write this in a global stylesheet, before the real OBR theme is known:

```css
:root {
  color-scheme: light dark; /* or any fixed value, e.g. just "dark" */
}
```

Per the CSS spec, `color-scheme` doesn't just theme native form controls — it also tells the browser which default canvas color to paint wherever nothing else sets a background, based on the *active OS/browser preference*. Declare `light dark` before you have real theme colors to apply, and under a dark preference the browser paints an **opaque dark/black fill** under any element that doesn't have its own explicit background. This is not subtle: a translucent `.app` background with no fallback color renders as solid black in a real OBR room. It's fully reproducible with nothing but that one declaration and a forced dark color-scheme — no OBR, no iframe, no extension code involved (see Verification below).

**The fix:** don't declare `color-scheme` in a stylesheet at all. Set it *inline, per-element, scoped to the root of your app*, computed from the actual `OBR.theme.mode` once it's loaded:

```tsx
style={{ colorScheme: theme.mode === "DARK" ? "dark" : "light", /* ...other vars */ }}
```

This still gets you correctly-styled native controls (checkboxes, scrollbars) once the theme is known, without ever painting an unwanted default before that.

## The false-negative trap when testing transparency

The same `color-scheme` declaration is why a naive local test of "does transparency/blur cross the extension's iframe boundary?" can lie to you. If your test page (or the extension itself) still has `color-scheme: light dark` anywhere, the opaque canvas fill from the trap above masks a working effect completely — you'll see nothing behind your iframe and conclude the browser doesn't support cross-iframe transparency, when actually it does and something else is blocking it. Always strip `color-scheme` out of both the test harness and the page under test before drawing that conclusion.

## OBR's "Overlay Effect" setting isn't exposed to extensions

OBR's own Settings panel has an "Overlay Effect" toggle (Transparent / Glass) that gives native panels a blurred, see-through look. There is no field for this on the SDK's `Theme` object — checked directly against the installed `@owlbear-rodeo/sdk` package's type definitions (current as of this writing: 3.1.0), not just the docs, since the docs can lag behind what's shipped. An extension cannot detect or read this setting. The only option is to unconditionally render your own glass-style surface and hope it reads consistently regardless of what the user picked — you can't adapt to it.

The good news: both plain CSS transparency and `backdrop-filter: blur()` **do** correctly cross an extension's iframe boundary (verified in Chromium by embedding a build behind an iframe over a high-contrast striped pattern and watching it blur through). If your glass effect isn't showing up, the cause is almost certainly the `color-scheme` trap above, not a platform limitation.

## One fixed opacity does not read consistently across themes

A single translucent alpha value looks fine in one theme and nearly invisible in the other. Blending any color into a near-white base barely shifts it perceptually; the identical blend against a dark base reads clearly. If you pick one opacity and call it done, expect "it's way too subtle" feedback specifically about light mode.

Compute **separate opacity values per `theme.mode`**, more transparent in light mode than in dark, as CSS custom properties set alongside your other theme variables:

```tsx
"--obr-glass-shell": theme.mode === "DARK" ? "55%" : "30%",   // little/no text on this layer
"--obr-glass-card":  theme.mode === "DARK" ? "82%" : "70%",   // carries real content
```

```css
background: color-mix(in srgb, var(--obr-bg) var(--obr-glass-shell), transparent);
```

Reality-check any percentages you pick against `github.com/owlbear-rodeo/dice`'s own translucent surface (`src/plugin/PopoverTray.tsx`), which uses roughly 40% opaque in light mode vs. 80% opaque in dark — a real, shipped asymmetry, not a one-off guess.

## Blur isn't optional wherever there's real text

Alpha transparency alone, with no blur, means whatever's directly behind your surface (map art, tokens, a bright image) shows through at full sharpness — which can make text sitting on top of it illegible, especially at the more aggressive opacities needed to look "glassy" rather than "barely tinted." `backdrop-filter: blur()` washes out that high-frequency detail before it reaches your text, which is the actual mechanism real frosted-glass UI relies on for legibility, not the alpha value by itself. Any surface that carries text needs its own `backdrop-filter`, not just a translucent `background`. Always pair the two:

```css
.panel {
  background: color-mix(in srgb, var(--obr-bg-paper) var(--obr-glass-card), transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* Browsers without backdrop-filter support would otherwise show a
   translucent-but-unblurred surface over uncontrolled scene content —
   fall back to fully opaque instead. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .panel {
    background: var(--obr-bg-paper);
  }
}
```

## Reference implementation: owlbear-rodeo/dice

`docs.owlbear.rodeo` doesn't document any of this — none of it is written down anywhere official. When in doubt, check `github.com/owlbear-rodeo/dice`'s actual source (`gh api repos/owlbear-rodeo/dice/contents/<path>` works well for this without needing to clone). Two things worth knowing before you go looking:

- Their main action-popover root (`src/App.tsx`) has **no background of its own at all** — it's layout components sitting directly on a transparent `<body>`. Only individual controls/cards that actually carry content get their own background. Don't wrap your whole UI in one big background layer; keep the shell transparent and let content-bearing pieces opt in individually.
- Their one translucent `rgba()` surface (`PopoverTray.tsx`) is rendered via a `background_url` scene overlay — a different embed mechanism from an `action.popover` toolbar popup. Don't assume a pattern from one embed type automatically applies to the other; confirm which one you're actually looking at.

## Verification: an in-app screenshot is not enough

Testing the extension alone in a plain browser tab will miss both bugs above entirely — they only appear once actually embedded, or under a color-scheme preference you didn't happen to have active locally. Before shipping a theming change:

1. **Isolate the `color-scheme` bug directly**, no OBR needed: a bare HTML page with only `color-scheme: light dark` in its CSS and no background anywhere, screenshotted under both a light and a forced dark OS/browser color-scheme preference. If it ever paints solid black, something in your real CSS still has this problem.
2. **Embed the actual build in an iframe** inside a test harness page with a high-contrast/striped background (not a flat color — you can't see blur against a flat color), and screenshot it. This is what actually reveals whether transparency/blur reach through, and it's the only way to see the shell's translucency against something other than nothing.
3. **Retest specifically under a forced dark color-scheme preference**, since that's the exact condition that exposes the black-fill bug — a light-preference pass alone will look fine and ship a regression.
4. **Check both light and dark theme values** side by side against the same backdrop, since the opacity-asymmetry issue only shows up when you compare them directly, not when eyeballing one at a time.
5. Treat all of the above as a strong hypothesis, not final proof. Local synthetic tests can have their own confounds (this whole skill exists because one did). Ask for a live check in a real OBR room before considering a theming change confirmed.
