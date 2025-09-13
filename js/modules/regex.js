// ER → AFNλ (Thompson) – módulo
import { A, id, keyTS, bumpTransitionsVersion } from './state.js';
import { renderAll, updateAlphabetView } from './ui.js';

function isLiteral(c) { return /^[A-Za-z0-9]$/.test(c); }
function needsConcat(a, b) { return (isLiteral(a) || a === ')' || a === '*' || a === 'λ') && (isLiteral(b) || b === '(' || b === 'λ'); }

function regexToPostfix(re) {
  re = re.replace(/\s+/g, '').replace(/∪/g, '|').replace(/ε/g, 'λ');
  const tokens = re.split(''); const out = []; const ops = []; const prec = { '|':1, '.':2, '*':3 }; const right = { '*': true }; const t2 = [];
  for (let i=0;i<tokens.length;i++){ const t1=tokens[i]; t2.push(t1); const tnext=tokens[i+1]; if (!tnext) continue; if (needsConcat(t1, tnext)) t2.push('.'); }
  for (const t of t2) {
    if (isLiteral(t) || t === 'λ') out.push(t);
    else if (t === '(') ops.push(t);
    else if (t === ')') { while (ops.length && ops[ops.length-1] !== '(') out.push(ops.pop()); if (!ops.length) throw new Error('Mismatched parens'); ops.pop(); }
    else { while (ops.length && ops[ops.length-1] !== '(' && (prec[ops[ops.length-1]] > prec[t] || (prec[ops[ops.length-1]] === prec[t] && !right[t]))) out.push(ops.pop()); ops.push(t); }
  }
  while (ops.length){ const op = ops.pop(); if (op === '(' || op === ')') throw new Error('Mismatched parens'); out.push(op); }
  return out;
}

function buildFromPostfix(post) {
  const stack = []; const alphabet = new Set();
  function newState() { const sid = id(); const s = { id: sid, name: sid, x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial:false, isFinal:false }; A.states.set(sid, s); return sid; }
  function addTrans(from, sym, to) { const k = keyTS(from, sym); if (!A.transitions.has(k)) A.transitions.set(k, new Set()); A.transitions.get(k).add(to); }
  for (const token of post) {
    if (isLiteral(token) || token === 'λ') { const s = newState(); const f = newState(); addTrans(s, token, f); if (token !== 'λ') alphabet.add(token); stack.push({ start: s, end: f }); }
    else if (token === '.') { const b = stack.pop(); const a = stack.pop(); addTrans(a.end, 'λ', b.start); stack.push({ start: a.start, end: b.end }); }
    else if (token === '|') { const b = stack.pop(); const a = stack.pop(); const s = newState(); const f = newState(); addTrans(s, 'λ', a.start); addTrans(s, 'λ', b.start); addTrans(a.end, 'λ', f); addTrans(b.end, 'λ', f); stack.push({ start: s, end: f }); }
    else if (token === '*') { const a = stack.pop(); const s = newState(); const f = newState(); addTrans(s, 'λ', a.start); addTrans(s, 'λ', f); addTrans(a.end, 'λ', a.start); addTrans(a.end, 'λ', f); stack.push({ start: s, end: f }); }
    else throw new Error('Invalid token');
  }
  if (stack.length !== 1) throw new Error('Invalid ER');
  return { start: stack[0].start, end: stack[0].end, alphabet };
}

function buildFromRegex() {
  const rawEl = document.getElementById('regexInput'); if (!rawEl) return; const raw = (rawEl.value || '').trim(); if (!raw) return;
  try {
    const postfix = regexToPostfix(raw);
    resetNfa();
    const result = buildFromPostfix(postfix);
    A.states.get(result.start).isInitial = true; A.states.get(result.end).isFinal = true; A.initialId = result.start; A.alphabet = result.alphabet; bumpTransitionsVersion(); updateAlphabetView(); renderAll();
  } catch (e) { alert('ER inválida'); }
}

function resetNfa() { A.alphabet = new Set(); A.states.clear(); A.transitions.clear(); A.nextId = 0; A.initialId = undefined; }

export { buildFromRegex };

