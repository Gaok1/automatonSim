# Repository Guidelines

## Project Structure & Module Organization
- `index.html` – DFA editor/simulator (deterministic).
- `afn.html` – NFA/ε‑NFA editor with conversions.
- `gr.html` – Builds automata from regular grammars.
- `js/core.js` – Data model (alphabet, states, transitions), rendering, conversions (λ‑removal, NFA→DFA, DFA→Regex), and localStorage persistence.
- `js/run.js` – Simulation logic and step‑by‑step UI.
- `js/regex.js` – Thompson construction from regex to NFAλ.
- `js/grammar.js` – Regular grammar → automaton builder.
- `style.css` – Shared styles.

## Build, Test, and Development Commands
- No build step; serve statically for local dev:
  - `python3 -m http.server 8000` → open `http://localhost:8000/index.html`
  - or `npx serve .` (Node installed)
- Quick check: open `index.html`, `afn.html`, `gr.html` and ensure the browser console shows no errors.

## Coding Style & Naming Conventions
- JavaScript: 2‑space indent, semicolons, single quotes, camelCase for identifiers; filenames lowercase without spaces (e.g., `core.js`).
- Prefer `textContent` over `innerHTML` for any user‑controlled data; if templating is unavoidable, escape characters.
- Keep algorithm step logging via `emitAlgoStep(...)` so UI highlights stay in sync.

## Testing Guidelines
- No automated tests yet; use manual checks:
  - Build small DFAs/NFAs, simulate words, and verify accepted/rejected highlights.
  - AFNλ → AFN and AFN → AFD conversions should preserve language; compare simulations.
  - On `index.html`/`gr.html`, try DFA union/intersection/equivalence.
  - Export/import JSON and confirm a lossless round‑trip.

## Commit & Pull Request Guidelines
- Use conventional messages with scope: `fix(ui): …`, `feat(afd): …`, `sec(xss): …`, `perf(render): …`.
- PRs must include: clear description, reproduction steps, affected pages (`index`, `afn`, `gr`), screenshots/GIFs when UI changes, and manual test notes.
- Do not break existing HTML ids; wire buttons defensively (check elements before `addEventListener`).

## Security & Configuration Tips
- Prevent XSS: never inject state names via `innerHTML`; if needed, escape `& < > " '`. Prefer creating DOM nodes and setting `textContent`.
- Persistence: the UI uses `localStorage` (`LS_KEY`); you can override with `window.LS_KEY` in dev sessions.

