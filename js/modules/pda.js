// Pushdown Automaton (Autômato de Pilha) helper classes and simulation
// Implements a formal PDA as described in the coursework specification.

const LAMBDA = 'λ';

class PushdownAutomaton {
  constructor({ states, inputAlphabet, stackAlphabet, transitions = [], initialState, finalStates, bottomSymbol = '$' }) {
    this.states = new Set(states);
    this.inputAlphabet = new Set(inputAlphabet);
    this.stackAlphabet = new Set(stackAlphabet);
    this.initialState = initialState;
    this.finalStates = new Set(finalStates);
    this.bottomSymbol = bottomSymbol;
    this.transitions = [];
    this.transitionsByState = new Map();
    transitions.forEach(t => this.addTransition(t.from, t.read, t.pop, t.to, t.push));
  }

  static empilha(stack, symbols) {
    const out = stack.slice();
    if (!Array.isArray(symbols)) return out;
    for (let i = symbols.length - 1; i >= 0; i--) {
      const sym = symbols[i];
      if (!sym || sym === LAMBDA) continue;
      out.push(sym);
    }
    return out;
  }

  static desempilha(stack) {
    if (!stack.length) return stack.slice();
    const out = stack.slice();
    out.pop();
    return out;
  }

  static topo(stack) {
    return stack.length ? stack[stack.length - 1] : LAMBDA;
  }

  addTransition(from, read, pop, to, push = []) {
    const trans = {
      from,
      read: read || LAMBDA,
      pop: pop || LAMBDA,
      to,
      push: Array.isArray(push) ? push.filter(s => s && s !== LAMBDA) : [],
    };
    this.transitions.push(trans);
    if (!this.transitionsByState.has(from)) this.transitionsByState.set(from, []);
    this.transitionsByState.get(from).push(trans);
    this.states.add(from); this.states.add(to);
    if (trans.read !== LAMBDA) this.inputAlphabet.add(trans.read);
    if (trans.pop !== LAMBDA) this.stackAlphabet.add(trans.pop);
    trans.push.forEach(sym => this.stackAlphabet.add(sym));
  }

  getTransitions(from) {
    return this.transitionsByState.get(from) || [];
  }

  /**
   * Simula o AP seguindo o algoritmo do professor Zenilton.
   * A palavra de entrada pode ser uma string ou array de tokens.
   * Retorna { accepted: boolean, log: string[] }
   */
  simulate(word) {
    const tokens = Array.isArray(word) ? word.slice() : tokenizeWord(word);
    const queue = [{
      state: this.initialState,
      index: 0,
      stack: [],
      log: [],
    }];
    const visited = new Set();
    let iterations = 0;
    while (queue.length && iterations < 2000) {
      iterations++;
      const cfg = queue.shift();
      const remaining = tokens.slice(cfg.index).join(' ') || LAMBDA;
      const stackDisplay = cfg.stack.length ? cfg.stack.join(' ') : LAMBDA;
      const currentConfig = `[${cfg.state}, ${remaining}, ${stackDisplay}]`;
      const path = cfg.log.concat(currentConfig);
      const key = `${cfg.state}|${cfg.index}|${cfg.stack.join(',')}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (cfg.index === tokens.length && this.finalStates.has(cfg.state) && cfg.stack.length === 0) {
        return { accepted: true, log: path };
      }
      const transitions = this.getTransitions(cfg.state);
      for (const tr of transitions) {
        const canRead = tr.read === LAMBDA ? true : (cfg.index < tokens.length && tokens[cfg.index] === tr.read);
        if (!canRead) continue;
        const top = PushdownAutomaton.topo(cfg.stack);
        if (tr.pop !== LAMBDA) {
          if (top !== tr.pop) continue;
        }
        const newStack = cfg.stack.slice();
        if (tr.pop !== LAMBDA) newStack.pop();
        const pushed = PushdownAutomaton.empilha(newStack, tr.push);
        const newIndex = tr.read === LAMBDA ? cfg.index : cfg.index + 1;
        queue.push({
          state: tr.to,
          index: newIndex,
          stack: pushed,
          log: path,
        });
      }
    }
    return { accepted: false, log: [] };
  }

  describeTransitions() {
    const lines = [];
    for (const tr of this.transitions) {
      const pushStr = tr.push.length ? tr.push.join(' ') : LAMBDA;
      lines.push(`δ(${tr.from}, ${tr.read}, ${tr.pop}) = (${tr.to}, ${pushStr})`);
    }
    return lines.join('\n');
  }

  static fromContextFreeGrammar(grammar) {
    if (!grammar || !grammar.startSymbol) throw new Error('Gramática inválida para conversão em AP.');
    const bottom = '⊥';
    const startState = 'qInicio';
    const finalState = 'qFim';
    const pda = new PushdownAutomaton({
      states: [startState, finalState],
      inputAlphabet: Array.from(grammar.terminals),
      stackAlphabet: [...grammar.variables, ...grammar.terminals, bottom],
      transitions: [],
      initialState: startState,
      finalStates: [finalState],
      bottomSymbol: bottom,
    });
    // Inicia empilhando a marca de fundo e o símbolo inicial
    pda.addTransition(startState, LAMBDA, LAMBDA, finalState, [grammar.startSymbol, bottom]);
    // Produções A -> α substituem o topo da pilha por α
    for (const { lhs, rhs } of grammar.listProductions()) {
      const push = rhs.length ? rhs : [LAMBDA];
      pda.addTransition(finalState, LAMBDA, lhs, finalState, push);
    }
    // Consumo de terminais
    for (const t of grammar.terminals) {
      pda.addTransition(finalState, t, t, finalState, []);
    }
    // Quando pilha contém apenas a marca de fundo, remove-a para aceitar
    pda.addTransition(finalState, LAMBDA, bottom, finalState, []);
    return pda;
  }
}

function tokenizeWord(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === LAMBDA || trimmed.toLowerCase() === 'lambda' || trimmed.toLowerCase() === 'ε' || trimmed.toLowerCase() === 'epsilon') {
    return [];
  }
  if (trimmed.includes(' ')) {
    return trimmed.split(/\s+/).filter(Boolean);
  }
  return trimmed.split('').filter(Boolean);
}

export { PushdownAutomaton, tokenizeWord, LAMBDA };
