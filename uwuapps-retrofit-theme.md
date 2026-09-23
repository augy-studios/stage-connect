# Retrofit prompt: theme switcher for an existing PWA

Drop `uwuapps-theme.md` into the repo (`uwuapps-theme.md`) first, then paste
everything below into Claude Code from the project root.

---

Read `uwuapps-theme.md` in full before touching any file. It is the canonical
spec for the theme system used across all my PWAs, and it is not
negotiable. This project already exists and does not use it yet. Your job
is to retrofit it without changing any app behaviour.

## Step 1: audit, do not edit yet

Report back before writing anything:

1. Every stylesheet, and whether it already defines CSS custom properties
   or a `:root` block.
2. Every hardcoded colour value in CSS and inline styles: hex, `rgb()`,
   `hsl()`, and named colours. Group them by what they are used for
   (page background, card background, borders, primary text, secondary
   text, links and accents, success, warning, error). Propose a mapping
   from each to a token in `uwuapps-theme.md`.
3. Any existing theme, dark mode, or colour switching code, including
   `prefers-color-scheme` media queries, `localStorage` theme keys, and
   `classList` toggles like `.dark`.
4. Every gradient, orb, blob, radial background, box-shadow glow, and
   `backdrop-filter` currently in use.
5. Every emoji character used as an icon, in HTML, JS template strings,
   and CSS `content`.
6. Whether the project uses ES modules or plain scripts, and where the
   header or topbar lives.
7. Whether `js/icons.js` and `js/ui.js` exist, and whether they already
   have `icon()`, `hydrateIcons()`, `openModal()`, `closeModal()`.

Then stop and show me the audit and your proposed token mapping. Wait for
my go-ahead.

## Step 2: implement (only after I approve)

Follow `uwuapps-theme.md` exactly. Specifics for this retrofit:

- Set `APP_KEY` in `js/theme.js` to this project's short name, so the
  `localStorage` keys are namespaced per app.
- If the project has no `js/icons.js` or `js/ui.js`, create them with the
  helpers from the spec. If they exist, add only what is missing and keep
  the existing exports intact.
- Replace every hardcoded colour with the mapped token. If a colour has no
  clean mapping, do not invent a new token: tell me and leave it alone.
- Delete every gradient, orb, and blob. Replace with a flat tint or a
  `.glass` card.
- Replace every emoji icon with an inline SVG in `js/icons.js` referenced
  via `data-icon`. Match the existing icon conventions in the spec. If a
  needed icon does not exist yet, add it.
- Remove any existing dark mode implementation, including
  `prefers-color-scheme` colour overrides. Light is the default, and OS
  preference is ignored on first load. Keep the
  `prefers-reduced-motion: reduce` rule, that one stays.
- Migrate any old `localStorage` theme value to the new keys if a sensible
  mapping exists, otherwise let it fall back to the default.
- Add the theme button to the existing topbar or header. Do not restructure
  the header beyond adding the button.
- Add the theme modal at the end of `<body>`, starting with `.hidden`.
- If the project has multiple HTML pages, add the button, the modal, and
  the theme init to every one of them, and keep the markup identical
  across pages.
- Add the optional pre-paint script from section 7 of the spec, since this
  is a retrofit and the existing script loading order is unknown.

## Constraints

- Do not change app logic, data flow, API calls, service worker caching
  behaviour, or the DOM structure of anything that is not theme related.
- Do not add dependencies, build steps, CSS frameworks, or icon fonts.
- Do not rename existing classes or IDs unless they collide with the spec.
  If something collides, tell me before renaming.
- No em dashes anywhere, including code comments and commit messages.
- Keep code comments short. No decorative comment banners beyond the
  section headers already used in the spec.
- If the service worker precaches a file list, add any new files to it and
  bump the cache version.

## Step 3: verify

Walk through the acceptance checklist at the bottom of `uwuapps-theme.md` and
report the result of each item. Specifically confirm:

- All 14 brand and mode combinations render with readable text.
- A fresh profile with the OS in dark mode still loads light.
- The choice persists across reload and across every page in the app.
- Grep the codebase and confirm zero remaining hardcoded colour values in
  component CSS, other than any fixed-meaning accent you flagged and I
  approved.

Then give me a short summary of what changed, file by file, and list
anything you deliberately left alone.