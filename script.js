    /* -------------------- Modelo de dados -------------------- */
    const A = {
      alphabet: new Set(),
      states: new Map(),            // id -> {id,name,x,y,isInitial,isFinal}
      nextId: 0,
      selectedStateId: null,
      connectMode: false,
      connectFrom: null,            // id origem na conexão
      transitions: new Map(),       // key: src|sym -> Set(dest)
      initialId: undefined,
    };

    const LS_KEY = window.LS_KEY || 'afd_sim_state_v3';
    const IS_AFN = LS_KEY.startsWith('afn');

    const svg = document.getElementById('svg');
    const gStates = document.getElementById('states');
    const gEdges = document.getElementById('edges');
    const gLabels = document.getElementById('labels');
    const gInitial = document.getElementById('initialPointers');

    const elAlphabetView = document.getElementById('alphabetView');
    const elTransitionsList = document.getElementById('transitionsList');
    const elRegexOut = document.getElementById('regexOut');
    const elRegexMsg = document.getElementById('regexMsg');
    let runHighlight = new Map();
    document.getElementById('unionBtn').onclick = () => importTwoAndCombine('union');
    document.getElementById('intersectionBtn').onclick = () => importTwoAndCombine('intersection');



    /* -------------------- Utilidades -------------------- */
    const keyTS = (s, sym) => `${s}|${sym}`;
    const id = () => `q${A.nextId++}`;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function alphaStr() {
      return Array.from(A.alphabet).join(', ');
    }
    function markSelected(id) {
      const prev = A.selectedStateId;
      A.selectedStateId = id;

      if (prev && prev !== id) {
        const prevCircle = gStates.querySelector(`g.state[data-id="${prev}"] circle`);
        if (prevCircle) prevCircle.style.stroke = '';
      }

      const circle = gStates.querySelector(`g.state[data-id="${id}"] circle`);
      if (circle) circle.style.stroke = 'var(--accent)';
    }
    function ensureUniqueSymbols(str) {
      return Array.from(new Set(str.split(',').map(s => s.trim()).filter(Boolean)));
    }

    /* -------------------- Persistência -------------------- */
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
      localStorage.removeItem(LS_KEY);
      A.alphabet = new Set();
      A.states.clear();
      A.transitions.clear();
      A.nextId = 0; A.initialId = undefined; A.selectedStateId = null; A.connectFrom = null; A.connectMode = false;
      elAlphabetView.textContent = 'Σ = { }';
      renderAll();
    }

    document.getElementById('resetBtn').onclick = () => { resetAll(); };

    /* -------------------- Interações UI básicas -------------------- */
    document.getElementById('setAlphabetBtn').onclick = () => {
      const raw = document.getElementById('alphabetInput').value;
      const syms = ensureUniqueSymbols(raw);
      A.alphabet = new Set(syms);
      elAlphabetView.textContent = `Σ = { ${alphaStr()} }`;
      renderAll(); saveLS();
    };

    document.getElementById('addStateBtn').onclick = () => {
      const s = {
        id: id(), name: '', x: 120 + Math.random() * 320, y: 120 + Math.random() * 220,
        isInitial: A.states.size === 0, isFinal: false
      };
      s.name = s.id;
      A.states.set(s.id, s);
      if (s.isInitial) { A.initialId = s.id; }
      markSelected(s.id);
      renderAll(); saveLS();
    };

    document.getElementById('toggleInitialBtn').onclick = () => {
      if (!A.selectedStateId) return;
      for (const st of A.states.values()) st.isInitial = false;
      A.states.get(A.selectedStateId).isInitial = true;
      A.initialId = A.selectedStateId;
      renderAll(); saveLS();
    };
    document.getElementById('toggleFinalBtn').onclick = () => {
      if (!A.selectedStateId) return;
      const s = A.states.get(A.selectedStateId);
      s.isFinal = !s.isFinal;
      renderAll(); saveLS();
    };
    document.getElementById('deleteSelectedBtn').onclick = () => {
      if (!A.selectedStateId) return;
      const sid = A.selectedStateId;
      for (const [k, set] of Array.from(A.transitions.entries())) {
        const [src] = k.split('|');
        if (src === sid) { A.transitions.delete(k); continue; }
        if (set.has(sid)) {
          set.delete(sid);
          if (set.size === 0) A.transitions.delete(k);
        }
      }
      A.states.delete(sid);
      if (A.initialId === sid) A.initialId = undefined;
      A.selectedStateId = null;
      renderAll(); saveLS();
    };

    document.addEventListener('keydown', ev => {
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
      if (ev.key.toLowerCase() === 'c') {
        if (A.connectMode) {
          A.connectMode = false;
          A.connectFrom = null;
        } else {
          A.connectMode = true;
          A.connectFrom = A.selectedStateId || null;
        }
      }
    });

    /* -------------------- Exportar / Importar -------------------- */
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    exportBtn.onclick = () => {
      const data = snapshot();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url; a.download = `afd-${ts}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    };

    importBtn.onclick = () => importFile.click();

    importFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!confirm('Importar irá substituir o AFD atual. Continuar?')) { importFile.value = ''; return; }
          restoreFromObject(obj);
          saveLS();
          renderAll();
        } catch (err) {
          alert('Arquivo inválido: ' + err.message);
        } finally {
          importFile.value = '';
        }
      };
      reader.readAsText(file);
    };

    function restoreFromObject(obj) {
      // validações básicas
      if (!obj || typeof obj !== 'object') throw new Error('JSON malformado');
      if (!Array.isArray(obj.states) || !Array.isArray(obj.alphabet)) throw new Error('Faltam campos essenciais');
      const ids = new Set(obj.states.map(s => s.id));
      if (obj.initialId && !ids.has(obj.initialId)) throw new Error('initialId inexistente nos estados');
      // reconstrução
      A.alphabet = new Set(obj.alphabet);
      A.states.clear();
      for (const st of obj.states) { A.states.set(st.id, { ...st }); }
      A.initialId = obj.initialId;
      A.nextId = typeof obj.nextId === 'number' ? obj.nextId : (obj.states.length);
      A.transitions = new Map();
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
      elAlphabetView.textContent = `Σ = { ${alphaStr()} }`;
    }

    /* -------------------- Canvas: estados (arrastar) -------------------- */
    function renderStates() {
      gStates.innerHTML = '';
      gInitial.innerHTML = '';
      for (const s of A.states.values()) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('state');
        g.setAttribute('data-id', s.id);

        const r = 24;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', s.x);
        circle.setAttribute('cy', s.y);
        circle.setAttribute('r', r);
        circle.setAttribute('class', 'st-circle' + (s.isFinal ? ' final' : ''));
        const hl = runHighlight.get(s.id);
        if (hl) {
          circle.classList.add(hl);
        } else if (A.selectedStateId === s.id) {
          circle.style.stroke = 'var(--accent)';
        }

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', s.x);
        label.setAttribute('y', s.y + 4);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'st-label');
        label.textContent = s.name;

        g.appendChild(circle);
        g.appendChild(label);

        if (A.selectedStateId === s.id) {
          if (!runHighlight.has(s.id)) {
            circle.style.stroke = 'var(--accent)';
          }
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          handle.setAttribute('d', 'M19.902 4.098a3.75 3.75 0 0 0-5.304 0l-4.5 4.5a3.75 3.75 0 0 0 1.035 6.037.75.75 0 0 1-.646 1.353 5.25 5.25 0 0 1-1.449-8.45l4.5-4.5a5.25 5.25 0 1 1 7.424 7.424l-1.757 1.757a.75.75 0 1 1-1.06-1.06l1.757-1.757a3.75 3.75 0 0 0 0-5.304Zm-7.389 4.267a.75.75 0 0 1 1-.353 5.25 5.25 0 0 1 1.449 8.45l-4.5 4.5a5.25 5.25 0 1 1-7.424-7.424l1.757-1.757a.75.75 0 1 1 1.06 1.06l-1.757 1.757a3.75 3.75 0 1 0 5.304 5.304l4.5-4.5a3.75 3.75 0 0 0-1.035-6.037.75.75 0 0 1-.354-1Z');
          handle.setAttribute('class', 'connect-handle');
          handle.setAttribute('transform', `translate(${s.x + r + 6},${s.y - r - 22}) scale(0.66)`);
          handle.addEventListener('mousedown', ev => {
            ev.stopPropagation();
            ev.preventDefault();
            A.connectMode = true;
            A.connectFrom = s.id;
          });
          g.appendChild(handle);
        }

        gStates.appendChild(g);

        // seta inicial tangente à borda
        if (s.isInitial) {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const ex = s.x - r - 2, ey = s.y; // ponto na borda
          const sx = ex - 42, sy = ey;      // início à esquerda
          p.setAttribute('d', `M ${sx},${sy} L ${ex},${ey}`);
          p.setAttribute('class', 'edge initialPointer');
          p.setAttribute('marker-end', 'url(#arrow)');
          gInitial.appendChild(p);
        }

        // eventos
        g.addEventListener('mousedown', (ev) => {
          if (ev.detail === 2) return; // evitar arrastar ao renomear
          ev.preventDefault();
          const sid = s.id;

          if (A.connectMode) {
            if (!A.connectFrom) {
              A.connectFrom = sid;
              markSelected(sid);
            } else {
              const from = A.connectFrom, to = sid;
              if (!A.alphabet.size) {
                alert('Defina Σ (alfabeto) primeiro.');
                A.connectFrom = null;
                A.connectMode = false;
                return;
              }
              promptSymbolAndCreate(from, to);
              A.connectFrom = null;
              A.connectMode = false;
            }
          } else {
            markSelected(sid);
            startDrag(ev, sid);
          }
        });


        g.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          const newName = prompt('Novo nome do estado:', s.name);
          if (newName && newName.trim() !== '') {
            s.name = newName.trim();
            saveLS();
            renderAll();
          }
        });
      }
    }

    function startDrag(ev, sid) {
      const s = A.states.get(sid);
      const pt = svg.createSVGPoint();
      let startX = s.x, startY = s.y;
      pt.x = ev.clientX; pt.y = ev.clientY;
      const m = svg.getScreenCTM().inverse();
      let p0 = pt.matrixTransform(m);
      function onMove(e) {
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(m);
        const dx = p.x - p0.x, dy = p.y - p0.y;
        s.x = clamp(startX + dx, 30, svg.clientWidth - 30);
        s.y = clamp(startY + dy, 30, svg.clientHeight - 30);
        renderAll();
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        saveLS();
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    /* -------------------- Transições -------------------- */
    function promptSymbolAndCreate(from, to) {
      const syms = Array.from(A.alphabet);
      const sym = window.prompt(`Símbolo da transição ${A.states.get(from).name} → ${A.states.get(to).name}\nΣ = { ${syms.join(', ')} }`);
      if (!sym) return;
      if (!IS_AFN && sym === 'λ') {
        alert('AFDs não permitem transições λ.');
        return;
      }
      if (sym !== 'λ' && !A.alphabet.has(sym)) {
        alert('Símbolo não pertence a Σ. Use λ para transições vazias.');
        return;
      }
      const k = keyTS(from, sym);
      if (!IS_AFN && A.transitions.has(k) && A.transitions.get(k).size > 0) {
        alert('Autômatos determinísticos não permitem mais de uma transição por símbolo.');
        return;
      }
      if (!A.transitions.has(k)) A.transitions.set(k, new Set());
      A.transitions.get(k).add(to);
      renderAll(); saveLS();
    }

    function groupEdges() {
      const map = new Map();
      for (const [k, dests] of A.transitions.entries()) {
        const [src, sym] = k.split('|');
        for (const to of dests) {
          const gk = `${src}|${to}`;
          if (!map.has(gk)) map.set(gk, { src, to, syms: [] });
          map.get(gk).syms.push(sym);
        }
      }
      return Array.from(map.values());
    }

    function edgePathTrimmed(a, b) {
      const SA = A.states.get(a), SB = A.states.get(b);
      const r = 24;
      if (a === b) {
        const x = SA.x, y = SA.y - r - 14;
        return `M ${x - 6},${y} C ${x - 54},${y - 34} ${x + 54},${y - 34} ${x + 6},${y}`;
      }
      const dx = SB.x - SA.x, dy = SB.y - SA.y;
      const mx = (SA.x + SB.x) / 2, my = (SA.y + SB.y) / 2;
      const norm = Math.hypot(dx, dy) || 1;
      const off = 22;
      const nx = -dy / norm * off, ny = dx / norm * off;
      const cx = mx + nx, cy = my + ny;

      let ux = cx - SA.x, uy = cy - SA.y; let un = Math.hypot(ux, uy) || 1; ux /= un; uy /= un;
      const sx = SA.x + ux * (r + 2), sy = SA.y + uy * (r + 2);

      let vx = SB.x - cx, vy = SB.y - cy; let vn = Math.hypot(vx, vy) || 1; vx /= vn; vy /= vn;
      const ex = SB.x - vx * (r + 2), ey = SB.y - vy * (r + 2);

      return `M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`;
    }

    function renderEdges() {
      gEdges.innerHTML = ''; gLabels.innerHTML = '';
      const grouped = groupEdges();
      for (const e of grouped) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', edgePathTrimmed(e.src, e.to));
        path.setAttribute('class', 'edge');
        path.setAttribute('marker-end', 'url(#arrow)');
        gEdges.appendChild(path);

        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('class', 'edge-label');
        const sA = A.states.get(e.src), sB = A.states.get(e.to);
        const mx = (sA.x + sB.x) / 2, my = (sA.y + sB.y) / 2;
        let dx = sB.x - sA.x, dy = sB.y - sA.y;
        const norm = Math.hypot(dx, dy) || 1;
        const nx = -dy / norm * 12, ny = dx / norm * 12;
        if (e.src === e.to) { t.setAttribute('x', sA.x + 2); t.setAttribute('y', sA.y - 44); }
        else { t.setAttribute('x', mx + nx); t.setAttribute('y', my + ny); }
        t.textContent = e.syms.sort().join(' , ');
        gLabels.appendChild(t);
      }
      elTransitionsList.innerHTML = '';
      for (const [k, dests] of A.transitions.entries()) {
        const [src, sym] = k.split('|');
        for (const to of dests) {
          const item = document.createElement('div');
          item.innerHTML = `<span class="kbd">${A.states.get(src)?.name || src}</span> , <span class="kbd">${sym}</span> → <span class="kbd">${A.states.get(to)?.name || to}</span>
      <button class="mini btn-danger" style="margin-left:8px">remover</button>`;
          item.querySelector('button').onclick = () => {
            dests.delete(to);
            if (!dests.size) A.transitions.delete(k);
            renderAll(); saveLS();
          };
          elTransitionsList.appendChild(item);
        }
      }
    }

    /* -------------------- Render geral -------------------- */
    function renderAll() {
      renderStates();
      renderEdges();
    }

    /* -------------------- Conversão DFA → ER (eliminação de estados) -------------------- */
    document.getElementById('buildRegexBtn').onclick = () => {
      const allowEps = document.getElementById('allowEpsilon').checked;
      const res = dfaToRegex(allowEps);
      elRegexOut.textContent = res.output || '';
      elRegexMsg.innerHTML = res.msg || '';
    };

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
          }
        }
        for (let i = 0; i < N; i++) { G[i][k] = null; G[k][i] = null; }
        G[k][k] = null;
      }

      let Rfinal = G[Saux][Faux] || null;
      if (!Rfinal) {
        return { output: '', msg: `<span class="warn">A linguagem reconhecida é vazia (sem caminhos).</span>` };
      }

      Rfinal = simplify(Rfinal);

      if (!allowEps) {
        if (Rfinal.includes('λ')) {
          msg.push(`<span class="warn">A expressão exata envolve λ. Como você desativou “Permitir λ”, tentei remover/absorver λ por álgebra básica; se não foi possível sem alterar a linguagem, o resultado foi omitido.</span>`);
          const noEps = dropEpsilonIfSafe(Rfinal);
          if (noEps === null) {
            return { output: '', msg: msg.join('<br>') };
          } else {
            Rfinal = noEps;
          }
        }
      }

      if (!onlyAllowedTokens(Rfinal)) {
        msg.push(`<span class="warn">A saída usa apenas símbolos de Σ, parênteses, “∪” e “*”. Se vir algo diferente, houve falha na normalização.</span>`);
      }

      return { output: Rfinal, msg: msg.join('<br>') };
    }

    /* -------------------- Álgebra de regex -------------------- */
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
      const parts = new Set(a.split(' ∪ ').concat(b.split(' ∪ ')));
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

    function star(x) {
      if (isNull(x)) return 'λ';
      if (isEps(x)) return 'λ';
      if (x.endsWith('*')) return x;
      return `${needsPar(x)}*`;
    }

    function simplify(r) {
      if (!r) return r;
      const parts = splitTopUnion(r);
      const cleaned = parts.map(cleanFactor);
      const uniq = Array.from(new Set(cleaned));
      return uniq.join(' ∪ ');
    }

    function splitTopUnion(r) {
      const parts = []; let d = 0, cur = '';
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === '(') d++;
        if (c === ')') d--;
        if (d === 0 && r.slice(i, i + 3) === ' ∪ ') {
          parts.push(cur); cur = ''; i += 2; continue;
        }
        cur += c;
      }
      if (cur) parts.push(cur);
      return parts;
    }

    function cleanFactor(f) {
      while (f.startsWith('(') && f.endsWith(')') && balanced(f.slice(1, -1))) f = f.slice(1, -1);
      return f;
    }

    function dropEpsilonIfSafe(r) {
      if (!r.includes('λ')) return r;
      const parts = splitTopUnion(r);
      const hasEps = parts.includes('λ');
      if (hasEps) {
        const others = parts.filter(p => p !== 'λ');
        if (others.length === 0) { return null; }
        const someStar = others.some(p => p.endsWith('*'));
        if (someStar) { return simplify(others.join(' ∪ ')); }
        return null;
      }
      return r.replaceAll('λ', '');
    }
    function onlyAllowedTokens(r) { return /^[A-Za-z0-9 ()∪*]+$/.test(r); }

    /* -------------------- Inicial -------------------- */
    if (!loadLS()) {
      A.alphabet = new Set(['A', 'B']);
      elAlphabetView.textContent = `Σ = { ${alphaStr()} }`;
      const s0 = { id: id(), name: 'q0', x: 180, y: 200, isInitial: true, isFinal: false };
      const s1 = { id: id(), name: 'q1', x: 380, y: 200, isInitial: false, isFinal: true };
      A.states.set(s0.id, s0); A.states.set(s1.id, s1); A.initialId = s0.id; A.selectedStateId = s0.id;
      A.transitions.set(keyTS(s0.id, 'A'), new Set([s1.id]));
      A.transitions.set(keyTS(s1.id, 'B'), new Set([s0.id]));
      saveLS();
    }

    // --- União/Interseção ---

    function removeUnreachableStates(obj) {
      const reachable = new Set();
      function dfs(stateId) {
        if (reachable.has(stateId)) return;
        reachable.add(stateId);
        for (const [k, dest] of obj.transitions) {
          const [from] = k.split('|');
          if (from === stateId) {
            const arr = Array.isArray(dest) ? dest : [dest];
            arr.forEach(dfs);
          }
        }
      }
      dfs(obj.initialId);
      obj.states = obj.states.filter(s => reachable.has(s.id));
      obj.transitions = obj.transitions
        .map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).filter(d => reachable.has(d))])
        .filter(([k, arr]) => arr.length > 0);
      return obj;
    }

    function combineAFDs(obj1, obj2, op) {
      if (JSON.stringify(obj1.alphabet) !== JSON.stringify(obj2.alphabet)) {
        alert('Alfabetos diferentes!');
        return;
      }
      const alpha = obj1.alphabet;
      const states = new Map();
      const transitions = new Map();
      const idMap = new Map();
      let idCounter = 0;

      for (const s1 of obj1.states) {
        for (const s2 of obj2.states) {
          const id = 'q' + (idCounter++);
          const name = `(${s1.name},${s2.name})`;
          const final = op === 'union' ? (s1.isFinal || s2.isFinal) : (s1.isFinal && s2.isFinal);
          states.set(id, { id, name, x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isFinal: final, isInitial: false });
          idMap.set(s1.id + '|' + s2.id, id);
        }
      }
      const initialId = idMap.get(obj1.initialId + '|' + obj2.initialId);
      states.get(initialId).isInitial = true;

      for (const [id, st] of states) {
        const [n1, n2] = st.name.replace(/[()]/g, '').split(',');
        const s1 = obj1.states.find(s => s.name === n1);
        const s2 = obj2.states.find(s => s.name === n2);
        for (const sym of alpha) {
          const dest1 = obj1.transitions.find(([k]) => k === (s1.id + '|' + sym));
          const dest2 = obj2.transitions.find(([k]) => k === (s2.id + '|' + sym));
          if (dest1 && dest2) {
            const destId = idMap.get(dest1[1] + '|' + dest2[1]);
            transitions.set(id + '|' + sym, destId);
          }
        }
      }

      let newObj = { alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()), initialId, nextId: idCounter };
      newObj = removeUnreachableStates(newObj);
      restoreFromObject(newObj);
      saveLS();
      renderAll();
    }

    function importTwoAndCombine(op) {
      let data1 = null, data2 = null;
      const file1 = document.getElementById('importFile1');
      const file2 = document.getElementById('importFile2');
      file1.onchange = () => {
        const reader = new FileReader();
        reader.onload = () => { data1 = JSON.parse(reader.result); file2.click(); };
        reader.readAsText(file1.files[0]);
      };
      file2.onchange = () => {
        const reader = new FileReader();
        reader.onload = () => { data2 = JSON.parse(reader.result); combineAFDs(data1, data2, op); };
        reader.readAsText(file2.files[0]);
      };
      file1.click();
    }

    renderAll();

