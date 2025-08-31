// Constrói um AF a partir de uma gramática regular
function buildFromGrammar() {
  const raw = document.getElementById('grammarInput').value;
  const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return;
  resetAll();
  const ntMap = new Map();
  const alphabet = new Set();
  const transitions = [];
  let startNt = null;

  function ensureState(nt) {
    if (!ntMap.has(nt)) {
      const sid = id();
      const s = { id: sid, name: nt, x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial: false, isFinal: false };
      A.states.set(sid, s);
      ntMap.set(nt, sid);
    }
    return ntMap.get(nt);
  }

  for (const line of lines) {
    const [lhs, rhs] = line.split('->').map(s => s.trim());
    if (!lhs || !rhs) continue;
    if (!startNt) startNt = lhs;
    const fromId = ensureState(lhs);
    const prods = rhs.split('|').map(p => p.trim()).filter(Boolean);
    for (const prod of prods) {
      if (prod === 'λ' || prod === 'epsilon' || prod === 'ε') {
        A.states.get(fromId).isFinal = true;
        continue;
      }
      const sym = prod.charAt(0);
      alphabet.add(sym);
      const rest = prod.slice(1);
      if (!rest) {
        transitions.push([fromId, sym, 'FINAL']);
      } else {
        const toId = ensureState(rest);
        transitions.push([fromId, sym, toId]);
      }
    }
  }

  const finalId = id();
  A.states.set(finalId, { id: finalId, name: 'F', x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial: false, isFinal: true });

  for (const [src, sym, dest] of transitions) {
    const to = dest === 'FINAL' ? finalId : dest;
    const k = keyTS(src, sym);
    if (!A.transitions.has(k)) A.transitions.set(k, new Set());
    A.transitions.get(k).add(to);
  }

  A.alphabet = alphabet;
  elAlphabetView.textContent = `Σ = { ${alphaStr()} }`;

  if (startNt) {
    const initId = ntMap.get(startNt);
    A.states.get(initId).isInitial = true;
    A.initialId = initId;
  }

  renderAll();
  saveLS();
}

document.getElementById('buildFromGrammarBtn').onclick = buildFromGrammar;
