# automatonSim
Interactive DFA/NFA simulator for the browser, focused on learning Automata Theory. Build automata visually, convert between models, run words step‑by‑step, and export/import your work.

## Quick Start

- Serve the repository statically:
  - `python3 -m http.server 8000` then open `http://localhost:8000/index.html`
  - or `npx serve .`
- Pages:
  - `index.html` – DFA editing/simulation and DFA operations. As operações ficam logo abaixo do Canvas.
  - `afn.html` – NFA/ε‑NFA editing with conversions (and “convert & open” to DFA). Conversões e operações AFNλ ficam logo abaixo do Canvas; “Exemplos” está na barra lateral esquerda.
  - `gr.html` – Build automata from Regular Grammars/Regex; export AF → Grammar. Conversões e operações de AFDs ficam logo abaixo do Canvas; “Exemplos” está na barra lateral esquerda.

## Highlights

- Edit DFA/NFA (supports λ in NFA), simulate a word, and step through runs.
- Conversions and operations:
  - ε‑NFA → NFA, NFA → DFA (subset construction), DFA → Regex (state elimination)
  - Union, Intersection, Difference, Equivalence Check
  - Complement, Prefix/Suffix Closure, “Complete DFA” (adds trap state)
- Build from Regular Grammar and from Regex (Thompson). Export Grammar from AF.
- Canvas UX: multi‑selection (Shift), box select, arrow nudge, inline edge‑label edit (double‑click), add multiple symbols at once (comma‑separated), Delete to remove states/edges.
- Layout presets: “Compacto”, “Balanceado” e “Espalhar” aplicam auto‑layout (sem Snap/Alinhar/Distribuir).
- Export PNG of the canvas. Example library (menu) to load sample automata.
- Cross‑page “convert & open”: after a conversion, automatically opens the DFA page with the result.

## Data Format (Export/Import)

Exported JSON snapshot contains:
- `alphabet`: array of single‑character symbols (NFA may include `λ`)
- `states`: objects `{ id, name, x, y, isInitial, isFinal }`
- `transitions`: array of pairs `["src|symbol", [destIds...]]`
- `initialId` and `nextId`

Import replaces the current automaton. For deterministic pages, `λ` transitions are ignored.

## Tips

- Press `C` to toggle connect mode; click origin then destination and enter symbol(s).
- In NFA, use `λ`. In DFA, a symbol has a single destination.
- Use the “Operations on current DFA” card (abaixo do Canvas em `index.html`) to Complete, Complement, Prefix/Suffix‑closure.
- Library of examples is available in the Examples card.

## Contributing

See `AGENTS.md` (Repository Guidelines) for structure, style, and testing notes.
