# automatonSim
Interactive DFA/NFA/Grammar simulator for the browser, focused on learning Automata Theory. Build automata visually, convert between models, run words step‑by‑step, and export/import your work.

## Quick Start

- Serve the repository over HTTP (ES Modules require it):
  - `python3 -m http.server 8000` then open `http://localhost:8000/index.html`
  - or `npx serve .`
- Open `index.html`. The app is a single page with three tabs at the top:
  - AFD — DFA editing/simulation and DFA operations
  - AFN — NFA/ε‑NFA editing with conversions (and “convert & open” to DFA)
  - GR — Build automata from Regular Grammars or Regex; export AF → Grammar

## Features

- Visual editor: add/move states, toggle initial/final, connect with symbols.
- Simulation: run a word or step through it. Highlights current/accepted/rejected states.
- Conversions and operations:
  - ε‑NFA → NFA, NFA → DFA (subset construction), DFA → Regex (state elimination)
  - Union, Intersection, Difference, Equivalence Check (via DFA product)
  - Complement, Prefix/Suffix Closure, “Complete DFA” (adds trap state)
- Build from Regular Grammar and from Regex (Thompson). Export Grammar from AF.
- Canvas UX: multi‑selection (Shift), box select, arrow nudge, inline edge‑label edit (double‑click), add multiple symbols at once (comma‑separated), Delete to remove states/edges.
- Layout presets: Compact, Balanced, Spread (auto‑layout). Snap/Align/Distribute are intentionally not present.
- Export PNG of the canvas. Example library to load sample automata.
- “Convert & open” between tabs preserves the current automaton via localStorage.

## Architecture (ES Modules)

- `index.html` — Single page with tabbed templates for AFD/AFN/GR.
- `js/main.js` — App bootstrap: injects the active template based on the URL hash (`#afd`, `#afn`, `#gr`), sets the storage key, wires modules, and performs the first render.
- `js/modules/state.js` — Central state (`A`), localStorage persistence (`snapshot/saveLS/loadLS/restoreFromObject`), shared helpers (`id`, `keyTS`, `clamp`), and `runHighlight`.
- `js/modules/ui.js` — Rendering (SVG), canvas interactions, safe DOM updates, toolbar handlers, δ‑table, layout presets, PNG export, examples menu.
- `js/modules/algorithms.js` — Core algorithms: ε‑closure, AFNλ→AFN, AFN→AFD, DFA→Regex, DFA operations (product, complement, closures), equivalence.
- `js/modules/run.js` — Word execution (Run / Step‑by‑Step) reusing ε‑closure.
- `js/modules/regex.js` — Thompson construction (Regex → NFAλ).
- `js/modules/grammar.js` — Build from Regular Grammar, export AF → Grammar, and “generate DFA & open”.
- `js/modules/algoview.js` — Algorithm step log and state highlighting.

Notes
- The app stores the current automaton per tab in `localStorage`. The key depends on the tab (`#afn`, `#gr`, otherwise `#afd`).
- ES Modules are used throughout — do not open `index.html` as `file://`; serve over HTTP.

## Data Format (Export/Import)

Exported JSON snapshot contains:
- `alphabet`: array of single‑character symbols (NFA may include `λ`)
- `states`: objects `{ id, name, x, y, isInitial, isFinal }`
- `transitions`: array of pairs `["src|symbol", [destIds...]]`
- `initialId` and `nextId`

Import replaces the current automaton. In DFA context, `λ` transitions are ignored.

## Keyboard & Usage Tips

- `C`: toggle connect mode; click origin → destination and enter symbol(s).
- `E`: edit selected state/edge (or double‑click an edge label).
- Arrow keys: nudge selection (hold Shift for a larger step).
- Delete/Backspace: remove selected state(s) or symbols on a selected edge.
- In NFA use `λ` for epsilon; in DFA each symbol has a single destination.

## Development

- No build step; just serve statically and open `index.html`.
- Manual checks recommended:
  - Build small DFAs/NFAs, simulate words, and verify highlights.
  - AFNλ → AFN and AFN → AFD conversions should preserve language.
  - Try DFA union/intersection/difference/equivalence on AFD tab.
  - Export/import JSON for lossless round‑trip.
  - Export PNG and confirm canvas styling is embedded.

## Security Notes

- Rendering avoids `innerHTML` for user‑controlled data; nodes are created with `textContent`.
- Error/warning messages that use HTML are built from trusted strings; dynamic pieces are escaped.

## Contributing

See `AGENTS.md` (Repository Guidelines) for structure, style, and testing notes.
