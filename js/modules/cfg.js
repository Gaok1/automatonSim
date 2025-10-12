import { PushdownAutomaton, tokenizeWord, LAMBDA } from './pda.js';

class ContextFreeGrammar {
  constructor() {
    this.variables = new Set();
    this.terminals = new Set();
    this.startSymbol = '';
    this.productions = new Map(); // lhs -> [{ id, rhs: [] }]
    this._prodId = 0;
  }

  setVariables(list) {
    this.variables = new Set(list.filter(Boolean));
    // remove productions that no longer have lhs in variables
    for (const lhs of Array.from(this.productions.keys())) {
      if (!this.variables.has(lhs)) this.productions.delete(lhs);
    }
  }

  setTerminals(list) {
    this.terminals = new Set(list.filter(Boolean));
  }

  setStartSymbol(symbol) {
    if (!symbol) throw new Error('Informe um símbolo inicial.');
    if (!this.variables.has(symbol)) throw new Error('O símbolo inicial deve estar nas variáveis.');
    this.startSymbol = symbol;
  }

  addProduction(lhs, rhsTokens) {
    if (!lhs) throw new Error('Informe o lado esquerdo.');
    if (!this.variables.has(lhs)) throw new Error(`Variável desconhecida: ${lhs}`);
    const cleanRhs = rhsTokens.filter(Boolean);
    if (!this.productions.has(lhs)) this.productions.set(lhs, []);
    const arr = this.productions.get(lhs);
    const existing = arr.find(p => arraysEqual(p.rhs, cleanRhs));
    if (existing) return existing.id;
    const id = `p${this._prodId++}`;
    arr.push({ id, rhs: cleanRhs });
    return id;
  }

  removeProduction(id) {
    for (const [lhs, arr] of this.productions.entries()) {
      const idx = arr.findIndex(p => p.id === id);
      if (idx >= 0) {
        arr.splice(idx, 1);
        if (!arr.length) this.productions.delete(lhs);
        return true;
      }
    }
    return false;
  }

  listProductions() {
    const out = [];
    for (const [lhs, arr] of this.productions.entries()) {
      for (const prod of arr) {
        out.push({ lhs, rhs: prod.rhs.slice(), id: prod.id });
      }
    }
    return out.sort((a, b) => a.lhs.localeCompare(b.lhs) || a.id.localeCompare(b.id));
  }

  clone() {
    const g = new ContextFreeGrammar();
    g.variables = new Set(this.variables);
    g.terminals = new Set(this.terminals);
    g.startSymbol = this.startSymbol;
    g._prodId = this._prodId;
    for (const [lhs, arr] of this.productions.entries()) {
      g.productions.set(lhs, arr.map(p => ({ id: p.id, rhs: p.rhs.slice() })));
    }
    return g;
  }

  toString() {
    const prods = this.listProductions();
    if (!prods.length) return 'P = ∅';
    return prods.map(({ lhs, rhs }) => `${lhs} → ${rhs.length ? rhs.join(' ') : LAMBDA}`).join('\n');
  }

  leftmostDerivation(word) {
    if (!this.startSymbol) throw new Error('Defina o símbolo inicial antes de derivar.');
    const target = tokenizeWord(word);
    const maxSteps = Math.max(2 * target.length + 4, 8);
    const queue = [{
      tokens: [this.startSymbol],
      steps: [],
      history: [this.startSymbol],
    }];
    let iterations = 0;
    while (queue.length && iterations < 2000) {
      iterations++;
      const node = queue.shift();
      const onlyTerminals = node.tokens.every(t => !this.variables.has(t));
      if (onlyTerminals) {
        const finalTokens = node.tokens.filter(t => t !== LAMBDA);
        if (arraysEqual(finalTokens, target)) {
          return {
            steps: node.steps,
            sententialForms: node.history,
            parseTree: buildParseTreeFromSteps(this, node.steps),
          };
        }
        continue;
      }
      if (node.history.length > maxSteps) continue;
      const idx = node.tokens.findIndex(t => this.variables.has(t));
      if (idx === -1) continue;
      const lhs = node.tokens[idx];
      const prods = this.productions.get(lhs) || [];
      for (const prod of prods) {
        const rhs = prod.rhs;
        const nextTokens = node.tokens.slice(0, idx).concat(rhs.length ? rhs : [LAMBDA], node.tokens.slice(idx + 1));
        if (!isCompatiblePrefix(nextTokens, target, this.variables)) continue;
        const historyEntry = tokensToDisplay(nextTokens);
        const nextHistory = node.history.concat(historyEntry);
        if (nextHistory.length > maxSteps) continue;
        queue.push({
          tokens: nextTokens,
          steps: node.steps.concat([{ variable: lhs, production: rhs.slice() }]),
          history: nextHistory,
        });
      }
    }
    return null;
  }

  toChomskyNormalForm() {
    if (!this.startSymbol) throw new Error('Defina o símbolo inicial antes de converter.');
    const g = this.clone();
    const originalStart = g.startSymbol;
    // 1) Novo símbolo inicial S0 -> S
    let newStart = 'S0';
    while (g.variables.has(newStart) || g.terminals.has(newStart)) {
      newStart = `${newStart}'`;
    }
    g.variables.add(newStart);
    g.startSymbol = newStart;
    g.addProduction(newStart, [originalStart]);
    // 2) Remover λ-produções (exceto S -> λ)
    const nullable = computeNullable(g);
    removeLambdaProductions(g, nullable, originalStart);
    // 3) Remover produções unitárias
    removeUnitProductions(g);
    // 4) Converter produções restantes para CNF
    convertToCnf(g);
    return g;
  }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sanitizeSymbol(sym) {
  return String(sym).replace(/[^A-Za-z0-9]/g, '_');
}

function tokensToDisplay(tokens) {
  const filtered = tokens.filter(t => t !== LAMBDA);
  return filtered.length ? filtered.join(' ') : LAMBDA;
}

function isCompatiblePrefix(tokens, target, variables) {
  const prefix = [];
  for (const symbol of tokens) {
    if (symbol === LAMBDA) continue;
    if (variables.has(symbol)) break;
    prefix.push(symbol);
  }
  for (let i = 0; i < prefix.length; i++) {
    if (target[i] !== prefix[i]) return false;
  }
  const suffix = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const symbol = tokens[i];
    if (symbol === LAMBDA) continue;
    if (variables.has(symbol)) break;
    suffix.unshift(symbol);
  }
  for (let i = 0; i < suffix.length; i++) {
    const targetIndex = target.length - suffix.length + i;
    if (targetIndex < 0 || target[targetIndex] !== suffix[i]) return false;
  }
  const terminalCount = tokens.filter(sym => sym !== LAMBDA && !variables.has(sym)).length;
  if (terminalCount > target.length) return false;
  return true;
}

function buildParseTreeFromSteps(grammar, steps) {
  const root = { symbol: grammar.startSymbol, children: [] };
  for (const step of steps) {
    const targetNode = findLeftmostExpandable(root, grammar.variables);
    if (!targetNode) break;
    if (!step.production.length) {
      targetNode.children = [{ symbol: LAMBDA, children: [] }];
    } else {
      targetNode.children = step.production.map(sym => ({ symbol: sym, children: [] }));
    }
  }
  return root;
}

function findLeftmostExpandable(node, variables) {
  if (variables.has(node.symbol) && (!node.children || node.children.length === 0)) {
    return node;
  }
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findLeftmostExpandable(child, variables);
    if (found) return found;
  }
  return null;
}

function formatParseTree(node, prefix = '', isLast = true) {
  const line = (prefix ? prefix + (isLast ? '└── ' : '├── ') : '') + node.symbol;
  if (!node.children || !node.children.length) return line;
  const childPrefix = prefix + (prefix ? (isLast ? '    ' : '│   ') : '');
  const lines = [line];
  node.children.forEach((child, index) => {
    const lastChild = index === node.children.length - 1;
    const nextPrefix = prefix ? childPrefix : (isLast ? '    ' : '│   ');
    lines.push(formatParseTree(child, nextPrefix, lastChild));
  });
  return lines.join('\n');
}

function computeNullable(grammar) {
  const nullable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const { lhs, rhs } of grammar.listProductions()) {
      if (!rhs.length || rhs.every(sym => nullable.has(sym))) {
        if (!nullable.has(lhs)) {
          nullable.add(lhs); changed = true;
        }
      }
    }
  }
  return nullable;
}

function removeLambdaProductions(grammar, nullable, originalStart) {
  for (const { lhs, rhs, id } of grammar.listProductions()) {
    if (!rhs.length) grammar.removeProduction(id);
  }
  const newProductions = [];
  for (const { lhs, rhs } of grammar.listProductions()) {
    const indices = rhs.map((sym, idx) => nullable.has(sym) ? idx : -1).filter(idx => idx >= 0);
    const subsets = powerSet(indices);
    for (const subset of subsets) {
      const generated = rhs.filter((_, idx) => !subset.has(idx));
      if (generated.length === rhs.length) continue;
      if (!generated.length) continue;
      newProductions.push({ lhs, rhs: generated });
    }
  }
  newProductions.forEach(({ lhs, rhs }) => grammar.addProduction(lhs, rhs));
  if (nullable.has(originalStart)) {
    grammar.addProduction(grammar.startSymbol, []);
  }
}

function removeUnitProductions(grammar) {
  const productionsByLhs = grammar.productions;
  const unitPairs = new Map();
  for (const lhs of productionsByLhs.keys()) unitPairs.set(lhs, new Set([lhs]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [lhs, arr] of productionsByLhs.entries()) {
      for (const prod of arr) {
        if (prod.rhs.length === 1 && productionsByLhs.has(prod.rhs[0])) {
          const target = prod.rhs[0];
          const set = unitPairs.get(lhs);
          if (!set.has(target)) { set.add(target); changed = true; }
        }
      }
    }
  }
  for (const [lhs, arr] of productionsByLhs.entries()) {
    const toRemove = arr.filter(prod => prod.rhs.length === 1 && productionsByLhs.has(prod.rhs[0]));
    for (const prod of toRemove) {
      grammar.removeProduction(prod.id);
    }
  }
  for (const [lhs, targets] of unitPairs.entries()) {
    for (const target of targets) {
      const prods = grammar.productions.get(target) || [];
      for (const prod of prods) {
        if (prod.rhs.length === 1 && grammar.productions.has(prod.rhs[0])) continue;
        grammar.addProduction(lhs, prod.rhs.slice());
      }
    }
  }
}

function convertToCnf(grammar) {
  const terminalMap = new Map();
  const newProductions = [];
  for (const { lhs, rhs, id } of grammar.listProductions()) {
    grammar.removeProduction(id);
    let currentLhs = lhs;
    if (rhs.length === 1 && !grammar.variables.has(rhs[0])) {
      grammar.addProduction(currentLhs, rhs);
      continue;
    }
    let currentRhs = rhs.slice();
    currentRhs = currentRhs.map(sym => {
      if (grammar.variables.has(sym)) return sym;
      if (!terminalMap.has(sym)) {
        let name = `T_${sanitizeSymbol(sym)}`;
        while (grammar.variables.has(name)) name = `${name}'`;
        grammar.variables.add(name);
        grammar.addProduction(name, [sym]);
        terminalMap.set(sym, name);
      }
      return terminalMap.get(sym);
    });
    while (currentRhs.length > 2) {
      const first = currentRhs.shift();
      const restNameBase = `${sanitizeSymbol(first)}${sanitizeSymbol(currentRhs.join(''))}`;
      let newVar = `X_${restNameBase}`;
      while (grammar.variables.has(newVar)) newVar = `${newVar}'`;
      grammar.variables.add(newVar);
      newProductions.push({ lhs: currentLhs, rhs: [first, newVar] });
      currentLhs = newVar; // continue decompondo a cauda
    }
    newProductions.push({ lhs: currentLhs, rhs: currentRhs });
  }
  newProductions.forEach(prod => grammar.addProduction(prod.lhs, prod.rhs));
}

function powerSet(indices) {
  const result = [];
  const n = indices.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const set = new Set();
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) set.add(indices[i]);
    }
    result.push(set);
  }
  return result;
}

// ===== UI LAYER =====
const CFG = new ContextFreeGrammar();
let CURRENT_PDA = null;

function parseCommaList(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function parseRhs(value) {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed || trimmed === LAMBDA || trimmed.toLowerCase() === 'lambda' || trimmed.toLowerCase() === 'ε' || trimmed.toLowerCase() === 'epsilon') {
    return [];
  }
  if (trimmed.includes(' ')) return trimmed.split(/\s+/).filter(Boolean);
  return trimmed.split('').filter(Boolean);
}

function setupCfgUi() {
  const varsInput = document.getElementById('cfgVariables');
  const termsInput = document.getElementById('cfgTerminals');
  const startInput = document.getElementById('cfgStart');
  const setBtn = document.getElementById('cfgApplySymbolsBtn');
  const lhsInput = document.getElementById('cfgProductionLhs');
  const rhsInput = document.getElementById('cfgProductionRhs');
  const addProdBtn = document.getElementById('cfgAddProductionBtn');
  const prodList = document.getElementById('cfgProductionsList');
  const cnfBtn = document.getElementById('cfgCnfBtn');
  const cnfOut = document.getElementById('cfgCnfOutput');
  const wordInput = document.getElementById('cfgDerivationWord');
  const derivBtn = document.getElementById('cfgDerivationBtn');
  const derivOut = document.getElementById('cfgDerivationOutput');
  const treeOut = document.getElementById('cfgParseTreeOutput');
  const pdaBtn = document.getElementById('cfgToPdaBtn');
  const pdaOut = document.getElementById('cfgPdaOutput');
  const simWordInput = document.getElementById('cfgPdaWord');
  const simBtn = document.getElementById('cfgPdaSimulateBtn');
  const simOut = document.getElementById('cfgPdaSimulationOutput');
  const verifyBtn = document.getElementById('cfgVerifyBtn');
  const status = document.getElementById('cfgStatus');

  function invalidatePda() {
    CURRENT_PDA = null;
    if (pdaOut) pdaOut.textContent = '';
  }

  function renderProductions() {
    prodList.innerHTML = '';
    const prods = CFG.listProductions();
    if (!prods.length) {
      prodList.innerHTML = '<li class="muted">Nenhuma produção cadastrada.</li>';
      return;
    }
    for (const { lhs, rhs, id } of prods) {
      const li = document.createElement('li');
      li.innerHTML = `<code>${lhs} → ${rhs.length ? rhs.join(' ') : LAMBDA}</code>`;
      const btn = document.createElement('button');
      btn.textContent = 'Remover';
      btn.className = 'btn-soft';
      btn.addEventListener('click', () => {
        CFG.removeProduction(id);
        invalidatePda();
        renderProductions();
      });
      li.appendChild(btn);
      prodList.appendChild(li);
    }
  }

  setBtn.addEventListener('click', () => {
    try {
      CFG.setVariables(parseCommaList(varsInput.value));
      CFG.setTerminals(parseCommaList(termsInput.value));
      CFG.setStartSymbol(startInput.value.trim());
      status.textContent = 'Conjunto de símbolos atualizado com sucesso.';
      status.className = 'mini success';
      invalidatePda();
      renderProductions();
    } catch (e) {
      status.textContent = e.message;
      status.className = 'mini error';
    }
  });

  addProdBtn.addEventListener('click', () => {
    try {
      const lhs = lhsInput.value.trim();
      const rhs = parseRhs(rhsInput.value);
      CFG.addProduction(lhs, rhs);
      lhsInput.value = '';
      rhsInput.value = '';
      renderProductions();
      status.textContent = `Produção ${lhs} → ${rhs.length ? rhs.join(' ') : LAMBDA} adicionada.`;
      status.className = 'mini success';
      invalidatePda();
    } catch (e) {
      status.textContent = e.message;
      status.className = 'mini error';
    }
  });

  cnfBtn.addEventListener('click', () => {
    try {
      const cnf = CFG.toChomskyNormalForm();
      cnfOut.textContent = [
        `Variáveis: { ${Array.from(cnf.variables).join(', ')} }`,
        `Terminais: { ${Array.from(cnf.terminals).join(', ')} }`,
        `Inicial: ${cnf.startSymbol}`,
        'Produções:',
        cnf.toString(),
      ].join('\n');
      status.textContent = 'Gramática convertida para a Forma Normal de Chomsky.';
      status.className = 'mini success';
    } catch (e) {
      cnfOut.textContent = '';
      status.textContent = e.message;
      status.className = 'mini error';
    }
  });

  function runDerivation() {
    try {
      const result = CFG.leftmostDerivation(wordInput.value);
      if (!result) {
        derivOut.textContent = 'Nenhuma derivação encontrada (verifique limites e produções).';
        treeOut.textContent = '';
        status.textContent = 'Sentença não derivada com a estratégia atual.';
        status.className = 'mini warning';
        return;
      }
      derivOut.textContent = result.sententialForms.join(' ⇒\n');
      treeOut.textContent = formatParseTree(result.parseTree);
      status.textContent = 'Derivação à esquerda concluída.';
      status.className = 'mini success';
    } catch (e) {
      derivOut.textContent = '';
      treeOut.textContent = '';
      status.textContent = e.message;
      status.className = 'mini error';
    }
  }

  derivBtn.addEventListener('click', runDerivation);

  pdaBtn.addEventListener('click', () => {
    try {
      CURRENT_PDA = PushdownAutomaton.fromContextFreeGrammar(CFG);
      pdaOut.textContent = CURRENT_PDA.describeTransitions();
      status.textContent = 'Autômato de Pilha gerado a partir da GLC.';
      status.className = 'mini success';
    } catch (e) {
      pdaOut.textContent = '';
      status.textContent = e.message;
      status.className = 'mini error';
    }
  });

  function runSimulation() {
    if (!CURRENT_PDA) {
      status.textContent = 'Gere um AP antes de simular.';
      status.className = 'mini warning';
      return;
    }
    const word = simWordInput.value;
    const result = CURRENT_PDA.simulate(word);
    if (result.accepted) {
      status.textContent = 'Sentença aceita pelo AP (pilha vazia e estado final).';
      status.className = 'mini success';
    } else {
      status.textContent = 'Sentença rejeitada pelo AP.';
      status.className = 'mini warning';
    }
    simOut.textContent = result.log.length ? result.log.join(' ⇒\n') : 'Nenhum caminho aceitador encontrado.';
  }

  simBtn.addEventListener('click', runSimulation);

  verifyBtn.addEventListener('click', () => {
    runDerivation();
    runSimulation();
  });

  renderProductions();
}

export { ContextFreeGrammar, setupCfgUi, formatParseTree };
