// Lógica de UI: renderização do SVG, listeners e operações acionadas por botões
import {
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
  getTransitionsVersion,
  bumpTransitionsVersion,
} from './state.js';

import {
  emitAlgoStep,
  dfaToRegex,
  removeLambdaTransitions,
  convertNfaToDfa,
  combineAFDs,
  combineNFAs,
  starNFA,
  completeCurrentDfa,
  complementCurrentDfa,
  prefixClosureCurrentDfa,
  suffixClosureCurrentDfa,
} from './algorithms.js';
import { pushCrossImport } from './state.js';

// Helper para ligar eventos de click com verificação
function onClick(id, handler) { const el = document.getElementById(id); if (el) el.addEventListener('click', handler); }

// ===== Renderização =====
function getSvgRefs() {
  return {
    svg: document.getElementById('svg'),
    gStates: document.getElementById('states'),
    gEdges: document.getElementById('edges'),
    gLabels: document.getElementById('labels'),
    gInitial: document.getElementById('initialPointers'),
  };
}

function updateAlphabetView() {
  const el = document.getElementById('alphabetView');
  if (el) el.textContent = `Σ = { ${alphaStr()} }`;
}

function clearSelection() { A.selectedIds.clear(); A.selectedStateId = null; A.selectedEdge = null; renderAll(); }
function selectExclusive(id0) { A.selectedIds = new Set([id0]); A.selectedStateId = id0; A.selectedEdge = null; renderStates(); }
function toggleSelect(id0) { if (A.selectedIds.has(id0)) { A.selectedIds.delete(id0); if (A.selectedStateId === id0) A.selectedStateId = null; } else { A.selectedIds.add(id0); A.selectedStateId = id0; } A.selectedEdge = null; renderStates(); }
function markSelected(id0) { selectExclusive(id0); }
function setConnectMode(on, from = null) { A.connectMode = on; A.connectFrom = on ? from : null; document.body.classList.toggle('connect-mode', on); renderStates(); if (A.selectedStateId) markSelected(A.selectedStateId); }
function setSelectedEdge(src, to) { if (src && to) A.selectedEdge = { src, to }; else A.selectedEdge = null; renderEdges(); }
function selectedStates() { const ids = A.selectedIds.size ? Array.from(A.selectedIds) : (A.selectedStateId ? [A.selectedStateId] : []); return ids.map(id => A.states.get(id)).filter(Boolean); }
function showBadge(msg) { const note = document.createElement('div'); note.textContent = msg; note.className = 'badge'; Object.assign(note.style, { position:'fixed', top:'8px', right:'16px', zIndex:500 }); document.body.appendChild(note); setTimeout(() => note.remove(), 1200); }
function ensureUniqueSymbols(str) { return Array.from(new Set(String(str).split(',').map(s => s.trim()).filter(Boolean))); }

function exportCanvasPng() {
  const { svg } = getSvgRefs(); if (!svg) return;
  function collectCssText() {
    let css = ''; try { for (const s of Array.from(document.styleSheets)) { try { const rules = s.cssRules || []; for (const r of Array.from(rules)) css += r.cssText + '\n'; } catch (_) {} } } catch (_) {}
    return css;
  }
  const svgNode = svg.cloneNode(true);
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style'); styleEl.setAttribute('type', 'text/css'); styleEl.textContent = collectCssText() || ''; svgNode.insertBefore(styleEl, svgNode.firstChild);
  const finalize = () => {
    const bboxW = svg.clientWidth; const bboxH = svg.clientHeight;
    svgNode.setAttribute('width', String(bboxW)); svgNode.setAttribute('height', String(bboxH)); svgNode.setAttribute('viewBox', `0 0 ${bboxW} ${bboxH}`);
    const xml = new XMLSerializer().serializeToString(svgNode);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(bboxW * dpr); canvas.height = Math.floor(bboxH * dpr);
      const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#0f172a'; ctx.fillRect(0, 0, bboxW, bboxH);
      ctx.drawImage(img, 0, 0, bboxW, bboxH);
      canvas.toBlob(blob => { const a = document.createElement('a'); const ts = new Date().toISOString().replace(/[:.]/g, '-'); a.download = `canvas-${ts}.png`; a.href = URL.createObjectURL(blob); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); alert('Falha ao gerar PNG.'); };
    img.src = url;
  };
  finalize();
}

function renderStates() {
  const { svg, gStates, gInitial } = getSvgRefs(); if (!svg || !gStates || !gInitial) return;
  gStates.innerHTML = ''; gInitial.innerHTML = '';
  for (const s of A.states.values()) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.classList.add('state'); g.setAttribute('data-id', s.id); if (A.connectMode && A.connectFrom === s.id) g.classList.add('connect-from');
    const r = 24; const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', s.x); circle.setAttribute('cy', s.y); circle.setAttribute('r', r); circle.setAttribute('class', 'st-circle' + (s.isFinal ? ' final' : ''));
    const hl = runHighlight.get(s.id); if (hl) circle.classList.add(hl); else if (A.selectedIds.has(s.id) || A.selectedStateId === s.id) circle.style.stroke = s.isFinal ? 'var(--danger)' : 'var(--ok)';
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.setAttribute('x', s.x); label.setAttribute('y', s.y + 4); label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'st-label'); label.textContent = s.name;
    g.appendChild(circle); g.appendChild(label);
    if (A.selectedStateId === s.id) {
      if (!runHighlight.has(s.id)) circle.style.stroke = s.isFinal ? 'var(--danger)' : 'var(--ok)';
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path'); handle.setAttribute('d', 'M19.902 4.098a3.75 3.75 0 0 0-5.304 0l-4.5 4.5a3.75 3.75 0 0 0 1.035 6.037.75.75 0 0 1-.646 1.353 5.25 5.25 0 0 1-1.449-8.45l4.5-4.5a5.25 5.25 0 1 1 7.424 7.424l-1.757 1.757a.75.75 0 1 1-1.06-1.06l1.757-1.757a3.75 3.75 0 0 0 0-5.304Zm-7.389 4.267a.75.75 0 0 1 1-.353 5.25 5.25 0 0 1 1.449 8.45l-4.5 4.5a5.25 5.25 0 1 1-7.424-7.424l1.757-1.757a.75.75 0 1 1 1.06 1.06l-1.757 1.757a3.75 3.75 0 1 0 5.304 5.304l4.5-4.5a3.75 3.75 0 0 0-1.035-6.037.75.75 0 0 1-.354-1Z'); handle.setAttribute('class', 'connect-handle'); handle.setAttribute('transform', `translate(${s.x + r + 6},${s.y - r - 22}) scale(0.66)`);
      handle.addEventListener('mousedown', ev => { ev.stopPropagation(); ev.preventDefault(); setConnectMode(true, s.id); }); g.appendChild(handle);
      const renameHandle = document.createElementNS('http://www.w3.org/2000/svg', 'path'); renameHandle.setAttribute('d', 'M2.69509 14.7623L1.4333 17.9168C1.27004 18.3249 1.67508 18.73 2.08324 18.5667L5.2377 17.3049C5.74067 17.1037 6.19753 16.8025 6.58057 16.4194L17.4998 5.50072C18.3282 4.67229 18.3282 3.32914 17.4998 2.50072C16.6713 1.67229 15.3282 1.67229 14.4998 2.50071L3.58057 13.4194C3.19752 13.8025 2.89627 14.2593 2.69509 14.7623Z'); renameHandle.setAttribute('class', 'rename-handle'); renameHandle.setAttribute('transform', `translate(${s.x + r + 6},${s.y - r - 44}) scale(0.66)`);
      renameHandle.addEventListener('mousedown', ev => { ev.stopPropagation(); ev.preventDefault(); const newName = prompt('Novo nome do estado:', s.name); if (newName && newName.trim() !== '') { s.name = newName.trim(); saveLS(); renderAll(); } }); g.appendChild(renameHandle);
    }
    g.addEventListener('mousedown', (ev) => {
      if (ev.detail === 2) return;
      const sid = s.id;
      if (A.connectMode) {
        if (!A.connectFrom) { setConnectMode(true, sid); selectExclusive(sid); }
        else { const from = A.connectFrom, to = sid; if (!A.alphabet.size) { alert('Defina Σ (alfabeto) primeiro.'); setConnectMode(false); return; } promptSymbolAndCreate(from, to); setConnectMode(false); }
        return;
      }
      const wasSelected = (A.selectedIds.has(sid) || A.selectedStateId === sid);
      if (ev.shiftKey) { toggleSelect(sid); return; }
      if (!wasSelected) { selectExclusive(sid); }
      startDrag(ev, sid, wasSelected);
    });
    g.addEventListener('dblclick', (ev) => { ev.stopPropagation(); const newName = prompt('Novo nome do estado:', s.name); if (newName && newName.trim() !== '') { s.name = newName.trim(); saveLS(); renderAll(); } });
    gStates.appendChild(g);
    if (s.isInitial) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); const ex = s.x - r - 2, ey = s.y; const sx = ex - 42, sy = ey; p.setAttribute('d', `M ${sx},${sy} L ${ex},${ey}`); p.setAttribute('class', 'edge initialPointer'); p.setAttribute('marker-end', 'url(#arrow)'); gInitial.appendChild(p);
    }
  }
}

function groupEdges() {
  const map = new Map();
  for (const [k, dests] of A.transitions.entries()) {
    const [src, sym] = k.split('|');
    for (const to of dests) { const gk = `${src}|${to}`; if (!map.has(gk)) map.set(gk, { src, to, syms: [] }); map.get(gk).syms.push(sym); }
  }
  return Array.from(map.values());
}
let _edgesCache = { version: -1, grouped: [] };
function groupEdgesCached() { const v = getTransitionsVersion(); if (_edgesCache.version === v) return _edgesCache.grouped; const g = groupEdges(); _edgesCache = { version: v, grouped: g }; return g; }

function edgePathTrimmed(a, b) {
  const SA = A.states.get(a), SB = A.states.get(b); const r = 24;
  if (a === b) { const cx = SA.x, cy = SA.y - r; const sx = cx + r, sy = cy; const ex = cx - r, ey = cy; return `M ${sx},${sy} Q ${cx},${cy - 40} ${ex},${ey}`; }
  const midx = (SA.x + SB.x) / 2, midy = (SA.y + SB.y) / 2; const dx = SB.x - SA.x, dy = SB.y - SA.y; const len = Math.hypot(dx, dy) || 1; const off = 28; const ux = -dy / len * off, uy = dx / len * off; const cx = midx + ux, cy = midy + uy;
  let ux2 = cx - SA.x, uy2 = cy - SA.y; let un = Math.hypot(ux2, uy2) || 1; ux2 /= un; uy2 /= un; const sx = SA.x + ux2 * (r + 2), sy = SA.y + uy2 * (r + 2);
  let vx = SB.x - cx, vy = SB.y - cy; let vn = Math.hypot(vx, vy) || 1; vx /= vn; vy /= vn; const ex = SB.x - vx * (r + 2), ey = SB.y - vy * (r + 2);
  return `M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`;
}

function editEdgeSymbols(src, to) {
  const current = []; for (const [k, dests] of A.transitions.entries()) { const [s, sym] = k.split('|'); if (s === src && dests.has(to)) current.push(sym); }
  const raw = window.prompt(`Símbolos para ${A.states.get(src)?.name || src} → ${A.states.get(to)?.name || to}\nSepare por vírgula.`, current.sort().join(','));
  if (raw === null) return; const list = Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean)));
  const allowed = new Set(list.filter(sym => { if (sym === 'λ') return true; return sym.length === 1 && A.alphabet.has(sym); }));
  for (const sym of current) { if (!allowed.has(sym)) { const k = keyTS(src, sym); const set = A.transitions.get(k); if (set) { set.delete(to); if (!set.size) A.transitions.delete(k); } } }
  for (const sym of allowed) { const k = keyTS(src, sym); if (!A.transitions.has(k)) A.transitions.set(k, new Set()); const set = A.transitions.get(k); if (set.size && !set.has(to)) set.clear(); set.add(to); }
  bumpTransitionsVersion(); renderAll(); saveLS();
}

function renderEdges() {
  const { gEdges, gLabels } = getSvgRefs(); const elTransitionsList = document.getElementById('transitionsList'); if (!gEdges || !gLabels) return;
  gEdges.innerHTML = ''; gLabels.innerHTML = '';
  const grouped = groupEdgesCached();
  for (const e of grouped) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', edgePathTrimmed(e.src, e.to)); path.setAttribute('class', 'edge'); path.setAttribute('marker-end', 'url(#arrow)'); path.dataset.src = e.src; path.dataset.to = e.to; if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) path.classList.add('sel');
    path.addEventListener('click', ev => { ev.stopPropagation(); if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) { setSelectedEdge(null); } else { setSelectedEdge(e.src, e.to); } });
    path.addEventListener('dblclick', ev => { ev.stopPropagation(); editEdgeSymbols(e.src, e.to); }); gEdges.appendChild(path);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('class', 'edge-label'); const sA = A.states.get(e.src), sB = A.states.get(e.to);
    const mx = (sA.x + sB.x) / 2, my = (sA.y + sB.y) / 2; let dx = sB.x - sA.x, dy = sB.y - sA.y; const norm = Math.hypot(dx, dy) || 1; const nx = -dy / norm * 12, ny = dx / norm * 12; if (e.src === e.to) { t.setAttribute('x', sA.x + 2); t.setAttribute('y', sA.y - 44); } else { t.setAttribute('x', mx + nx); t.setAttribute('y', my + ny); }
    t.textContent = e.syms.sort().join(' , ');
    t.addEventListener('click', ev => { ev.stopPropagation(); if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) { setSelectedEdge(null); } else { setSelectedEdge(e.src, e.to); } });
    t.addEventListener('dblclick', ev => { ev.stopPropagation(); editEdgeSymbols(e.src, e.to); }); gLabels.appendChild(t);
  }
  if (elTransitionsList) {
    elTransitionsList.innerHTML = '';
    for (const [k, dests] of A.transitions.entries()) {
      const [src, sym] = k.split('|');
      for (const to of dests) {
        const item = document.createElement('div');
        const s1 = document.createElement('span'); s1.className = 'kbd'; s1.textContent = A.states.get(src)?.name || src;
        const mid1 = document.createTextNode(' , ');
        const s2 = document.createElement('span'); s2.className = 'kbd'; s2.textContent = sym;
        const mid2 = document.createTextNode(' → ');
        const s3 = document.createElement('span'); s3.className = 'kbd'; s3.textContent = A.states.get(to)?.name || to;
        const edit = document.createElement('button'); edit.className = 'mini'; edit.style.marginLeft = '8px'; edit.textContent = 'editar'; edit.title = 'Editar símbolos desta aresta (origem→destino)'; edit.onclick = () => editEdgeSymbols(src, to);
        const btn = document.createElement('button'); btn.className = 'mini btn-danger'; btn.style.marginLeft = '8px'; btn.textContent = 'remover'; btn.title = 'Remover apenas este símbolo';
        btn.onclick = () => { dests.delete(to); if (!dests.size) A.transitions.delete(k); bumpTransitionsVersion(); renderAll(); saveLS(); };
        item.appendChild(s1); item.appendChild(mid1); item.appendChild(s2); item.appendChild(mid2); item.appendChild(s3); item.appendChild(edit); item.appendChild(btn);
        elTransitionsList.appendChild(item);
      }
    }
  }
}

function renderAll() { renderStates(); renderEdges(); updateDfaCompletenessBadge(); if (document.getElementById('deltaTable')) renderDeltaTable(); updateAlphabetView(); }

// Arraste com rAF
function startDrag(ev, sid, wasSelectedOnDown = false) {
  const { svg } = getSvgRefs(); if (!svg) return;
  const movingIds = (A.selectedIds.has(sid) && A.selectedIds.size > 0) ? Array.from(A.selectedIds) : [sid];
  const movingStates = movingIds.map(id => A.states.get(id)).filter(Boolean);
  const pt = svg.createSVGPoint(); const starts = new Map(movingStates.map(s => [s.id, { x: s.x, y: s.y }])); pt.x = ev.clientX; pt.y = ev.clientY; const m = svg.getScreenCTM().inverse(); let p0 = pt.matrixTransform(m); let rafPending = false; let lastClient = { x: ev.clientX, y: ev.clientY }; let __dragMoved = false;
  function tick() { rafPending = false; pt.x = lastClient.x; pt.y = lastClient.y; const p = pt.matrixTransform(m); const dx = p.x - p0.x, dy = p.y - p0.y; for (const ms of movingStates) { const st = starts.get(ms.id); ms.x = clamp(st.x + dx, 30, svg.clientWidth - 30); ms.y = clamp(st.y + dy, 30, svg.clientHeight - 30); } if (Math.abs(dx) > 1 || Math.abs(dy) > 1) __dragMoved = true; renderAll(); }
  function onMove(e) { lastClient.x = e.clientX; lastClient.y = e.clientY; if (!rafPending) { rafPending = true; requestAnimationFrame(tick); } }
  function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (!__dragMoved && wasSelectedOnDown) { if (A.selectedIds.size > 1) { A.selectedIds.delete(sid); if (A.selectedStateId === sid) A.selectedStateId = null; renderStates(); } else { clearSelection(); } } saveLS(); }
  window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
}

function promptSymbolAndCreate(from, to) {
  const syms = Array.from(A.alphabet); const defaultSym = 'λ';
  const raw = window.prompt(`Símbolo(s) da transição ${A.states.get(from).name} → ${A.states.get(to).name}\nSepare por vírgula. Σ = { ${syms.join(', ')} }`, defaultSym);
  if (raw === null) return; const parts = Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean))); if (!parts.length) return;
  const errors = []; let created = 0;
  for (let sym of parts) {
    if (sym === '') continue; if (sym !== 'λ' && (!A.alphabet.has(sym) || sym.length !== 1)) { errors.push(`símbolo inválido: "${sym}"`); continue; }
    const k = keyTS(from, sym); if (!A.transitions.has(k)) A.transitions.set(k, new Set()); A.transitions.get(k).add(to); created++;
  }
  if (created) { bumpTransitionsVersion(); renderAll(); saveLS(); }
  if (errors.length) alert(errors.join('\n'));
}

// δ-table e indicador de completude
function renderDeltaTable() {
  const host = document.getElementById('deltaTable'); if (!host) return; const symbols = Array.from(A.alphabet).filter(s => s !== 'λ'); const states = Array.from(A.states.values()); const byId = new Map(states.map(s => [s.id, s])); const idList = states.map(s => s.id); const table = document.createElement('table'); table.style.width='100%'; table.style.borderCollapse='collapse';
  const thead = document.createElement('thead'); const trh = document.createElement('tr'); const th0 = document.createElement('th'); th0.textContent = 'q'; th0.style.textAlign='left'; trh.appendChild(th0); for (const a of symbols) { const th=document.createElement('th'); th.textContent=a; trh.appendChild(th);} thead.appendChild(trh); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const s of states) {
    const tr = document.createElement('tr'); const tdName = document.createElement('td'); tdName.textContent = s.name || s.id; tr.appendChild(tdName);
    for (const a of symbols) { const td = document.createElement('td'); const k = keyTS(s.id, a); const set = A.transitions.get(k); const cur = set && set.size ? Array.from(set)[0] : ''; const sel = document.createElement('select'); const optEmpty = document.createElement('option'); optEmpty.value=''; optEmpty.textContent='—'; sel.appendChild(optEmpty); for (const id of idList) { const opt=document.createElement('option'); opt.value=id; opt.textContent = byId.get(id)?.name || id; sel.appendChild(opt); } sel.value = cur || ''; sel.addEventListener('change', () => { if (sel.value === '') { A.transitions.delete(k); } else { A.transitions.set(k, new Set([sel.value])); } bumpTransitionsVersion(); renderAll(); saveLS(); }); td.appendChild(sel); tr.appendChild(td); }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody); host.innerHTML=''; host.appendChild(table);
}

function analyzeDfaCompleteness() { const result = { complete: true, nondet: false, missing: 0, lambda: false }; const alpha = Array.from(A.alphabet).filter(s => s !== 'λ'); if (!alpha.length || A.states.size === 0) { result.complete = false; return result; } for (const k of A.transitions.keys()) if (k.endsWith('|λ')) { result.lambda = true; result.complete = false; } for (const s of A.states.values()) { for (const sym of alpha) { const set = A.transitions.get(keyTS(s.id, sym)); if (!set || set.size === 0) { result.missing++; result.complete = false; } else if (set.size > 1) { result.nondet = true; result.complete = false; } } } return result; }
function updateDfaCompletenessBadge() { const wrapper = document.getElementById('canvasWrapper'); if (!wrapper) return; let el = document.getElementById('dfaBadge'); const info = analyzeDfaCompleteness(); if (!el) { el = document.createElement('div'); el.id = 'dfaBadge'; el.className = 'badge'; Object.assign(el.style, { position:'absolute', top:'8px', right:'8px', zIndex:50 }); wrapper.appendChild(el); } if (info.complete) { el.textContent='Completo'; el.style.borderColor='rgba(52, 211, 153, .45)'; el.style.background='rgba(52,211,153,.12)'; } else { let txt='Incompleto'; if (info.lambda) txt+=' (λ)'; if (info.nondet) txt+=' (ND)'; if (info.missing) txt+=` (faltam ${info.missing})`; el.textContent=txt; el.style.borderColor='rgba(251, 113, 133, .45)'; el.style.background='rgba(251,113,133,.12)'; } }

// ===== Ajuda e atalhos =====
function showHelp() {
  const msg = [
    'Ajuda rápida – Interação com o Canvas', '',
    'Seleção:', '• Clique: seleciona um estado; Shift+Clique: seleção múltipla.', '• Shift+Arrastar no vazio: seleção por retângulo (vários estados).', '• Clique na aresta/label: seleciona aresta; Delete remove símbolos (prompt).', '',
    'Edição:', '• C: alterna modo de conexão; clique origem → destino e digite símbolo(s).', '• E: editar estado (renomear) ou aresta (símbolos) da seleção.', '• Duplo-clique no rótulo da aresta: editar símbolos da aresta.', '• Várias transições de uma vez: separe símbolos por vírgula (ex.: a,b,c).', '',
    'Layout:', '• Setas: deslocam a seleção (Shift duplica o passo).', '• Presets: Compacto, Balanceado e Espalhar aplicam auto‑layout.', '• Ctrl+Shift+D: Completar AFD (quando aplicável).', '',
    'Execução: use “Rodar” ou “Modo Run” para simular palavras.',
  ].join('\n');
  alert(msg);
}

// ===== Listeners principais =====
function setupUIEventListeners() {
  // Estados básicos
  onClick('addStateBtn', () => { const s = { id: id(), name: '', x: 120 + Math.random()*320, y: 120 + Math.random()*220, isInitial: A.states.size === 0, isFinal: false }; s.name = s.id; A.states.set(s.id, s); if (s.isInitial) A.initialId = s.id; markSelected(s.id); renderAll(); saveLS(); });
  onClick('toggleInitialBtn', () => { if (!A.selectedStateId) return; for (const st of A.states.values()) st.isInitial = false; A.states.get(A.selectedStateId).isInitial = true; A.initialId = A.selectedStateId; renderAll(); saveLS(); });
  onClick('toggleFinalBtn', () => { if (!A.selectedStateId) return; const s = A.states.get(A.selectedStateId); s.isFinal = !s.isFinal; renderAll(); saveLS(); });
  onClick('deleteSelectedBtn', () => { if (!A.selectedStateId) return; const sid = A.selectedStateId; for (const [k, set] of Array.from(A.transitions.entries())) { const [src] = k.split('|'); if (src === sid) { A.transitions.delete(k); continue; } if (set.has(sid)) { set.delete(sid); if (set.size === 0) A.transitions.delete(k); } } A.states.delete(sid); if (A.initialId === sid) A.initialId = undefined; A.selectedStateId = null; bumpTransitionsVersion(); renderAll(); saveLS(); });
  onClick('editBtn', () => { if (A.selectedEdge) { editEdgeSymbols(A.selectedEdge.src, A.selectedEdge.to); } else if (A.selectedStateId) { const s = A.states.get(A.selectedStateId); const newName = prompt('Novo nome do estado:', s.name); if (newName && newName.trim() !== '') { s.name = newName.trim(); saveLS(); renderAll(); } } else { alert('Selecione um estado ou uma aresta para editar.'); } });
  onClick('resetBtn', () => { if (confirm('Limpar AF atual?')) { resetAll(); updateAlphabetView(); renderAll(); } });

  // Alfabeto
  const setAlphaBtn = document.getElementById('setAlphabetBtn'); if (setAlphaBtn) setAlphaBtn.onclick = () => { const raw = document.getElementById('alphabetInput').value; const syms = ensureUniqueSymbols(raw); A.alphabet = new Set(syms); updateAlphabetView(); renderAll(); saveLS(); };

  // Export/Import
  const exportBtn = document.getElementById('exportBtn'); const importBtn = document.getElementById('importBtn'); const importFile = document.getElementById('importFile'); const TYPE_LABEL = 'afd';
  if (exportBtn) exportBtn.onclick = () => { const data = snapshot(); const json = JSON.stringify(data, null, 2); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const ts = new Date().toISOString().replace(/[:.]/g, '-'); a.href = url; a.download = `${TYPE_LABEL}-${ts}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
  if (importBtn && importFile) { importBtn.onclick = () => importFile.click(); importFile.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const obj = JSON.parse(reader.result); if (!confirm('Importar irá substituir o AFD atual. Continuar?')) { importFile.value = ''; return; } restoreFromObject(obj); saveLS(); renderAll(); } catch (err) { alert('Arquivo inválido: ' + err.message); } finally { importFile.value = ''; } }; reader.readAsText(file); }; }

  // Layout presets
  onClick('layoutPresetCompactBtn', () => applyLayoutPreset('compact'));
  onClick('layoutPresetBalancedBtn', () => applyLayoutPreset('balanced'));
  onClick('layoutPresetSpreadBtn', () => applyLayoutPreset('spread'));

  // Exportar PNG
  onClick('exportPngBtn', () => exportCanvasPng());

  // Operações (AFN λ ou AFD) – escolhe pelo DOM
  const hasAFNops = !!document.getElementById('concatBtn');
  if (hasAFNops) {
    onClick('unionBtn', () => importTwoNFAs('union'));
    onClick('concatBtn', () => importTwoNFAs('concat'));
    onClick('closureBtn', () => importOneNFAStar());
  } else {
    onClick('unionBtn', () => importTwoAndCombine('union'));
    onClick('intersectionBtn', () => importTwoAndCombine('intersection'));
    onClick('differenceBtn', () => importTwoAndCombine('difference'));
    onClick('equivalenceBtn', () => importTwoAndCheckEquivalence());
  }

  // Operações no AFD atual
  onClick('completeDfaBtn', () => { completeCurrentDfa(); renderAll(); saveLS(); });
  onClick('complementBtn', () => { complementCurrentDfa(); renderAll(); saveLS(); });
  onClick('prefixClosureBtn', () => { prefixClosureCurrentDfa(); renderAll(); saveLS(); });
  onClick('suffixClosureBtn', () => { suffixClosureCurrentDfa(); renderAll(); saveLS(); });

  // Conversões AFNλ / AFN → AFD
  onClick('lambdaToNfaBtn', () => { emitAlgoStep('removeLambda', 'start', {}); removeLambdaTransitions(); renderAll(); saveLS(); });
  onClick('nfaToDfaBtn', () => { emitAlgoStep('nfaToDfa', 'start', {}); convertNfaToDfa(); renderAll(); saveLS(); });
  onClick('nfaToDfaOpenBtn', () => { emitAlgoStep('nfaToDfa', 'start', {}); const before = Array.from(A.transitions.keys()).some(k => k.endsWith('|λ')); if (before) { alert('Remova transições λ antes de converter para AFD.'); return; } convertNfaToDfa(); renderAll(); saveLS(); pushCrossImport('index.html'); });

  // AFD → ER
  const buildRegexBtn = document.getElementById('buildRegexBtn'); if (buildRegexBtn) buildRegexBtn.onclick = () => { const allowEps = document.getElementById('allowEpsilon')?.checked || false; const elRegexOut = document.getElementById('regexOut'); const elRegexMsg = document.getElementById('regexMsg'); emitAlgoStep('dfaToRegex', 'start', {}); const res = dfaToRegex(allowEps); if (elRegexOut) elRegexOut.textContent = res.output || ''; if (elRegexMsg) elRegexMsg.innerHTML = res.msg || ''; };

  // Ajuda
  onClick('helpBtn', () => showHelp());

  // Exemplos
  const EXAMPLES = [ { label: 'AFD: termina com a', path: 'examples/afd_ends_with_a.json' }, { label: 'AFD: múltiplos de 3 (binário)', path: 'examples/afd_binary_divisible_by_3.json' }, { label: 'AFD: alterna A/B (simples)', path: 'examples/afd_parity_AB.json' }, { label: 'AFNλ: a ou ab', path: 'examples/afn_lambda_a_or_ab.json' } ];
  (function initExamplesMenu() { const sel = document.getElementById('examplesSelect'); const btn = document.getElementById('loadExampleBtn'); if (!sel || !btn) return; for (const ex of EXAMPLES) { const opt = document.createElement('option'); opt.value = ex.path; opt.textContent = ex.label; sel.appendChild(opt); } btn.addEventListener('click', async () => { const v = sel.value; if (!v) return; try { const res = await fetch(v); const data = await res.json(); restoreFromObject(data); saveLS(); renderAll(); } catch (e) { alert('Falha ao carregar exemplo.'); } }); })();

  // Atalhos de teclado (conexão, edição, mover, deletar)
  document.addEventListener('keydown', ev => {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    if (ev.key.toLowerCase() === 'c') { if (A.connectMode) setConnectMode(false); else setConnectMode(true, A.selectedStateId || null); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'd') { completeCurrentDfa(); ev.preventDefault(); renderAll(); saveLS(); return; }
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key.toLowerCase() === 'e') { const s = A.selectedStateId && A.states.get(A.selectedStateId); if (A.selectedEdge) { editEdgeSymbols(A.selectedEdge.src, A.selectedEdge.to); } else if (s) { const newName = prompt('Novo nome do estado:', s.name); if (newName && newName.trim() !== '') { s.name = newName.trim(); saveLS(); renderAll(); } } ev.preventDefault(); return; }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)) { const ids = A.selectedIds.size ? Array.from(A.selectedIds) : (A.selectedStateId ? [A.selectedStateId] : []); if (ids.length) { const { svg } = getSvgRefs(); const step = 5 * (ev.shiftKey ? 2 : 1); for (const id0 of ids) { const s = A.states.get(id0); if (!s || !svg) continue; if (ev.key === 'ArrowLeft') s.x = clamp(s.x - step, 30, svg.clientWidth - 30); if (ev.key === 'ArrowRight') s.x = clamp(s.x + step, 30, svg.clientWidth - 30); if (ev.key === 'ArrowUp') s.y = clamp(s.y - step, 30, svg.clientHeight - 30); if (ev.key === 'ArrowDown') s.y = clamp(s.y + step, 30, svg.clientHeight - 30); } renderAll(); saveLS(); ev.preventDefault(); } return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { if (A.selectedEdge) { const { src, to } = A.selectedEdge; const syms = []; for (const [k, set] of A.transitions.entries()) { const [from, sym] = k.split('|'); if (from === src && set.has(to)) syms.push(sym); } if (!syms.length) { A.selectedEdge = null; renderAll(); return; } const name = (x) => (A.states.get(x)?.name || x); const input = window.prompt(`Remover quais símbolos para ${name(src)} → ${name(to)}?\nSepare por vírgula ou digite * para todos.\nAtuais: ${syms.sort().join(', ')}`, syms.sort().join(',')); if (input === null) { ev.preventDefault(); return; } const trimmed = input.trim(); let toRemove = []; if (trimmed === '') { ev.preventDefault(); return; } else if (trimmed === '*' || trimmed.toLowerCase() === 'todos' || trimmed.toLowerCase() === 'all') { toRemove = syms.slice(); } else { const asked = Array.from(new Set(trimmed.split(',').map(s => s.trim()).filter(Boolean))); toRemove = asked.filter(s => syms.includes(s)); } if (!toRemove.length) { ev.preventDefault(); return; } let changed = false; for (const sym of toRemove) { const k = keyTS(src, sym); const set = A.transitions.get(k); if (set && set.has(to)) { set.delete(to); if (!set.size) A.transitions.delete(k); changed = true; } } if (changed) { const still = Array.from(A.transitions.entries()).some(([k,set]) => { const [from] = k.split('|'); return from === src && set.has(to); }); if (!still) A.selectedEdge = null; bumpTransitionsVersion(); renderAll(); saveLS(); } ev.preventDefault(); return; } const toDelete = A.selectedIds.size ? Array.from(A.selectedIds) : (A.selectedStateId ? [A.selectedStateId] : []); if (toDelete.length) { for (const sid of toDelete) { for (const [k, set] of Array.from(A.transitions.entries())) { const [src] = k.split('|'); if (src === sid) { A.transitions.delete(k); continue; } if (set.has(sid)) { set.delete(sid); if (set.size === 0) A.transitions.delete(k); } } A.states.delete(sid); if (A.initialId === sid) A.initialId = undefined; } A.selectedIds.clear(); A.selectedStateId = null; bumpTransitionsVersion(); renderAll(); saveLS(); ev.preventDefault(); } }
  });

  // Canvas interactions gerais
  const { svg } = getSvgRefs(); if (svg) {
    svg.addEventListener('click', () => { setSelectedEdge(null); });
    svg.addEventListener('mousedown', (ev) => {
      if (ev.target.closest && ev.target.closest('g.state')) return; if (!ev.shiftKey) return; ev.preventDefault();
      const pt = svg.createSVGPoint(); const m = svg.getScreenCTM().inverse(); pt.x = ev.clientX; pt.y = ev.clientY; let p0 = pt.matrixTransform(m); let x0 = p0.x, y0 = p0.y, x1 = x0, y1 = y0;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); rect.setAttribute('fill', 'rgba(34,211,238,0.15)'); rect.setAttribute('stroke', 'var(--accent)'); rect.setAttribute('stroke-dasharray', '4 2'); rect.setAttribute('rx', '4'); svg.appendChild(rect);
      function update() { const x = Math.min(x0, x1), y = Math.min(y0, y1); const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', w); rect.setAttribute('height', h); }
      function onMove(e) { pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(m); x1 = p.x; y1 = p.y; update(); }
      function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); svg.removeChild(rect); const x = Math.min(x0, x1), y = Math.min(y0, y1); const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0); if (w < 2 && h < 2) return; const newly = []; for (const s of A.states.values()) { if (s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h) newly.push(s.id); } for (const id0 of newly) A.selectedIds.add(id0); if (newly.length) { A.selectedStateId = newly[newly.length - 1]; renderStates(); } }
      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    });
  }

  // Ajuda
  onClick('helpBtn', () => showHelp());
}

// ===== Auto-layout (presets) =====
function autoLayout(params) {
  const { svg } = getSvgRefs(); if (!svg) return; const W = svg.clientWidth || 800, H = svg.clientHeight || 500; const nodes = Array.from(A.states.values()); if (nodes.length <= 1) return; const edges = []; for (const [k, dests] of A.transitions.entries()) { const [src, sym] = k.split('|'); if (sym === 'λ') continue; for (const to of dests) edges.push([src, to]); }
  const pos = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y, vx: 0, vy: 0 }])); const p = params || { it: 200, rep: 8000, K: 0.02, damp: 0.85, center: true }; const K = p.K, REP = p.rep, DAMP = p.damp, ITER = p.it, MAXS = 8;
  function apply() { for (let i=0;i<nodes.length;i++){ for (let j=i+1;j<nodes.length;j++){ const a=pos.get(nodes[i].id), b=pos.get(nodes[j].id); let dx=a.x-b.x, dy=a.y-b.y; let d2=dx*dx+dy*dy; if (d2<0.01){dx=(Math.random()-.5); dy=(Math.random()-.5); d2=dx*dx+dy*dy;} const f=REP/d2; const fx=f*dx, fy=f*dy; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; } } for (const [u,v] of edges){ const a=pos.get(u), b=pos.get(v); if(!a||!b) continue; const dx=b.x-a.x, dy=b.y-a.y; const fx=K*dx, fy=K*dy; a.vx+=fx; a.vy+=fy; b.vx-=fx; b.vy-=fy; } for (const n of nodes){ const p0=pos.get(n.id); p0.vx*=DAMP; p0.vy*=DAMP; const s=Math.min(1, MAXS/(Math.hypot(p0.vx,p0.vy)||1)); n.x = clamp(p0.x + p0.vx*s, 30, W-30); n.y = clamp(p0.y + p0.vy*s, 30, H-30); p0.x=n.x; p0.y=n.y; } }
  for (let t=0;t<ITER;t++) apply(); if (p.center) { const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y); const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys); const cx=(minX+maxX)/2, cy=(minY+maxY)/2; const targetCx=W/2, targetCy=H/2; const dx=targetCx-cx, dy=targetCy-cy; for (const n of nodes){ n.x = clamp(n.x+dx, 30, W-30); n.y = clamp(n.y+dy, 30, H-30);} }
  renderAll(); saveLS();
}

function applyLayoutPreset(name) { const map = { compact:{it:150,rep:3000,K:0.05,damp:0.85,center:true}, balanced:{it:200,rep:8000,K:0.02,damp:0.85,center:true}, spread:{it:250,rep:20000,K:0.01,damp:0.88,center:true} }; const p = map[name] || map.balanced; showBadge(`Preset: ${name}`); autoLayout(p); }

// ===== Import helpers para operações (2 arquivos) =====
function importTwoAndCombine(op) {
  const file1 = document.getElementById('importFile1'); const file2 = document.getElementById('importFile2'); if (!file1 || !file2) { alert('Entrada de arquivo não encontrada'); return; }
  let data1 = null, data2 = null; file1.onchange = () => { const reader = new FileReader(); reader.onload = () => { data1 = JSON.parse(reader.result); file2.click(); }; reader.readAsText(file1.files[0]); };
  file2.onchange = () => { const reader = new FileReader(); reader.onload = () => { data2 = JSON.parse(reader.result); const res = combineAFDs(data1, data2, op); if (res) { restoreFromObject(res); saveLS(); renderAll(); } }; reader.readAsText(file2.files[0]); };
  file1.click();
}

function importTwoAndCheckEquivalence() {
  const file1 = document.getElementById('importFile1'); const file2 = document.getElementById('importFile2'); if (!file1 || !file2) { alert('Entrada de arquivo não encontrada'); return; }
  let data1 = null, data2 = null; file1.onchange = () => { const reader = new FileReader(); reader.onload = () => { data1 = JSON.parse(reader.result); file2.click(); }; reader.readAsText(file1.files[0]); };
  file2.onchange = () => { const reader = new FileReader(); reader.onload = () => { data2 = JSON.parse(reader.result); import('./algorithms.js').then(({ areEquivalent }) => { const eq = areEquivalent(data1, data2); alert(eq ? 'Equivalentes' : 'Não equivalentes'); }); }; reader.readAsText(file2.files[0]); };
  file1.click();
}

function importTwoNFAs(op) {
  const file1 = document.getElementById('importFile1'); const file2 = document.getElementById('importFile2'); if (!file1 || !file2) { alert('Entrada de arquivo não encontrada'); return; }
  let data1 = null, data2 = null; file1.onchange = () => { const reader = new FileReader(); reader.onload = () => { data1 = JSON.parse(reader.result); file2.click(); }; reader.readAsText(file1.files[0]); };
  file2.onchange = () => { const reader = new FileReader(); reader.onload = () => { data2 = JSON.parse(reader.result); const res = combineNFAs(data1, data2, op); if (res) { restoreFromObject(res); saveLS(); renderAll(); } }; reader.readAsText(file2.files[0]); };
  file1.click();
}

function importOneNFAStar() {
  const file1 = document.getElementById('importFile1'); if (!file1) { alert('Entrada de arquivo não encontrada'); return; }
  file1.onchange = () => { const reader = new FileReader(); reader.onload = () => { const data = JSON.parse(reader.result); const res = starNFA(data); if (res) { restoreFromObject(res); saveLS(); renderAll(); } }; reader.readAsText(file1.files[0]); };
  file1.click();
}

export {
  renderStates,
  renderEdges,
  renderAll,
  updateAlphabetView,
  setupUIEventListeners,
  exportCanvasPng,
};
