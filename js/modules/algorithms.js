// Algoritmos e operações sobre o autômato (sem tocar em DOM diretamente)
import { A, keyTS, alphaStr, bumpTransitionsVersion, isAfn } from './state.js';

// Emissão de passos para o painel didático
function emitAlgoStep(algo, step, detail = {}) {
  document.dispatchEvent(new CustomEvent('algoStep', { detail: { algo, step, ...detail } }));
}

// ===================== DFA → ER (eliminação de estados) =====================
function dfaToRegex(allowEps = false) {
  const msg = [];
  const states = Array.from(A.states.keys());
  if (!A.initialId) return { output: '', msg: `<span class="warn">Defina um estado inicial.</span>` };
  const finals = states.filter(s => A.states.get(s).isFinal);
  if (!finals.length) return { output: '', msg: `<span class="warn">Nenhum estado final definido.</span>` };
  if (!A.alphabet.size) return { output: '', msg: `<span class="warn">Defina Σ.</span>` };

  const idx = new Map(); states.forEach((s, i) => idx.set(s, i));
  const n = states.length;
  let R = Array.from({ length: n }, _ => Array.from({ length: n }, _ => null));
  for (const [k, dests] of A.transitions.entries()) {
    const [src, sym] = k.split('|');
    for (const to of dests) {
      const i = idx.get(src), j = idx.get(to);
      R[i][j] = R[i][j] ? union(R[i][j], sym) : sym;
    }
  }
  const init = idx.get(A.initialId);
  const fins = finals.map(f => idx.get(f));

  const N = n + 2, Saux = n, Faux = n + 1;
  let G = Array.from({ length: N }, _ => Array.from({ length: N }, _ => null));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (R[i][j]) G[i][j] = R[i][j];
  G[Saux][init] = 'λ';
  for (const j of fins) G[j][Faux] = union(G[j][Faux], 'λ');

  const statesOrder = [];
  for (let k = 0; k < N; k++) if (k !== Saux && k !== Faux) statesOrder.push(k);

  for (const k of statesOrder) {
    emitAlgoStep('dfaToRegex', 'eliminate', { state: states[k] });
    const Rkk = G[k][k] || null;
    const starK = star(Rkk);
    for (let i = 0; i < N; i++) {
      if (i === k) continue;
      const Rik = G[i][k] || null;
      if (!Rik) continue;
      for (let j = 0; j < N; j++) {
        if (j === k) continue;
        const Rkj = G[k][j] || null;
        if (!Rkj) continue;
        const via = concat(concat(Rik, starK), Rkj);
        G[i][j] = union(G[i][j], via);
        const fromId = i < n ? states[i] : null;
        const toId = j < n ? states[j] : null;
        const fromName = i === Saux ? 'I' : (i < n ? (A.states.get(states[i])?.name || states[i]) : '');
        const toName = j === Faux ? 'F' : (j < n ? (A.states.get(states[j])?.name || states[j]) : '');
        emitAlgoStep('dfaToRegex', 'transition', { from: fromId, to: toId, via: states[k], regex: via, fromName, toName });
      }
    }
    for (let i = 0; i < N; i++) { G[i][k] = null; G[k][i] = null; }
    G[k][k] = null;
    emitAlgoStep('dfaToRegex', 'remove', { state: states[k] });
  }

  let Rfinal = G[Saux][Faux] || null;
  if (!Rfinal) {
    return { output: '', msg: `<span class="warn">A linguagem reconhecida é vazia (sem caminhos).</span>` };
  }

  Rfinal = simplify(Rfinal);
  emitAlgoStep('dfaToRegex', 'final', { regex: Rfinal });

  if (!allowEps && Rfinal.includes('λ')) {
    msg.push(`<span class="warn">A expressão exata envolve λ. Como você desativou “Permitir λ”, tentei remover/absorver λ por álgebra básica; se não foi possível sem alterar a linguagem, o resultado foi omitido.</span>`);
    const noEps = dropEpsilonIfSafe(Rfinal);
    if (noEps === null) return { output: '', msg: msg.join('<br>') };
    Rfinal = noEps;
  }

  if (!onlyAllowedTokens(Rfinal)) {
    msg.push(`<span class="warn">A saída usa apenas símbolos de Σ, parênteses, “∪” e “*”. Se vir algo diferente, houve falha na normalização.</span>`);
  }
  return { output: Rfinal, msg: msg.join('<br>') };
}

function isNull(x) { return x === null || x === '∅'; }
function isEps(x) { return x === 'λ'; }
function par(x) {
  if (!x) return null;
  if (/^[A-Za-z0-9]$/.test(x) || x === 'λ') return x;
  if (x.endsWith('*') && balanced(x.slice(0, -1))) return x;
  return `(${x})`;
}
function balanced(s) { let d = 0; for (const c of s) { if (c === '(') d++; else if (c === ')') d--; if (d < 0) return false; } return d === 0; }
function union(a, b) {
  if (isNull(a)) return b || null;
  if (isNull(b)) return a || null;
  if (a === b) return a;
  const parts = new Set(splitTopUnion(a).concat(splitTopUnion(b)));
  return Array.from(parts).join(' ∪ ');
}
function concat(a, b) {
  if (isNull(a) || isNull(b)) return null;
  if (isEps(a)) return b;
  if (isEps(b)) return a;
  return a && b ? (needsPar(a, 'concat') + needsPar(b, 'concat')) : null;
}
function needsPar(x, ctx) {
  const hasUnion = x.includes(' ∪ ');
  const simpleAtom = /^[A-Za-z0-9]$/.test(x) || x === 'λ' || (x.endsWith('*') && balanced(x.slice(0, -1)));
  if (simpleAtom) return x;
  if (ctx === 'concat' && hasUnion) return `(${x})`;
  return `(${x})`;
}
function star(x) { if (isNull(x) || isEps(x)) return 'λ'; if (x.endsWith('*')) return x; return `${needsPar(x)}*`; }
function simplify(r) { if (!r) return r; const parts = splitTopUnion(r); const cleaned = parts.map(cleanFactor); const uniq = Array.from(new Set(cleaned)); return uniq.join(' ∪ '); }
function splitTopUnion(r) { const parts = []; let d = 0, cur=''; for (let i=0;i<r.length;i++){const c=r[i]; if(c==='(')d++; if(c===')')d--; if(d===0 && r.slice(i,i+3)===' ∪ '){parts.push(cur);cur='';i+=2;continue;} cur+=c;} if(cur)parts.push(cur); return parts; }
function cleanFactor(f) { while (f.startsWith('(') && f.endsWith(')') && balanced(f.slice(1, -1))) f = f.slice(1, -1); return f; }
function dropEpsilonIfSafe(r) {
  if (!r.includes('λ')) return r;
  const parts = splitTopUnion(r);
  const hasEps = parts.includes('λ');
  if (hasEps) {
    const others = parts.filter(p => p !== 'λ');
    if (others.length === 0) return null;
    const someStar = others.some(p => p.endsWith('*'));
    return someStar ? simplify(others.join(' ∪ ')) : null;
  }
  return r.replaceAll('λ', '');
}
function onlyAllowedTokens(r) { return /^[A-Za-z0-9 ()∪*]+$/.test(r); }

// ===================== ε-fechos e conversões AFN/AFD =====================
function epsilonClosureMap(states, trans) {
  const st = new Set(states);
  const stack = Array.from(states);
  while (stack.length) {
    const s = stack.pop();
    const k = keyTS(s, 'λ');
    const set = trans.get(k);
    if (!set) continue;
    for (const d of set) if (!st.has(d)) { st.add(d); stack.push(d); }
  }
  return st;
}

function removeLambdaTransitions() {
  const closures = new Map();
  for (const id of A.states.keys()) {
    const cl = epsilonClosureMap(new Set([id]), A.transitions);
    closures.set(id, cl);
    emitAlgoStep('removeLambda', 'closure', { state: id, closure: Array.from(cl) });
  }
  for (const s of A.states.values()) {
    s.isFinal = [...closures.get(s.id)].some(id => A.states.get(id)?.isFinal);
    emitAlgoStep('removeLambda', 'final', { state: s.id, isFinal: s.isFinal });
  }
  const newTrans = new Map();
  for (const id of A.states.keys()) {
    for (const sym of A.alphabet) {
      if (sym === 'λ') continue;
      const dests = new Set();
      for (const q of closures.get(id)) {
        const k = keyTS(q, sym);
        if (A.transitions.has(k)) {
          for (const d of A.transitions.get(k)) {
            epsilonClosureMap(new Set([d]), A.transitions).forEach(x => dests.add(x));
          }
        }
      }
      if (dests.size) {
        newTrans.set(keyTS(id, sym), dests);
        emitAlgoStep('removeLambda', 'transition', { from: id, sym, to: Array.from(dests) });
      }
    }
  }
  A.transitions = newTrans;
  bumpTransitionsVersion();
  A.alphabet.delete('λ');
}

function convertNfaToDfa() {
  const withLambda = Array.from(A.transitions.keys()).filter(k => k.endsWith('|λ'));
  if (withLambda.length) {
    alert('Remova transições λ antes de converter para AFD.\nEx.: ' + withLambda.slice(0, 5).join(', ') + (withLambda.length > 5 ? '...' : ''));
    return;
  }
  const oldStates = new Map(Array.from(A.states.values()).map(s => [s.id, s]));
  const oldTrans = new Map(Array.from(A.transitions.entries()).map(([k, set]) => [k, new Set(set)]));
  const alphabet = Array.from(A.alphabet).filter(sym => sym !== 'λ');

  function subsetKey(set) { return Array.from(set).sort().join(','); }
  function subsetName(set) { return '{' + Array.from(set).map(id => oldStates.get(id)?.name || id).join(',') + '}'; }

  A.states.clear();
  A.transitions.clear();
  A.nextId = 0;

  const subsetMap = new Map();
  const queue = [];
  function getIdFor(set) {
    const key = subsetKey(set);
    if (!subsetMap.has(key)) {
      const sid = `q${subsetMap.size}`;
      const st = { id: sid, name: subsetName(set), x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial: false, isFinal: [...set].some(s => oldStates.get(s)?.isFinal) };
      subsetMap.set(key, sid);
      A.states.set(sid, st);
      queue.push(set);
      emitAlgoStep('nfaToDfa', 'newState', { id: sid, subset: Array.from(set) });
    }
    return subsetMap.get(key);
  }

  const startSet = new Set([A.initialId]);
  const startId = getIdFor(startSet);
  A.states.get(startId).isInitial = true;
  A.initialId = startId;

  while (queue.length) {
    const set = queue.shift();
    const fromId = getIdFor(set);
    for (const sym of alphabet) {
      const dest = new Set();
      for (const s of set) {
        const k = keyTS(s, sym);
        if (oldTrans.has(k)) oldTrans.get(k).forEach(d => dest.add(d));
      }
      if (dest.size) {
        const toId = getIdFor(dest);
        const key = keyTS(fromId, sym);
        if (!A.transitions.has(key)) A.transitions.set(key, new Set());
        A.transitions.get(key).add(toId);
        emitAlgoStep('nfaToDfa', 'transition', { from: fromId, sym, to: toId });
      }
    }
  }
  bumpTransitionsVersion();
  A.alphabet = new Set(alphabet);
}

// ===================== Operações/AFDs e equivalência =====================
function readDfa(obj) {
  const states = new Map(obj.states.map(s => [s.id, { ...s }]));
  const trans = new Map();
  for (const [k, v] of (obj.transitions || [])) {
    const [src, sym] = String(k).split('|');
    const dest = Array.isArray(v) ? v[0] : v; // DFA
    if (dest) trans.set(keyTS(src, sym), dest);
  }
  const alphabet = [...(obj.alphabet || [])].filter(s => s !== 'λ');
  let trap = null;
  function ensureTrap() { if (!trap) { trap = '__trap__'; states.set(trap, { id: trap, name: 'trap', isFinal: false }); } }
  for (const sid of states.keys()) { for (const sym of alphabet) { const k = keyTS(sid, sym); if (!trans.has(k)) { ensureTrap(); trans.set(k, trap); } } }
  if (trap) { for (const sym of alphabet) trans.set(keyTS(trap, sym), trap); }
  return { states, trans, alphabet, initialId: obj.initialId };
}

function removeUnreachableStates(obj) {
  const reachable = new Set();
  function dfs(stateId) {
    if (reachable.has(stateId)) return; reachable.add(stateId);
    for (const [k, dest] of obj.transitions) { const [from] = k.split('|'); if (from === stateId) { const arr = Array.isArray(dest) ? dest : [dest]; arr.forEach(dfs); } }
  }
  dfs(obj.initialId);
  obj.states = obj.states.filter(s => reachable.has(s.id));
  obj.transitions = obj.transitions.map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).filter(d => reachable.has(d))]).filter(([k, arr]) => arr.length > 0);
  return obj;
}

function nfaAcceptsEmpty(obj) {
  const trans = new Map((obj.transitions || []).map(([k, v]) => [k, new Set(Array.isArray(v) ? v : [v])]));
  const closure = epsilonClosureMap(new Set([obj.initialId]), trans);
  const finals = new Set(obj.states.filter(s => s.isFinal).map(s => s.id));
  for (const q of closure) if (finals.has(q)) return true; return false;
}

function combineNFAs(obj1, obj2, op) {
  const alpha = Array.from(new Set([...(obj1.alphabet || []), ...(obj2.alphabet || [])]));
  const states = new Map(); const transitions = new Map(); const map1 = new Map(); const map2 = new Map();
  let idCounter = 0; const nid = () => 'q' + (idCounter++);
  function clone(obj, map) {
    for (const s of obj.states) { const id = nid(); states.set(id, { id, name: s.name, x: Math.random()*500+50, y: Math.random()*300+50, isFinal: s.isFinal, isInitial: false }); map.set(s.id, id); }
    for (const [k, v] of obj.transitions) { const [src, sym] = String(k).split('|'); if (!map.has(src)) continue; const arr = Array.isArray(v) ? v : [v]; const key = keyTS(map.get(src), sym); const set = transitions.get(key) || new Set(); arr.forEach(d => { if (map.has(d)) set.add(map.get(d)); }); if (set.size) transitions.set(key, set); }
  }
  clone(obj1, map1); clone(obj2, map2);
  let initialId = '';
  if (op === 'union') {
    initialId = nid();
    const initFinal = nfaAcceptsEmpty(obj1) || nfaAcceptsEmpty(obj2);
    states.set(initialId, { id: initialId, name: 'init', x: Math.random()*500+50, y: Math.random()*300+50, isInitial: true, isFinal: initFinal });
    const set = new Set([map1.get(obj1.initialId), map2.get(obj2.initialId)]);
    transitions.set(keyTS(initialId, 'λ'), set);
  } else if (op === 'concat') {
    initialId = map1.get(obj1.initialId);
    states.get(initialId).isInitial = true;
    const init2 = map2.get(obj2.initialId);
    const acceptsEmpty2 = nfaAcceptsEmpty(obj2);
    for (const s of obj1.states) {
      const id = map1.get(s.id); states.get(id).isFinal = acceptsEmpty2 && s.isFinal;
      if (s.isFinal) { const key = keyTS(id, 'λ'); const set = transitions.get(key) || new Set(); set.add(init2); transitions.set(key, set); }
    }
  }
  for (const s of obj2.states) { const id = map2.get(s.id); states.get(id).isFinal = s.isFinal; }
  return removeUnreachableStates({ alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()).map(([k, set]) => [k, Array.from(set)]), initialId, nextId: idCounter });
}

function starNFA(obj) {
  const alpha = Array.from(new Set(obj.alphabet || []));
  const states = new Map(); const transitions = new Map(); const map = new Map();
  let idCounter = 0; const nid = () => 'q' + (idCounter++);
  for (const s of obj.states) { const id = nid(); states.set(id, { id, name: s.name, x: Math.random()*500+50, y: Math.random()*300+50, isFinal: s.isFinal, isInitial: false }); map.set(s.id, id); }
  for (const [k, v] of obj.transitions) { const [src, sym] = String(k).split('|'); const arr = Array.isArray(v) ? v : [v]; const key = keyTS(map.get(src), sym); const set = transitions.get(key) || new Set(); arr.forEach(d => set.add(map.get(d))); transitions.set(key, set); }
  const initOld = map.get(obj.initialId); const newInit = nid();
  states.set(newInit, { id: newInit, name: 'S', x: 60, y: 60, isInitial: true, isFinal: true });
  const set = new Set([initOld]); transitions.set(keyTS(newInit, 'λ'), set);
  for (const s of obj.states) {
    const id = map.get(s.id);
    if (s.isFinal) { const key = keyTS(id, 'λ'); const st = transitions.get(key) || new Set(); st.add(initOld); st.add(newInit); transitions.set(key, st); }
  }
  return removeUnreachableStates({ alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()).map(([k, set]) => [k, Array.from(set)]), initialId: newInit, nextId: idCounter });
}

function toDFA(obj) {
  const trans = new Map(); obj.transitions.forEach(([k, v]) => trans.set(k, new Set(Array.isArray(v) ? v : [v])));
  const states = new Map(obj.states.map(s => [s.id, { ...s }]));
  const alphabet = Array.from(new Set(obj.alphabet.filter(s => s !== 'λ')));
  const subsetMap = new Map(); const queue = [];
  function subsetKey(set) { return Array.from(set).sort().join(','); }
  function subsetName(set) { return '{' + Array.from(set).map(id => states.get(id)?.name || id).join(',') + '}'; }
  function getIdFor(set, dfa) {
    const key = subsetKey(set);
    if (!subsetMap.has(key)) { const id = 'S' + subsetMap.size; dfa.states.set(id, { id, name: subsetName(set), isFinal: [...set].some(s => states.get(s)?.isFinal) }); subsetMap.set(key, id); queue.push(set); }
    return subsetMap.get(key);
  }
  const dfa = { states: new Map(), transitions: new Map(), alphabet, initialId: null };
  const s0 = getIdFor(new Set([obj.initialId]), dfa); dfa.initialId = s0;
  while (queue.length) {
    const set = queue.shift(); const fromId = getIdFor(set, dfa);
    for (const sym of alphabet) { const dest = new Set(); for (const s of set) { const k = keyTS(s, sym); (trans.get(k) || []).forEach(d => dest.add(d)); } if (dest.size) { const toId = getIdFor(dest, dfa); dfa.transitions.set(keyTS(fromId, sym), toId); } }
  }
  return dfa;
}

function combineAFDs(obj1, obj2, op) {
  if (JSON.stringify(obj1.alphabet) !== JSON.stringify(obj2.alphabet)) { alert('Alfabetos diferentes!'); return; }
  const A1 = readDfa(obj1); const A2 = readDfa(obj2); const alpha = A1.alphabet;
  const pairKey = (p1, p2) => `${p1}|${p2}`;
  const states = new Map(); const idMap = new Map(); const transitions = new Map(); let idCounter = 0; const nid = () => 'q' + (idCounter++);
  function ensurePair(p1, p2) {
    const k = pairKey(p1, p2); if (idMap.has(k)) return idMap.get(k);
    const id = nid(); const s1 = A1.states.get(p1), s2 = A2.states.get(p2);
    let final = false; if (op === 'union') final = (s1.isFinal || s2.isFinal); else if (op === 'intersection') final = (s1.isFinal && s2.isFinal); else if (op === 'difference') final = (s1.isFinal && !s2.isFinal);
    const st = { id, name: `(${s1.name},${s2.name})`, x: 100 + (idCounter % 8) * 70, y: 140 + Math.floor(idCounter / 8) * 70, isFinal: final, isInitial: false };
    idMap.set(k, id); states.set(id, st); return id;
  }
  const q0 = ensurePair(A1.initialId, A2.initialId); states.get(q0).isInitial = true;
  const queue = [[A1.initialId, A2.initialId]]; const seen = new Set();
  while (queue.length) {
    const [p1, p2] = queue.shift(); const key = pairKey(p1, p2); if (seen.has(key)) continue; seen.add(key); const fromId = ensurePair(p1, p2);
    for (const sym of alpha) { const d1 = A1.trans.get(keyTS(p1, sym)); const d2 = A2.trans.get(keyTS(p2, sym)); if (d1 && d2) { const toId = ensurePair(d1, d2); transitions.set(keyTS(fromId, sym), toId); queue.push([d1, d2]); } }
  }
  return removeUnreachableStates({ alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()), initialId: q0, nextId: idCounter });
}

function areEquivalent(obj1, obj2) {
  const dfa1 = toDFA(obj1); const dfa2 = toDFA(obj2); const alpha = new Set([...dfa1.alphabet, ...dfa2.alphabet]);
  const trap1 = '__trap1__', trap2 = '__trap2__';
  const queue = [[dfa1.initialId || trap1, dfa2.initialId || trap2]]; const seen = new Set();
  while (queue.length) {
    const [s1, s2] = queue.shift(); const key = s1 + '|' + s2; if (seen.has(key)) continue; seen.add(key);
    const f1 = dfa1.states.get(s1)?.isFinal || false; const f2 = dfa2.states.get(s2)?.isFinal || false; if (f1 !== f2) return false;
    for (const sym of alpha) { const n1 = s1 === trap1 ? trap1 : (dfa1.transitions.get(keyTS(s1, sym)) || trap1); const n2 = s2 === trap2 ? trap2 : (dfa2.transitions.get(keyTS(s2, sym)) || trap2); queue.push([n1, n2]); }
  }
  return true;
}

// ===================== Operações no AFD atual =====================
function completeCurrentDfa() {
  const alpha = Array.from(A.alphabet).filter(s => s !== 'λ');
  const states = Array.from(A.states.keys());
  let trapId = null;
  function ensureTrap() { if (!trapId) { trapId = `trap_${states.length}`; A.states.set(trapId, { id: trapId, name: 'trap', x: 80, y: 80, isInitial: false, isFinal: false }); } }
  for (const sid of states) {
    for (const sym of alpha) {
      const k = keyTS(sid, sym);
      const set = A.transitions.get(k);
      if (!set || set.size === 0) { ensureTrap(); A.transitions.set(k, new Set([trapId])); }
      else if (set.size > 1) { const first = set.values().next().value; A.transitions.set(k, new Set([first])); }
    }
  }
  if (trapId) { for (const sym of alpha) A.transitions.set(keyTS(trapId, sym), new Set([trapId])); }
  bumpTransitionsVersion();
}

function complementCurrentDfa() { completeCurrentDfa(); for (const s of A.states.values()) s.isFinal = !s.isFinal; }

function prefixClosureCurrentDfa() {
  const reach = new Set(); const q = [A.initialId];
  while (q.length) { const x = q.shift(); if (!x || reach.has(x)) continue; reach.add(x); for (const [k, dests] of A.transitions.entries()) { const [src] = k.split('|'); if (src !== x) continue; dests.forEach(d => { if (!reach.has(d)) q.push(d); }); } }
  const canReachFinal = new Set(); const rev = new Map();
  for (const [k, dests] of A.transitions.entries()) { const [src, sym] = k.split('|'); if (sym === 'λ') continue; for (const d of dests) { if (!rev.has(d)) rev.set(d, new Set()); rev.get(d).add(src); } }
  const finals = Array.from(A.states.values()).filter(s => s.isFinal).map(s => s.id);
  const stack = finals.slice();
  while (stack.length) { const y = stack.pop(); if (canReachFinal.has(y)) continue; canReachFinal.add(y); const preds = rev.get(y) || new Set(); preds.forEach(p => { if (!canReachFinal.has(p)) stack.push(p); }); }
  for (const s of A.states.values()) s.isFinal = (reach.has(s.id) && canReachFinal.has(s.id));
}

function suffixClosureCurrentDfa() {
  const obj = { alphabet: Array.from(A.alphabet), states: Array.from(A.states.values()).map(s => ({...s})), transitions: Array.from(A.transitions.entries()).map(([k, set]) => [k, Array.from(set)]), initialId: A.initialId };
  const transArr = obj.transitions.map(([k, arr]) => [k, Array.isArray(arr) ? arr.slice() : [arr]]);
  const reachable = new Set(); const q = [obj.initialId];
  while (q.length) { const x = q.shift(); if (!x || reachable.has(x)) continue; reachable.add(x); for (const [k, arr] of transArr) { const [src] = String(k).split('|'); if (src !== x) continue; for (const d of arr) if (!reachable.has(d)) q.push(d); } }
  const S0 = 'S_suffix_start';
  const statesArr = obj.states.map(s => ({...s}));
  statesArr.push({ id: S0, name: 'S', x: 60, y: 60, isInitial: true, isFinal: false });
  statesArr.forEach(s => { if (s.id !== S0) s.isInitial = false; });
  transArr.push([keyTS(S0, 'λ'), Array.from(reachable)]);
  const nfaObj = { alphabet: obj.alphabet, states: statesArr, transitions: transArr, initialId: S0 };
  const dfa = toDFA(nfaObj);
  const alpha = Array.from(new Set(obj.alphabet.filter(s => s !== 'λ')));
  const newStates = Array.from(dfa.states.entries()).map(([id, s], i) => ({ id, name: id, x: 120 + (i%8)*70, y: 120 + Math.floor(i/8)*70, isInitial: (id===dfa.initialId), isFinal: s.isFinal }));
  const newTrans = Array.from(dfa.transitions.entries());
  A.alphabet = new Set(alpha);
  A.states = new Map(newStates.map(s => [s.id, s]));
  A.transitions = new Map(newTrans.map(([k, v]) => [k, new Set(Array.isArray(v) ? v : [v])]));
  A.initialId = dfa.initialId;
  bumpTransitionsVersion();
}

export {
  emitAlgoStep,
  dfaToRegex,
  epsilonClosureMap,
  removeLambdaTransitions,
  convertNfaToDfa,
  toDFA,
  combineNFAs,
  starNFA,
  combineAFDs,
  areEquivalent,
  completeCurrentDfa,
  complementCurrentDfa,
  prefixClosureCurrentDfa,
  suffixClosureCurrentDfa,
};

