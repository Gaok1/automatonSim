# automatonSim
just a automaton simulator to practice Foundations of Theoretical Computer Science

## Features

- Build and edit deterministic and nondeterministic finite automata (with λ-transitions) in the browser.
- Generate finite automata from regular grammars on the new `gr.html` page.
- Simulate words normally via **Rodar** or step-by-step using **Modo Run** with a manual *Passo* button.
- Export the current canvas as a PNG image.
- Load classic automata from the **Exemplos** menu for quick experiments.

## Algorithm visualization

In the AFN interface (`afn.html`) the conversion buttons now display each step of the algorithms:

1. **AFNλ → AFN** – shows how λ-transitions are eliminated.
2. **AFN → AFD** – illustrates the subset construction.

The steps appear in a panel below the conversion buttons and highlight the states involved during the process.
