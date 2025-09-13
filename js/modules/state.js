// Gerencia o estado global do autômato e persistência (sem tocar na UI)

// Estado principal: Σ, estados, transições e seleções
const A = {
  alphabet: new Set(),
  states: new Map(), // id -> {id,name,x,y,isInitial,isFinal}
  nextId: 0,
  selectedStateId: null,
  selectedIds: new Set(),
  selectedEdge: null,  // {src,to}
  connectMode: false,
  connectFrom: null,
  transitions: new Map(), // key: src|sym -> Set(dest)
  initialId: undefined,
};

// Destaques de execução compartilhados entre módulos (simulação)
const runHighlight = new Map();

// LS_KEY configurável pelo main (não usar window.* aqui no topo)
let LS_KEY = 'afd_sim_state_v3';
function setLsKey(k) { LS_KEY = String(k || 'afd_sim_state_v3'); }
function getLsKey() { return LS_KEY; }
function isAfn() { return LS_KEY.startsWith('afn'); }

// Utilitários
const keyTS = (s, sym) => `${s}|${sym}`;
const id = () => `q${A.nextId++}`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function alphaStr() { return Array.from(A.alphabet).join(', '); }

// Versão de transições para invalidar caches (UI)
let _transitionsVersion = 0;
function bumpTransitionsVersion() { _transitionsVersion++; }
function getTransitionsVersion() { return _transitionsVersion; }

// Persistência
function snapshot() {
  return {
    version: 3,
    alphabet: Array.from(A.alphabet),
    states: Array.from(A.states.values()).map(s => ({ id: s.id, name: s.name, x: s.x, y: s.y, isInitial: s.isInitial, isFinal: s.isFinal })),
    nextId: A.nextId,
    transitions: Array.from(A.transitions.entries()).map(([k, set]) => [k, Array.from(set)]),
    initialId: A.initialId,
  };
}

function saveLS() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot())); } catch (e) { console.warn('localStorage save failed', e); }
}

function loadLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    restoreFromObject(data);
    return true;
  } catch (e) { console.warn('localStorage load failed', e); return false; }
}

function resetAll() {
  try { localStorage.removeItem(LS_KEY); } catch {}
  A.alphabet = new Set();
  A.states.clear();
  A.transitions.clear(); bumpTransitionsVersion();
  A.nextId = 0; A.initialId = undefined; A.selectedStateId = null; A.connectFrom = null; A.connectMode = false;
}

/**
 * Restaura o autômato a partir de um objeto exportado, normalizando Σ.
 * Não interage com a UI; chamadores devem renderizar/atualizar mensagens.
 */
function restoreFromObject(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('JSON malformado');
  if (!Array.isArray(obj.states) || !Array.isArray(obj.alphabet)) throw new Error('Faltam campos essenciais');
  const ids = new Set(obj.states.map(s => s.id));
  if (obj.initialId && !ids.has(obj.initialId)) throw new Error('initialId inexistente nos estados');
  A.alphabet = new Set(
    Array.from(new Set(Array.isArray(obj.alphabet) ? obj.alphabet : []))
      .map(s => String(s).trim())
      .filter(s => s.length === 1)
  );
  A.states.clear();
  for (const st of obj.states) { A.states.set(st.id, { ...st }); }
  A.initialId = obj.initialId;
  A.nextId = typeof obj.nextId === 'number' ? obj.nextId : (obj.states.length);
  A.transitions = new Map();
  const IS_AFN = isAfn();
  if (Array.isArray(obj.transitions)) {
    for (const [k, v] of obj.transitions) {
      const [src, sym] = String(k).split('|');
      if (!ids.has(src)) continue;
      if (!IS_AFN && sym === 'λ') continue;
      const dests = Array.isArray(v) ? v : [v];
      const valid = dests.filter(d => ids.has(d));
      if (!valid.length) continue;
      const chosen = !IS_AFN && valid.length > 1 ? [valid[0]] : valid;
      A.transitions.set(k, new Set(chosen));
    }
  }
  bumpTransitionsVersion();
}

// Cross-page import/export helper
function checkCrossImport() {
  try {
    const raw = localStorage.getItem('AF_CROSS_IMPORT');
    if (!raw) return false;
    const obj = JSON.parse(raw);
    restoreFromObject(obj);
    saveLS();
    localStorage.removeItem('AF_CROSS_IMPORT');
    return true;
  } catch (e) {
    console.warn('cross-import failed', e);
    localStorage.removeItem('AF_CROSS_IMPORT');
    return false;
  }
}

function pushCrossImport(targetPath) {
  try { localStorage.setItem('AF_CROSS_IMPORT', JSON.stringify(snapshot())); } catch (_) {}
  window.location.href = targetPath;
}

export {
  A,
  runHighlight,
  keyTS,
  id,
  clamp,
  alphaStr,
  snapshot,
  saveLS,
  loadLS,
  restoreFromObject,
  resetAll,
  setLsKey,
  getLsKey,
  isAfn,
  bumpTransitionsVersion,
  getTransitionsVersion,
  checkCrossImport,
  pushCrossImport,
};

