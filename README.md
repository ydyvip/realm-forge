# Realm Forge

A sandbox for designing physics-breaking worlds, the characters who inhabit them, and the wars, journeys, and growth that follow — built entirely in vanilla HTML, CSS, and JavaScript, with no framework and no build dependencies.

中文说明见 [README.zh.md](./README.zh.md)。

## Use it now

`realm-forge.html` is a complete, self-contained build. Double-click it or open it in a browser — nothing to install, nothing to compile. All data is saved to the browser's `localStorage` (key prefix `realmforge:v1:`).

The app defaults to Chinese; click the language toggle in the top-right corner to switch to English at any time. UI chrome and all *newly generated* content (characters, worlds, factions, maps, expeditions) will be created in whichever language is active. Content generated before a language switch keeps the language it was created in — the same way a character's name doesn't retroactively change when you change an app's display language.

## What it does

Eight layers, each feeding the next:

1. **Physics** — eight dials (gravity, time flow, spatial stability, entropy, aether density, anomaly density, causal rigidity, mind-over-matter) define a world's rules and derive an "Abnormality Index."
2. **Geography** — a procedurally generated map of places and routes, where each place locally offsets the world's dials.
3. **Power systems** — four mutually countering frameworks: Magic, Anomaly, Psionics, and Dominion, each with an explicit source, cost, limitation, and failure mode.
4. **Abilities** — generated from 18 unlockable domains × 10 effects × forms, triggers, and costs.
5. **Characters** — 15 origins, a tier-budgeted six-stat system, Big Five personalities, and appearance details that reflect a character's power.
6. **Society** — factions with ideologies and diplomacy that autonomously declare war, make peace, expand, and decline; a relationship web linking characters and factions.
7. **Growth** — characters earn XP, level up with experience-weighted stat gains, evolve their abilities, and accumulate permanent scars and history.
8. **Simulation** — a turn-based combat engine (1v1 duels through 5v5 squads) with Monte Carlo win-rate estimation, plus a persistent expedition mode where parties march the map, trigger encounters, and get pulled into the faction wars reshaping the world over time.

## Source structure (`src/`)

```
src/
├─ logic.js         Pure logic layer: world rules, the four power systems,
│                    ability generation, character generation, the combat
│                    engine (duels/squads), factions & relationships, map
│                    generation, the growth system, and the expedition
│                    engine (marching/encounters/wars/territory). No DOM
│                    dependency — can be required directly in Node for testing.
├─ i18n_strings.js   The Chinese/English dictionary for static UI chrome
│                    (nav, headings, buttons, help text) and the i18n engine
│                    that applies it.
├─ ui.js             UI layer ①: SVG helpers (gauges/radar charts/sigils/
│                    counter triangle/timeline), world and character forge
│                    rendering and interaction, top navigation.
├─ ui2.js            UI layer ②: map editing, faction editing, relationship
│                    graph visualization, duel and squad simulation UI.
├─ ui3.js            UI layer ③: character growth display, and the full
│                    expedition tab (party building, marching, encounter
│                    choices, battle reports, world state, chronicle).
├─ main.js           Entry point — calls init().
├─ body.html          Page skeleton (DOM structure for every tab), with
│                    data-i18n attributes marking translatable text.
└─ style.css         Styling (a drafting-paper aesthetic, light/dark themes).
```

`logic.js` → `i18n_strings.js` → `ui.js` → `ui2.js` → `ui3.js` → `main.js` are concatenated in that order into a single `<script>` tag. They call each other through global functions (function declarations are hoisted across the whole concatenated script), so there's no module system and the file order must not be changed.

## Rebuilding

```bash
python3 build.py
```

Reads the files above and writes `realm-forge.html`. Run it again after editing anything in `src/` region to see the result. (The script writes to `/mnt/user-data/outputs/realm-forge.html` by default — adjust the output path at the bottom of `build.py` if you're running it outside that environment.)

## How translation works internally

Most Chinese/English content lives directly in `logic.js`'s data tables as `{ zh: '...', en: '...' }` pairs (for single values) or `{ zh: [...], en: [...] }` banks of equal length (for random-pick arrays, so the same seed picks the same index in either language — deterministic and balance-neutral). A small set of helpers — `tf()` (translate field), `tb()` (translate bank), and `T(zh, en)` (inline either/or) — resolve these against the current language at render or generation time. Structural/reference data (system names, origin traits, domain names, location types, etc.) is looked up live, so switching language retroactively relabels existing characters and worlds; procedurally generated flavor text (character names, ability names, backstories, chronicle entries) is generated in whichever language was active at creation time and does not retroactively translate, by design.
