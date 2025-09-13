// Gramática Regular ↔ Autômato – módulo
import { A, id, keyTS, restoreFromObject, saveLS } from './state.js';
import { renderAll, updateAlphabetView } from './ui.js';
import { convertNfaToDfa } from './algorithms.js';
import { pushCrossImport } from './state.js';

function buildFromGrammar() {
  const ta = document.getElementById('grammarInput'); if (!ta) return; const raw = ta.value; const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean); if (!lines.length) return;
  resetAllLocal();
  const ntMap = new Map(); const alphabet = new Set(); const transitions = []; let startNt = null;
  function ensureState(nt) { if (!ntMap.has(nt)) { const sid = id(); const s = { id: sid, name: nt, x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial: false, isFinal: false }; A.states.set(sid, s); ntMap.set(nt, sid); } return ntMap.get(nt); }
  for (const line of lines) {
    const [lhs, rhs] = line.split('->').map(s => s.trim()); if (!lhs || !rhs) continue; if (!startNt) startNt = lhs; const fromId = ensureState(lhs); const prods = rhs.split('|').map(p => p.trim()).filter(Boolean);
    for (const prod of prods) { if (prod === 'λ' || prod === 'epsilon' || prod === 'ε') { A.states.get(fromId).isFinal = true; continue; } const sym = prod.charAt(0); alphabet.add(sym); const rest = prod.slice(1); if (!rest) { transitions.push([fromId, sym, 'FINAL']); } else { const toId = ensureState(rest); transitions.push([fromId, sym, toId]); } }
  }
  const finalId = id(); A.states.set(finalId, { id: finalId, name: 'F', x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial: false, isFinal: true });
  for (const [src, sym, dest] of transitions) { const to = dest === 'FINAL' ? finalId : dest; const k = keyTS(src, sym); if (!A.transitions.has(k)) A.transitions.set(k, new Set()); A.transitions.get(k).add(to); }
  A.alphabet = alphabet; if (startNt) { const initId = ntMap.get(startNt); A.states.get(initId).isInitial = true; A.initialId = initId; }
  updateAlphabetView(); renderAll(); saveLS();
}

function buildFromGrammarToDfa() { buildFromGrammar(); convertNfaToDfa(); renderAll(); saveLS(); }
function buildFromGrammarToDfaOpen() { buildFromGrammarToDfa(); pushCrossImport('index.html#afd'); }

function exportGrammarFromAF() {
  const withLambda = Array.from(A.transitions.keys()).filter(k => k.endsWith('|λ')); if (withLambda.length) { alert('Remova transições λ (AFNλ → AFN) antes de exportar a gramática.'); return; }
  const nameOf = (id) => (A.states.get(id)?.name || id);
  const nonterminals = new Map(); const used = new Set(); for (const id of A.states.keys()) { let n = nameOf(id); if (!n || used.has(n)) n = id; used.add(n); nonterminals.set(id, n); }
  const prods = new Map(); function addProd(lhs, rhs) { if (!prods.has(lhs)) prods.set(lhs, []); prods.get(lhs).push(rhs); }
  for (const [k, dests] of A.transitions.entries()) { const [src, sym] = k.split('|'); if (sym === 'λ') continue; for (const to of dests) { addProd(nonterminals.get(src), sym + nonterminals.get(to)); if (A.states.get(to)?.isFinal) addProd(nonterminals.get(src), sym); } }
  for (const s of A.states.values()) { if (s.isFinal) addProd(nonterminals.get(s.id), 'λ'); }
  const start = A.initialId ? nonterminals.get(A.initialId) : null; const keys = Array.from(prods.keys()).sort((a,b)=>a.localeCompare(b)); if (start) { const i = keys.indexOf(start); if (i>0) { keys.splice(i,1); keys.unshift(start);} }
  const lines = keys.map(nt => `${nt}->${Array.from(new Set(prods.get(nt))).join('|')}`); const out = lines.join('\n'); const taOut = document.getElementById('grammarOut'); if (taOut) { taOut.value = out || '// Sem produções (verifique se há estados/transições).'; taOut.focus(); taOut.select(); try { document.execCommand('copy'); } catch {} } else { alert(out || 'Sem produções'); }
}

function resetAllLocal() { A.alphabet = new Set(); A.states.clear(); A.transitions.clear(); A.nextId = 0; A.initialId = undefined; }

export { buildFromGrammar, buildFromGrammarToDfa, buildFromGrammarToDfaOpen, exportGrammarFromAF };
