# Realm Forge (万象工坊) · Source Code

A pure-frontend (HTML + CSS + vanilla JS, no framework, no build dependencies) sandbox for worlds / characters / combat simulation / expeditions.

## Getting Started

`realm-forge.html` (or its identical copy `index.html`) is the pre-built single-file version: open it directly in any browser — double-click works. No build step, no server, no npm install required; it's just static files. All data persists in the browser's `localStorage` under the key prefix `realmforge:v1:`.

**Languages**: the app is bilingual. Use the `中 / EN` control at the top of the page to switch. Chinese (中文) is the default; English is fully supported. Your choice is persisted in `localStorage` under `realmforge:v1:lang`. Switching languages reloads the page and re-renders all content in the chosen language; all world / character / roster data stays in `localStorage` with its original Chinese keys and is translated at render time.

## Source Structure (`src/` directory)

```
src/
├─ i18n.js       i18n core (Chinese/English): t() translation function,
│                setLang/getLang, language-switcher binding, and
│                persistence of the choice via localStorage.
├─ lang-body.js  English dictionary fragment (body/static page strings).
├─ lang-logic.js English dictionary fragment (domain logic strings).
├─ lang-ui.js    English dictionary fragment (UI layer ① strings).
├─ lang-ui2.js   English dictionary fragment (UI layer ② strings).
├─ lang-ui3.js   English dictionary fragment (UI layer ③ strings).
├─ logic.js      Pure logic layer: world laws, the four systems, ability
│                generation, character generation, the simulation engine
│                (duels/squads), factions and relations, map generation,
│                growth system, expeditions (march/encounter/war/territory)
│                — no DOM dependencies, can be required directly in Node.
├─ ui.js         UI layer ①: SVG drawing helpers (gauges/radar charts/
│                sigils/counter triangles/timelines), world and character
│                workshop rendering and interaction, top navigation.
├─ ui2.js        UI layer ②: map editing, faction editing, relation-network
│                visualization, duel and squad simulation UI.
├─ ui3.js        UI layer ③: character growth display, the full expedition
│                tab (squad formation, marching, encounter options, battle
│                reports, faction territory, chronicles).
├─ main.js       Entry point; calls init().
├─ body.html     Page skeleton (DOM structure for each tab).
└─ style.css     Styles (blueprint look, light and dark themes).
```

### How the i18n works

- Chinese is the source language and doubles as the translation key: `t(s, ...args)` looks the string up in the English dictionary (`window.__EN`, filled by the `lang-*.js` fragments) when English mode is active, and falls back to the original Chinese string when no entry exists — so untranslated strings degrade gracefully instead of breaking.
- `{0}` `{1}` placeholders are substituted *after* the dictionary lookup, so the two languages may use different word orders.
- Static text (document title, all `[data-i18n]` elements, placeholders, titles, aria-labels) is applied by `applyStaticI18n()`; dynamic content is translated at render time via `t()`.
- The switcher persists to `localStorage` (`realmforge:v1:lang`) and reloads the page so all dynamic content is rebuilt in the new language.

### File concatenation

The files are concatenated in a fixed order into a single `<script>` tag: `i18n.js` → `lang-*.js` → `logic.js` → `ui.js` → `ui2.js` → `ui3.js` → `main.js`. They call each other through global functions (`function` declarations are hoisted), there is no module system, so the file order must not be changed.

## Rebuilding

```bash
python3 build.py
```

The script reads the source files in `src/` and overwrites **both** `realm-forge.html` and `index.html`. After editing any file under `src/`, re-run this command to see the change.

## Architecture Overview (matches the "System Overview" on the page)

1. **Laws layer** — eight knobs (gravity / time / space / entropy / psionics / anomaly / causality / will) define the world.
2. **Space layer** — the map is made of locations + routes; each location applies a local offset on top of the world knobs.
3. **Systems layer** — four ability logics (magic / anomaly / superpowers / sovereignty), each countering the others.
4. **Abilities layer** — ability = domain × effect × form × trigger × cost × limit.
5. **Characters layer** — origin, six stats, five personality traits, appearance.
6. **Society layer** — factions, faction relations, character relations; factions declare war, make peace, expand, and decline on their own.
7. **Growth layer** — experience, promotion, ability evolution, imprints, and personal history.
8. **Simulation layer** — a turn-based combat engine powering duels, squad battles, and expedition encounters.
