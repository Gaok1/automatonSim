    /*
     * ==================== Visão geral (didática) ====================
     * Este arquivo implementa a lógica central do simulador de autômatos:
     * - Modelo em memória do AF (alfabeto Σ, estados, transições, inicial).
     * - Renderização e interação no canvas (SVG): mover estados, conectar arestas.
     * - Conversões clássicas: AFNλ → AFN, AFN → AFD, AFD → ER e operações entre AFDs.
     * - Persistência: snapshots no localStorage para continuar os estudos depois.
     *
     * Dica: perceba como representamos transições como Map("origem|símbolo" → Set(destinos)).
     * Em AFD o Set tem no máximo 1 destino; em AFN, pode ter vários e incluir λ.
     */
    /* -------------------- Modelo de dados -------------------- */
    const A = {
      alphabet: new Set(),
      states: new Map(),            // id -> {id,name,x,y,isInitial,isFinal}
      nextId: 0,
      selectedStateId: null,
      selectedIds: new Set(),       // multi-selection of states
      selectedEdge: null,           // {src,to} when an edge group is selected
      connectMode: false,
      connectFrom: null,            // id origem na conexão
      transitions: new Map(),       // key: src|sym -> Set(dest)
      initialId: undefined,
    };

    const LS_KEY = window.LS_KEY || 'afd_sim_state_v3';
    const IS_AFN = LS_KEY.startsWith('afn');
    const TYPE_LABEL = IS_AFN ? 'afn' : 'afd';

    const svg = document.getElementById('svg');
    const gStates = document.getElementById('states');
    const gEdges = document.getElementById('edges');
    const gLabels = document.getElementById('labels');
    const gInitial = document.getElementById('initialPointers');

    const elAlphabetView = document.getElementById('alphabetView');
    const elTransitionsList = document.getElementById('transitionsList');
    const elRegexOut = document.getElementById('regexOut');
    const elRegexMsg = document.getElementById('regexMsg');
    // Global highlight map used by run.js to paint states during simulation
    // Use var to ensure it is accessible across scripts (window.runHighlight)
    var runHighlight = new Map();
    // Flag global para detectar se houve arraste entre mousedown/mouseup
    var __dragMoved = false;
    // [Safe wiring] guard against missing elements and adapt by page context
    function onClick(id, handler) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    }
    const hasAFNops = !!document.getElementById('concatBtn');
    // AFN ops (afn.html)
    onClick('unionBtn', () => hasAFNops ? importTwoNFAs('union') : importTwoAndCombine('union'));
    onClick('concatBtn', () => hasAFNops && importTwoNFAs('concat'));
    onClick('closureBtn', () => hasAFNops && importOneNFAStar());
    // AFD ops (index.html, gr.html)
    onClick('intersectionBtn', () => !hasAFNops && importTwoAndCombine('intersection'));
    onClick('differenceBtn', () => !hasAFNops && importTwoAndCombine('difference'));
    onClick('completeDfaBtn', () => !hasAFNops && completeCurrentDfa());
    onClick('complementBtn', () => !hasAFNops && complementCurrentDfa());
    onClick('prefixClosureBtn', () => !hasAFNops && prefixClosureCurrentDfa());
    onClick('suffixClosureBtn', () => !hasAFNops && suffixClosureCurrentDfa());
    onClick('equivalenceBtn', () => !hasAFNops && importTwoAndCheckEquivalence());
    onClick('exportPngBtn', () => exportCanvasPng());
    // Layout/Help buttons (present across pages)
    onClick('helpBtn', () => showHelp());
    onClick('editBtn', () => editSelection());
    onClick('layoutPresetCompactBtn', () => applyLayoutPreset('compact'));
    onClick('layoutPresetBalancedBtn', () => applyLayoutPreset('balanced'));
    onClick('layoutPresetSpreadBtn', () => applyLayoutPreset('spread'));
    onClick('refreshDeltaBtn', () => renderDeltaTable());
    // Examples menu
    const EXAMPLES = [
      { label: 'AFD: termina com a', path: 'examples/afd_ends_with_a.json' },
      { label: 'AFD: múltiplos de 3 (binário)', path: 'examples/afd_binary_divisible_by_3.json' },
      { label: 'AFD: alterna A/B (simples)', path: 'examples/afd_parity_AB.json' },
      { label: 'AFNλ: a ou ab', path: 'examples/afn_lambda_a_or_ab.json' }
    ];
    (function initExamplesMenu() {
      const sel = document.getElementById('examplesSelect');
      const btn = document.getElementById('loadExampleBtn');
      if (!sel || !btn) return;
      for (const ex of EXAMPLES) {
        const opt = document.createElement('option');
        opt.value = ex.path; opt.textContent = ex.label; sel.appendChild(opt);
      }
      btn.addEventListener('click', async () => {
        const v = sel.value; if (!v) return;
        try {
          const res = await fetch(v);
          const data = await res.json();
          restoreFromObject(data);
          saveLS(); renderAll();
        } catch (e) {
          alert('Falha ao carregar exemplo.');
        }
      });
    })();



    /* -------------------- Utilidades -------------------- */
    /** Chave canônica para transições: concatena origem e símbolo. */
    const keyTS = (s, sym) => `${s}|${sym}`;
    const id = () => `q${A.nextId++}`;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function collectCssText() {
      let css = '';
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = sheet.cssRules || [];
            for (const r of Array.from(rules)) css += r.cssText + '\n';
          } catch (_) { /* cross-origin */ }
        }
      } catch (_) {}
      return css;
    }

    function exportCanvasPng() {
      const svgNode = svg.cloneNode(true);
      // embed styling
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.setAttribute('type', 'text/css');
      let cssText = collectCssText();
      styleEl.textContent = cssText || '';
      svgNode.insertBefore(styleEl, svgNode.firstChild);

      const finalize = () => {
        const bboxW = svg.clientWidth; const bboxH = svg.clientHeight;
        svgNode.setAttribute('width', String(bboxW));
        svgNode.setAttribute('height', String(bboxH));
        svgNode.setAttribute('viewBox', `0 0 ${bboxW} ${bboxH}`);
        const xml = new XMLSerializer().serializeToString(svgNode);
        const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(bboxW * dpr);
          canvas.height = Math.floor(bboxH * dpr);
          const ctx = canvas.getContext('2d');
          ctx.scale(dpr, dpr);
          // optional background fill for readability
          ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#0f172a';
          ctx.fillRect(0, 0, bboxW, bboxH);
          ctx.drawImage(img, 0, 0, bboxW, bboxH);
          canvas.toBlob(blob => {
            const a = document.createElement('a');
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `canvas-${ts}.png`;
            a.href = URL.createObjectURL(blob);
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          }, 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); alert('Falha ao gerar PNG.'); };
        img.src = url;
      };

      if (!cssText) {
        try { fetch('style.css').then(r => r.text()).then(t => { styleEl.textContent = t; finalize(); }); return; } catch (_e) { /* ignore */ }
      }
      finalize();
    }

    function alphaStr() {
      return Array.from(A.alphabet).join(', ');
    }
    function clearSelection() {
      A.selectedIds.clear();
      A.selectedStateId = null;
      A.selectedEdge = null;
      renderAll();
    }
    function selectExclusive(id) {
      A.selectedIds = new Set([id]);
      A.selectedStateId = id;
      A.selectedEdge = null;
      renderStates();
    }
    function toggleSelect(id) {
      if (A.selectedIds.has(id)) {
        A.selectedIds.delete(id);
        if (A.selectedStateId === id) A.selectedStateId = null;
      } else {
        A.selectedIds.add(id);
        A.selectedStateId = id;
      }
      A.selectedEdge = null;
      renderStates();
    }
    function markSelected(id) { selectExclusive(id); }
    function setSelectedEdge(src, to) {
      if (src && to) A.selectedEdge = { src, to }; else A.selectedEdge = null;
      renderEdges();
    }
    function ensureUniqueSymbols(str) {
      return Array.from(new Set(str.split(',').map(s => s.trim()).filter(Boolean)));
    }

    // Seleção/utilidades de layout
    function selectedStates() {
      const ids = A.selectedIds.size ? Array.from(A.selectedIds) : (A.selectedStateId ? [A.selectedStateId] : []);
      return ids.map(id => A.states.get(id)).filter(Boolean);
    }
    function showBadge(msg) {
      const note = document.createElement('div');
      note.textContent = msg;
      note.setAttribute('class', 'badge');
      note.style.position = 'fixed'; note.style.top = '8px'; note.style.right = '16px';
      note.style.zIndex = 500; document.body.appendChild(note);
      setTimeout(() => note.remove(), 1200);
    }
    // Snap/alinhamento/distribuição removidos por solicitação do usuário
    function showHelp() {
      const msg = [
        'Ajuda rápida – Interação com o Canvas',
        '',
        'Seleção:',
        '• Clique: seleciona um estado; Shift+Clique: seleção múltipla.',
        '• Shift+Arrastar no vazio: seleção por retângulo (vários estados).',
        '• Clique na aresta/label: seleciona aresta; Delete remove símbolos (prompt).',
        '',
        'Edição:',
        '• C: alterna modo de conexão; clique origem → destino e digite símbolo(s).',
        '• E: editar estado (renomear) ou aresta (símbolos) da seleção.',
        '• Duplo-clique no rótulo da aresta: editar símbolos da aresta.',
        '• Várias transições de uma vez: separe símbolos por vírgula (ex.: a,b,c).',
        '',
        'Layout:',
        '• Setas: deslocam a seleção (Shift duplica o passo).',
        '• Presets: Compacto, Balanceado e Espalhar aplicam auto‑layout (sem Snap/Alinhar/Distribuir).',
        '• Ctrl+Shift+D: Completar AFD (quando aplicável).',
        '',
        'Seções por página:',
        '• AFD: “Operações entre AFDs” e “Operações no AFD atual” ficam logo abaixo do Canvas.',
        '• AFN: “Conversões” e “Operações AFNλ” ficam logo abaixo do Canvas; “Exemplos” fica na lateral esquerda.',
        '• GR: “Conversões”, “Operações entre AFDs” e “Operações no AFD atual” ficam logo abaixo do Canvas; “Exemplos” na esquerda.',
        '',
        'Execução: use “Rodar” ou “Modo Run” para simular palavras.',
      ].join('\n');
      alert(msg);
    }

    // Edição da seleção atual (estado ou aresta)
    function editSelectedState() {
      if (!A.selectedStateId) return;
      const s = A.states.get(A.selectedStateId); if (!s) return;
      const newName = prompt('Novo nome do estado:', s.name);
      if (newName && newName.trim() !== '') {
        s.name = newName.trim();
        saveLS(); renderAll();
      }
    }
    function editSelection() {
      if (A.selectedEdge) {
        editEdgeSymbols(A.selectedEdge.src, A.selectedEdge.to);
      } else if (A.selectedStateId) {
        editSelectedState();
      } else {
        alert('Selecione um estado ou uma aresta para editar.');
      }
    }
    function setConnectMode(on, from = null) {
      A.connectMode = on;
      A.connectFrom = on ? from : null;
      document.body.classList.toggle('connect-mode', on);
      renderStates();
      if (A.selectedStateId) markSelected(A.selectedStateId);
    }

    function emitAlgoStep(algo, step, detail = {}) {
      document.dispatchEvent(new CustomEvent('algoStep', { detail: { algo, step, ...detail } }));
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
    window.pushCrossImport = function(targetPath) {
      try { localStorage.setItem('AF_CROSS_IMPORT', JSON.stringify(snapshot())); } catch (_) {}
      window.location.href = targetPath;
    };

    /* -------------------- Persistência -------------------- */
    /**
     * Monta um objeto serializável com Σ, estados, transições e inicial.
     * Útil para exportar/compartilhar ou transportar entre páginas.
     */
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
      A.transitions.clear(); bumpTransitionsVersion();
      A.nextId = 0; A.initialId = undefined; A.selectedStateId = null; A.connectFrom = null; A.connectMode = false;
      elAlphabetView.textContent = 'Σ = { }';
      document.body.classList.remove('connect-mode');
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
      bumpTransitionsVersion();
      renderAll(); saveLS();
    };

      document.addEventListener('keydown', ev => {
        if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
        if (ev.key.toLowerCase() === 'c') {
          if (A.connectMode) {
            setConnectMode(false);
          } else {
            setConnectMode(true, A.selectedStateId || null);
          }
          return;
        }
        // atalhos de snap removidos
        // Completar AFD (atalho): Ctrl+Shift+D
        if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'd') {
          completeCurrentDfa(); ev.preventDefault(); return;
        }
        // Editar seleção (atalho): E
        if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key.toLowerCase() === 'e') {
          editSelection(); ev.preventDefault(); return;
        }
        // nudge selection with arrows (grid snap removido)
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)) {
          const ids = A.selectedIds.size ? Array.from(A.selectedIds) : (A.selectedStateId ? [A.selectedStateId] : []);
          if (ids.length) {
            const step = 5 * (ev.shiftKey ? 2 : 1);
            for (const id of ids) {
              const s = A.states.get(id); if (!s) continue;
              if (ev.key === 'ArrowLeft') s.x = clamp(s.x - step, 30, svg.clientWidth - 30);
              if (ev.key === 'ArrowRight') s.x = clamp(s.x + step, 30, svg.clientWidth - 30);
              if (ev.key === 'ArrowUp') s.y = clamp(s.y - step, 30, svg.clientHeight - 30);
              if (ev.key === 'ArrowDown') s.y = clamp(s.y + step, 30, svg.clientHeight - 30);
            }
            renderAll(); saveLS(); ev.preventDefault();
          }
          return;
        }
        // align/distribute operations removidas
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
          if (A.selectedEdge) {
            const { src, to } = A.selectedEdge;
            // gather current symbols for this edge group
            const syms = [];
            for (const [k, set] of A.transitions.entries()) {
              const [from, sym] = k.split('|');
              if (from === src && set.has(to)) syms.push(sym);
            }
            if (!syms.length) { A.selectedEdge = null; renderAll(); return; }
            const name = (x) => (A.states.get(x)?.name || x);
            const input = window.prompt(`Remover quais símbolos para ${name(src)} → ${name(to)}?\nSepare por vírgula ou digite * para todos.\nAtuais: ${syms.sort().join(', ')}`, syms.sort().join(','));
            if (input === null) { ev.preventDefault(); return; }
            const trimmed = input.trim();
            let toRemove = [];
            if (trimmed === '' ) { ev.preventDefault(); return; }
            else if (trimmed === '*' || trimmed.toLowerCase() === 'todos' || trimmed.toLowerCase() === 'all') {
              toRemove = syms.slice();
            } else {
              const asked = Array.from(new Set(trimmed.split(',').map(s => s.trim()).filter(Boolean)));
              toRemove = asked.filter(s => syms.includes(s));
            }
            if (!toRemove.length) { ev.preventDefault(); return; }
            let changed = false;
            for (const sym of toRemove) {
              const k = keyTS(src, sym);
              const set = A.transitions.get(k);
              if (set && set.has(to)) {
                set.delete(to);
                if (!set.size) A.transitions.delete(k);
                changed = true;
              }
            }
            if (changed) {
              // keep selection only if still exists at least one symbol connecting src->to
              const still = Array.from(A.transitions.entries()).some(([k,set]) => {
                const [from] = k.split('|'); return from === src && set.has(to);
              });
              if (!still) A.selectedEdge = null;
              bumpTransitionsVersion(); renderAll(); saveLS();
            }
            ev.preventDefault();
            return;
          }
          const toDelete = A.selectedIds.size ? Array.from(A.selectedIds) : (A.selectedStateId ? [A.selectedStateId] : []);
          if (toDelete.length) {
            for (const sid of toDelete) {
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
            }
            A.selectedIds.clear(); A.selectedStateId = null;
            bumpTransitionsVersion();
            renderAll(); saveLS();
            ev.preventDefault();
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
      a.href = url; a.download = `${TYPE_LABEL}-${ts}.json`;
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

    /**
     * Restaura o autômato a partir de um objeto exportado.
     * Normaliza Σ (símbolos únicos; ignora λ em AFD) e reconstrói transições.
     */
    function restoreFromObject(obj) {
      // validações básicas
      if (!obj || typeof obj !== 'object') throw new Error('JSON malformado');
      if (!Array.isArray(obj.states) || !Array.isArray(obj.alphabet)) throw new Error('Faltam campos essenciais');
      const ids = new Set(obj.states.map(s => s.id));
      if (obj.initialId && !ids.has(obj.initialId)) throw new Error('initialId inexistente nos estados');
      // reconstrução
      // normalize alphabet: unique, trimmed, single-char symbols only
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
      bumpTransitionsVersion();
    }

    /* -------------------- Canvas: estados (arrastar) -------------------- */
    function renderStates() {
      gStates.innerHTML = '';
      gInitial.innerHTML = '';
      for (const s of A.states.values()) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('state');
        g.setAttribute('data-id', s.id);
        if (A.connectMode && A.connectFrom === s.id) {
          g.classList.add('connect-from');
        }

        const r = 24;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', s.x);
        circle.setAttribute('cy', s.y);
        circle.setAttribute('r', r);
        circle.setAttribute('class', 'st-circle' + (s.isFinal ? ' final' : ''));
        const hl = runHighlight.get(s.id);
        if (hl) {
          circle.classList.add(hl);
        } else if (A.selectedIds.has(s.id) || A.selectedStateId === s.id) {
          circle.style.stroke = s.isFinal ? 'var(--danger)' : 'var(--ok)';
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
            circle.style.stroke = s.isFinal ? 'var(--danger)' : 'var(--ok)';
          }
          const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          handle.setAttribute('d', 'M19.902 4.098a3.75 3.75 0 0 0-5.304 0l-4.5 4.5a3.75 3.75 0 0 0 1.035 6.037.75.75 0 0 1-.646 1.353 5.25 5.25 0 0 1-1.449-8.45l4.5-4.5a5.25 5.25 0 1 1 7.424 7.424l-1.757 1.757a.75.75 0 1 1-1.06-1.06l1.757-1.757a3.75 3.75 0 0 0 0-5.304Zm-7.389 4.267a.75.75 0 0 1 1-.353 5.25 5.25 0 0 1 1.449 8.45l-4.5 4.5a5.25 5.25 0 1 1-7.424-7.424l1.757-1.757a.75.75 0 1 1 1.06 1.06l-1.757 1.757a3.75 3.75 0 1 0 5.304 5.304l4.5-4.5a3.75 3.75 0 0 0-1.035-6.037.75.75 0 0 1-.354-1Z');
          handle.setAttribute('class', 'connect-handle');
          handle.setAttribute('transform', `translate(${s.x + r + 6},${s.y - r - 22}) scale(0.66)`);
            handle.addEventListener('mousedown', ev => {
              ev.stopPropagation();
              ev.preventDefault();
              setConnectMode(true, s.id);
            });
          g.appendChild(handle);

          const renameHandle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          renameHandle.setAttribute('d', 'M2.69509 14.7623L1.4333 17.9168C1.27004 18.3249 1.67508 18.73 2.08324 18.5667L5.2377 17.3049C5.74067 17.1037 6.19753 16.8025 6.58057 16.4194L17.4998 5.50072C18.3282 4.67229 18.3282 3.32914 17.4998 2.50072C16.6713 1.67229 15.3282 1.67229 14.4998 2.50071L3.58057 13.4194C3.19752 13.8025 2.89627 14.2593 2.69509 14.7623Z');
          renameHandle.setAttribute('class', 'rename-handle');
          renameHandle.setAttribute('transform', `translate(${s.x + r + 6},${s.y - r - 44}) scale(0.66)`);
          renameHandle.addEventListener('mousedown', ev => {
            ev.stopPropagation();
            ev.preventDefault();
            const newName = prompt('Novo nome do estado:', s.name);
            if (newName && newName.trim() !== '') {
              s.name = newName.trim();
              saveLS();
              renderAll();
            }
          });
          g.appendChild(renameHandle);
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
            const sid = s.id;

            if (A.connectMode) {
              if (!A.connectFrom) {
                setConnectMode(true, sid);
                selectExclusive(sid);
              } else {
                const from = A.connectFrom, to = sid;
                if (!A.alphabet.size) {
                  alert('Defina Σ (alfabeto) primeiro.');
                  setConnectMode(false);
                  return;
                }
                promptSymbolAndCreate(from, to);
                setConnectMode(false);
              }
            } else {
              if (ev.shiftKey) {
                // toggle selection without drag
                toggleSelect(sid);
              } else {
                const wasSelected = A.selectedIds.has(sid) || A.selectedStateId === sid;
                if (!wasSelected) selectExclusive(sid);
                __dragMoved = false; // início possível de arraste
                startDrag(ev, sid, wasSelected);
              }
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

    /** Inicia o arraste de um ou mais estados (com rAF para suavizar). */
    function startDrag(ev, sid, wasSelectedOnDown = false) {
      const movingIds = (A.selectedIds.has(sid) && A.selectedIds.size > 0) ? Array.from(A.selectedIds) : [sid];
      const movingStates = movingIds.map(id => A.states.get(id)).filter(Boolean);
      const pt = svg.createSVGPoint();
      const starts = new Map(movingStates.map(s => [s.id, { x: s.x, y: s.y }]));
      pt.x = ev.clientX; pt.y = ev.clientY;
      const m = svg.getScreenCTM().inverse();
      let p0 = pt.matrixTransform(m);
      let rafPending = false;
      let lastClient = { x: ev.clientX, y: ev.clientY };
      function tick() {
        rafPending = false;
        pt.x = lastClient.x; pt.y = lastClient.y;
        const p = pt.matrixTransform(m);
        const dx = p.x - p0.x, dy = p.y - p0.y;
        for (const ms of movingStates) {
          const st = starts.get(ms.id);
          ms.x = clamp(st.x + dx, 30, svg.clientWidth - 30);
          ms.y = clamp(st.y + dy, 30, svg.clientHeight - 30);
        }
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) __dragMoved = true;
        renderAll();
      }
      function onMove(e) {
        lastClient.x = e.clientX; lastClient.y = e.clientY;
        if (!rafPending) { rafPending = true; requestAnimationFrame(tick); }
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        // Clique sem arraste: se já estava selecionado no mousedown, desseleciona
        if (!__dragMoved && wasSelectedOnDown) {
          if (A.selectedIds.size > 1) {
            A.selectedIds.delete(sid);
            if (A.selectedStateId === sid) A.selectedStateId = null;
            renderStates();
          } else {
            clearSelection();
          }
        }
        saveLS();
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    /* -------------------- Transições -------------------- */
    /** Cria arestas perguntando 1+ símbolos (separados por vírgula). */
    function promptSymbolAndCreate(from, to) {
      const syms = Array.from(A.alphabet);
      const defaultSym = IS_AFN ? 'λ' : '';
      const raw = window.prompt(
        `Símbolo(s) da transição ${A.states.get(from).name} → ${A.states.get(to).name}\nSepare por vírgula. Σ = { ${syms.join(', ')} }`,
        defaultSym
      );
      if (raw === null) return;
      const parts = Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean)));
      if (!parts.length) return;

      const errors = [];
      let created = 0;
      for (let sym of parts) {
        if (sym === '' && IS_AFN) sym = 'λ';
        if (sym === '') continue;
        if (!IS_AFN && sym === 'λ') { errors.push(`λ não permitido em AFD`); continue; }
        if (sym !== 'λ' && (!A.alphabet.has(sym) || sym.length !== 1)) {
          errors.push(`símbolo inválido: "${sym}"`);
          continue;
        }
        const k = keyTS(from, sym);
        if (!IS_AFN && A.transitions.has(k) && A.transitions.get(k).size > 0) {
          errors.push(`já existe transição para símbolo "${sym}"`);
          continue;
        }
        if (!A.transitions.has(k)) A.transitions.set(k, new Set());
        A.transitions.get(k).add(to);
        created++;
      }
      if (created) { bumpTransitionsVersion(); renderAll(); saveLS(); }
      if (errors.length) alert(errors.join('\n'));
    }

    /** Agrupa símbolos por par (origem→destino) para desenhar uma única curva. */
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

    // transitions versioning for cached grouping
    let _transitionsVersion = 0;
    function bumpTransitionsVersion() { _transitionsVersion++; }
    let _edgesCache = { version: -1, grouped: [] };
    /** Cache simples para evitar reagrupar arestas quando as transições não mudaram. */
    function groupEdgesCached() {
      if (_edgesCache.version === _transitionsVersion) return _edgesCache.grouped;
      const grouped = groupEdges();
      _edgesCache = { version: _transitionsVersion, grouped };
      return grouped;
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

    // Inline edit of edge symbols
    /** Edita os símbolos exibidos no rótulo de uma aresta (origem→destino). */
    function editEdgeSymbols(src, to) {
      const current = [];
      for (const [k, dests] of A.transitions.entries()) {
        const [s, sym] = k.split('|');
        if (s === src && dests.has(to)) current.push(sym);
      }
      const raw = window.prompt(`Símbolos para ${A.states.get(src)?.name || src} → ${A.states.get(to)?.name || to}\nSepare por vírgula.`, current.sort().join(','));
      if (raw === null) return;
      const list = Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean)));
      const allowed = new Set(list.filter(sym => {
        if (sym === 'λ') return IS_AFN;
        return sym.length === 1 && A.alphabet.has(sym);
      }));
      // remove old
      for (const sym of current) {
        if (!allowed.has(sym)) {
          const k = keyTS(src, sym);
          const set = A.transitions.get(k);
          if (set) { set.delete(to); if (!set.size) A.transitions.delete(k); }
        }
      }
      // add new
      for (const sym of allowed) {
        const k = keyTS(src, sym);
        if (!A.transitions.has(k)) A.transitions.set(k, new Set());
        const set = A.transitions.get(k);
        if (!IS_AFN && set.size && !set.has(to)) set.clear();
        set.add(to);
      }
      bumpTransitionsVersion(); renderAll(); saveLS();
    }

    /** Desenha arestas/labels, seleção e edição (duplo-clique no rótulo). */
    function renderEdges() {
      gEdges.innerHTML = ''; gLabels.innerHTML = '';
      const grouped = groupEdgesCached();
      for (const e of grouped) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', edgePathTrimmed(e.src, e.to));
        path.setAttribute('class', 'edge');
        path.setAttribute('marker-end', 'url(#arrow)');
        path.dataset.src = e.src; path.dataset.to = e.to;
        if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) {
          path.classList.add('sel');
        }
        path.addEventListener('click', ev => { ev.stopPropagation();
          if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) {
            setSelectedEdge(null);
          } else {
            setSelectedEdge(e.src, e.to);
          }
        });
        path.addEventListener('dblclick', ev => { ev.stopPropagation(); editEdgeSymbols(e.src, e.to); });
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
        t.addEventListener('click', ev => { ev.stopPropagation();
          if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) {
            setSelectedEdge(null);
          } else {
            setSelectedEdge(e.src, e.to);
          }
        });
        t.addEventListener('dblclick', ev => { ev.stopPropagation(); editEdgeSymbols(e.src, e.to); });
        gLabels.appendChild(t);
      }
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
          const edit = document.createElement('button'); edit.className = 'mini'; edit.style.marginLeft = '8px'; edit.textContent = 'editar'; edit.title = 'Editar símbolos desta aresta (origem→destino)';
          edit.onclick = () => editEdgeSymbols(src, to);
          const btn = document.createElement('button'); btn.className = 'mini btn-danger'; btn.style.marginLeft = '8px'; btn.textContent = 'remover'; btn.title = 'Remover apenas este símbolo';
          btn.onclick = () => {
            dests.delete(to);
            if (!dests.size) A.transitions.delete(k);
            bumpTransitionsVersion();
            renderAll(); saveLS();
          };
          item.appendChild(s1); item.appendChild(mid1); item.appendChild(s2); item.appendChild(mid2); item.appendChild(s3); item.appendChild(edit); item.appendChild(btn);
          elTransitionsList.appendChild(item);
        }
      }
    }

    // clicking on blank canvas clears selections
    svg.addEventListener('click', () => { setSelectedEdge(null); /* keep state selection */ });

    // Rubber-band selection with Shift+Drag on empty canvas
    svg.addEventListener('mousedown', (ev) => {
      if (ev.target.closest && ev.target.closest('g.state')) return; // state handles its own
      if (!ev.shiftKey) return;
      ev.preventDefault();
      const pt = svg.createSVGPoint();
      const m = svg.getScreenCTM().inverse();
      pt.x = ev.clientX; pt.y = ev.clientY; let p0 = pt.matrixTransform(m);
      let x0 = p0.x, y0 = p0.y, x1 = x0, y1 = y0;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('fill', 'rgba(34,211,238,0.15)');
      rect.setAttribute('stroke', 'var(--accent)');
      rect.setAttribute('stroke-dasharray', '4 2');
      rect.setAttribute('rx', '4');
      svg.appendChild(rect);
      function update() {
        const x = Math.min(x0, x1), y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
      }
      function onMove(e) {
        pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(m);
        x1 = p.x; y1 = p.y; update();
      }
      function onUp(e) {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        svg.removeChild(rect);
        const x = Math.min(x0, x1), y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
        if (w < 2 && h < 2) return; // click only
        const newly = [];
        for (const s of A.states.values()) {
          if (s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h) newly.push(s.id);
        }
        for (const id of newly) A.selectedIds.add(id);
        if (newly.length) { A.selectedStateId = newly[newly.length - 1]; renderStates(); }
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    /* -------------------- Render geral -------------------- */
    function renderAll() {
      renderStates();
      renderEdges();
      updateDfaCompletenessBadge();
      // Auto-refresh δ-table when present (index/gr)
      if (document.getElementById('deltaTable')) renderDeltaTable();
    }

    /* -------------------- Conversão DFA → ER (eliminação de estados) -------------------- */
    document.getElementById('buildRegexBtn').onclick = () => {
      const allowEps = document.getElementById('allowEpsilon').checked;
      emitAlgoStep('dfaToRegex', 'start', {});
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
            emitAlgoStep('dfaToRegex', 'transition', {
              from: fromId,
              to: toId,
              via: states[k],
              regex: via,
              fromName,
              toName
            });
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
    // Prioritize cross-import: if present, replace canvas immediately
    if (checkCrossImport()) {
      // already restored and saved by checkCrossImport()
    } else if (!loadLS()) {
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

    /** Remove estados inalcançáveis após construções/combinações. */
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

    function nfaAcceptsEmpty(obj) {
      const trans = new Map(
        (obj.transitions || []).map(([k, v]) => [k, new Set(Array.isArray(v) ? v : [v])])
      );
      const closure = epsilonClosureMap(new Set([obj.initialId]), trans);
      const finals = new Set(obj.states.filter(s => s.isFinal).map(s => s.id));
      for (const q of closure) if (finals.has(q)) return true;
      return false;
    }

    /** União/Concatenação de AFNs via construção com λ-transições auxiliares. */
    function combineNFAs(obj1, obj2, op) {
      const alpha = Array.from(new Set([...(obj1.alphabet || []), ...(obj2.alphabet || [])]));
      const states = new Map();
      const transitions = new Map();
      const map1 = new Map();
      const map2 = new Map();
      let idCounter = 0;
      const nid = () => 'q' + (idCounter++);

      function clone(obj, map) {
        for (const s of obj.states) {
          const id = nid();
          states.set(id, { id, name: s.name, x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isFinal: s.isFinal, isInitial: false });
          map.set(s.id, id);
        }
        for (const [k, v] of obj.transitions) {
          const [src, sym] = String(k).split('|');
          if (!map.has(src)) continue;
          const arr = Array.isArray(v) ? v : [v];
          const key = keyTS(map.get(src), sym);
          const set = transitions.get(key) || new Set();
          arr.forEach(d => {
            if (map.has(d)) set.add(map.get(d));
          });
          if (set.size) transitions.set(key, set);
        }
      }

      clone(obj1, map1);
      clone(obj2, map2);

      let initialId = '';
      if (op === 'union') {
        initialId = nid();
        const initFinal = nfaAcceptsEmpty(obj1) || nfaAcceptsEmpty(obj2);
        states.set(initialId, {
          id: initialId,
          name: 'init',
          x: Math.random() * 500 + 50,
          y: Math.random() * 300 + 50,
          isInitial: true,
          isFinal: initFinal
        });
        const set = new Set([map1.get(obj1.initialId), map2.get(obj2.initialId)]);
        transitions.set(keyTS(initialId, 'λ'), set);
      } else if (op === 'concat') {
        initialId = map1.get(obj1.initialId);
        states.get(initialId).isInitial = true;
        const init2 = map2.get(obj2.initialId);
        const acceptsEmpty2 = nfaAcceptsEmpty(obj2);
        for (const s of obj1.states) {
          const id = map1.get(s.id);
          states.get(id).isFinal = acceptsEmpty2 && s.isFinal;
          if (s.isFinal) {
            const key = keyTS(id, 'λ');
            const set = transitions.get(key) || new Set();
            set.add(init2);
            transitions.set(key, set);
          }
        }
      }

      for (const s of obj2.states) {
        const id = map2.get(s.id);
        states.get(id).isFinal = s.isFinal;
      }

      let newObj = {
        alphabet: alpha,
        states: Array.from(states.values()),
        transitions: Array.from(transitions.entries()).map(([k, set]) => [k, Array.from(set)]),
        initialId,
        nextId: idCounter
      };
      newObj = removeUnreachableStates(newObj);
      restoreFromObject(newObj);
      saveLS();
      renderAll();
    }

    /** Fecho de Kleene (estrela) adicionando novo inicial/final e λ-ciclos. */
    function starNFA(obj) {
      const alpha = Array.from(new Set(obj.alphabet || []));
      const states = new Map();
      const transitions = new Map();
      const map = new Map();
      let idCounter = 0;
      const nid = () => 'q' + (idCounter++);

      for (const s of obj.states) {
        const id = nid();
        states.set(id, { id, name: s.name, x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isFinal: s.isFinal, isInitial: false });
        map.set(s.id, id);
      }
      for (const [k, v] of obj.transitions) {
        const [src, sym] = String(k).split('|');
        const arr = Array.isArray(v) ? v : [v];
        const key = keyTS(map.get(src), sym);
        const set = transitions.get(key) || new Set();
        arr.forEach(d => set.add(map.get(d)));
        transitions.set(key, set);
      }

      const initOld = map.get(obj.initialId);
      const newInit = nid();
      states.set(newInit, { id: newInit, name: 'init', x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isInitial: true, isFinal: true });
      transitions.set(keyTS(newInit, 'λ'), new Set([initOld]));
      for (const s of obj.states) {
        if (s.isFinal) {
          const id = map.get(s.id);
          const key = keyTS(id, 'λ');
          const set = transitions.get(key) || new Set();
          set.add(initOld);
          set.add(newInit);
          transitions.set(key, set);
        }
      }

      let newObj = {
        alphabet: alpha,
        states: Array.from(states.values()),
        transitions: Array.from(transitions.entries()).map(([k, set]) => [k, Array.from(set)]),
        initialId: newInit,
        nextId: idCounter
      };
      newObj = removeUnreachableStates(newObj);
      restoreFromObject(newObj);
      saveLS();
      renderAll();
    }

    function importTwoNFAs(op) {
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
        reader.onload = () => { data2 = JSON.parse(reader.result); combineNFAs(data1, data2, op); };
        reader.readAsText(file2.files[0]);
      };
      file1.click();
    }

    function importOneNFAStar() {
      const file1 = document.getElementById('importFile1');
      file1.onchange = () => {
        const reader = new FileReader();
        reader.onload = () => { const data = JSON.parse(reader.result); starNFA(data); };
        reader.readAsText(file1.files[0]);
      };
      file1.click();
    }

    /** Lê e completa um AFD com estado armadilha, se necessário (para operações). */
    function readDfa(obj) {
      const states = new Map(obj.states.map(s => [s.id, { ...s }]));
      const trans = new Map();
      for (const [k, v] of (obj.transitions || [])) {
        const [src, sym] = String(k).split('|');
        const dest = Array.isArray(v) ? v[0] : v; // DFA: single destination
        if (dest) trans.set(keyTS(src, sym), dest);
      }
      // ensure completeness by adding trap if needed
      const alphabet = [...(obj.alphabet || [])].filter(s => s !== 'λ');
      let trap = null;
      function ensureTrap() {
        if (!trap) { trap = '__trap__'; states.set(trap, { id: trap, name: 'trap', isFinal: false }); }
      }
      // fill missing transitions
      for (const sid of states.keys()) {
        for (const sym of alphabet) {
          const k = keyTS(sid, sym);
          if (!trans.has(k)) { ensureTrap(); trans.set(k, trap); }
        }
      }
      if (trap) {
        for (const sym of alphabet) trans.set(keyTS(trap, sym), trap);
      }
      return { states, trans, alphabet, initialId: obj.initialId };
    }

    /** Produto de AFDs (união/interseção/diferença) por BFS em pares de estados. */
    function combineAFDs(obj1, obj2, op) {
      if (JSON.stringify(obj1.alphabet) !== JSON.stringify(obj2.alphabet)) {
        alert('Alfabetos diferentes!');
        return;
      }
      const A1 = readDfa(obj1);
      const A2 = readDfa(obj2);
      const alpha = A1.alphabet;

      const pairKey = (p1, p2) => `${p1}|${p2}`;
      const states = new Map();
      const idMap = new Map();
      const transitions = new Map();
      let idCounter = 0;
      const nid = () => 'q' + (idCounter++);

      function ensurePair(p1, p2) {
        const k = pairKey(p1, p2);
        if (idMap.has(k)) return idMap.get(k);
        const id = nid();
        const s1 = A1.states.get(p1), s2 = A2.states.get(p2);
        let final = false;
        if (op === 'union') final = (s1.isFinal || s2.isFinal);
        else if (op === 'intersection') final = (s1.isFinal && s2.isFinal);
        else if (op === 'difference') final = (s1.isFinal && !s2.isFinal);
        const st = { id, name: `(${s1.name},${s2.name})`, x: 100 + (idCounter % 8) * 70, y: 140 + Math.floor(idCounter / 8) * 70, isFinal: final, isInitial: false };
        idMap.set(k, id);
        states.set(id, st);
        return id;
      }

      const q0 = ensurePair(A1.initialId, A2.initialId);
      states.get(q0).isInitial = true;

      const queue = [[A1.initialId, A2.initialId]];
      const seen = new Set();
      while (queue.length) {
        const [p1, p2] = queue.shift();
        const key = pairKey(p1, p2);
        if (seen.has(key)) continue; seen.add(key);
        const fromId = ensurePair(p1, p2);
        for (const sym of alpha) {
          const d1 = A1.trans.get(keyTS(p1, sym));
          const d2 = A2.trans.get(keyTS(p2, sym));
          if (d1 && d2) {
            const toId = ensurePair(d1, d2);
            transitions.set(keyTS(fromId, sym), toId);
            queue.push([d1, d2]);
          }
        }
      }

      let newObj = { alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()), initialId: q0, nextId: idCounter };
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

    function importTwoAndCheckEquivalence() {
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
        reader.onload = () => {
          data2 = JSON.parse(reader.result);
          const eq = areEquivalent(data1, data2);
          alert(eq ? 'Os autômatos são equivalentes!' : 'Os autômatos não são equivalentes.');
        };
        reader.readAsText(file2.files[0]);
      };
      file1.click();
    }

    /** Determinização genérica (com ε-fecho) para AFD utilitária para outras operações. */
    function toDFA(obj) {
      const states = new Map(obj.states.map(s => [s.id, s]));
      const trans = new Map(obj.transitions.map(([k, arr]) => [k, new Set(Array.isArray(arr) ? arr : [arr])]));
      const alphabet = new Set(obj.alphabet.filter(sym => sym !== 'λ'));
      const dfa = { alphabet, states: new Map(), transitions: new Map(), initialId: '' };

      function subsetKey(set) { return Array.from(set).sort().join(','); }

      const subsetMap = new Map();
      const queue = [];
      function addState(set) {
        const key = subsetKey(set);
        if (!subsetMap.has(key)) {
          const id = 'S' + subsetMap.size;
          subsetMap.set(key, id);
          const isFinal = [...set].some(x => states.get(x)?.isFinal);
          dfa.states.set(id, { id, isFinal });
          queue.push(set);
        }
        return subsetMap.get(key);
      }

      const startSet = epsilonClosureMap(new Set([obj.initialId]), trans);
      dfa.initialId = addState(startSet);

      while (queue.length) {
        const set = queue.shift();
        const fromId = addState(set);
        for (const sym of alphabet) {
          const dest = new Set();
          for (const s of set) {
            const k = keyTS(s, sym);
            if (trans.has(k)) {
              for (const d of trans.get(k)) {
                epsilonClosureMap(new Set([d]), trans).forEach(x => dest.add(x));
              }
            }
          }
          if (dest.size) {
            const toId = addState(dest);
            dfa.transitions.set(keyTS(fromId, sym), toId);
          }
        }
      }

      return dfa;
    }

    // --- AFD utilities on current canvas ---
    function completeCurrentDfa() {
      // ensure DFA: no λ and single dest per symbol
      if (Array.from(A.transitions.keys()).some(k => k.endsWith('|λ'))) {
        alert('Remova transições λ antes de completar o AFD.');
        return;
      }
      const alpha = Array.from(A.alphabet);
      if (!alpha.length) { alert('Defina Σ antes.'); return; }
      // Detect non-determinism and ask for confirmation
      const ndSamples = [];
      for (const sid of A.states.keys()) {
        for (const sym of alpha) {
          const set = A.transitions.get(keyTS(sid, sym));
          if (set && set.size > 1) {
            const name = A.states.get(sid)?.name || sid;
            const destNames = Array.from(set).map(d => A.states.get(d)?.name || d).join(', ');
            ndSamples.push(`${name}, ${sym} → {${destNames}}`);
            if (ndSamples.length >= 5) break;
          }
        }
        if (ndSamples.length >= 5) break;
      }
      if (ndSamples.length) {
        const ok = confirm(
          'Foram detectadas transições não-determinísticas (mesmo estado e símbolo com vários destinos).\n' +
          'Exemplos:\n  ' + ndSamples.join('\n  ') +
          '\n\nDeseja FORÇAR DETERMINISMO agora?\nIsso manterá apenas UM destino arbitrário por conflito.'
        );
        if (!ok) return;
      }
      let trapId = null;
      // detect existing trap by name
      for (const s of A.states.values()) { if (s.name.toLowerCase() === 'trap' || s.name === '⊥') trapId = s.id; }
      function ensureTrap() {
        if (trapId) return trapId;
        const idn = id();
        A.states.set(idn, { id: idn, name: 'trap', x: 80, y: 60, isInitial: false, isFinal: false });
        trapId = idn; return trapId;
      }
      for (const sid of A.states.keys()) {
        for (const sym of alpha) {
          const k = keyTS(sid, sym);
          const set = A.transitions.get(k);
          if (!set || set.size === 0) {
            const t = ensureTrap();
            A.transitions.set(k, new Set([t]));
          } else if (set.size > 1) {
            // merge to arbitrary single (determinismo forçado)
            const first = set.values().next().value; A.transitions.set(k, new Set([first]));
          }
        }
      }
      if (trapId) {
        for (const sym of alpha) {
          A.transitions.set(keyTS(trapId, sym), new Set([trapId]));
        }
      }
      bumpTransitionsVersion(); renderAll(); saveLS();
    }

    function complementCurrentDfa() {
      completeCurrentDfa();
      for (const s of A.states.values()) s.isFinal = !s.isFinal;
      renderAll(); saveLS();
    }

    function prefixClosureCurrentDfa() {
      // states on some path from initial to a final become final
      const reach = new Set();
      const q = [A.initialId];
      while (q.length) {
        const x = q.shift(); if (!x || reach.has(x)) continue; reach.add(x);
        for (const [k, dests] of A.transitions.entries()) {
          const [src] = k.split('|'); if (src !== x) continue;
          dests.forEach(d => { if (!reach.has(d)) q.push(d); });
        }
      }
      const canReachFinal = new Set();
      const rev = new Map();
      for (const [k, dests] of A.transitions.entries()) {
        const [src, sym] = k.split('|'); if (sym === 'λ') continue;
        for (const d of dests) {
          if (!rev.has(d)) rev.set(d, new Set());
          rev.get(d).add(src);
        }
      }
      const finals = Array.from(A.states.values()).filter(s => s.isFinal).map(s => s.id);
      const stack = finals.slice();
      while (stack.length) {
        const y = stack.pop(); if (canReachFinal.has(y)) continue; canReachFinal.add(y);
        const preds = rev.get(y) || new Set(); preds.forEach(p => { if (!canReachFinal.has(p)) stack.push(p); });
      }
      for (const s of A.states.values()) s.isFinal = (reach.has(s.id) && canReachFinal.has(s.id));
      renderAll(); saveLS();
    }

    function suffixClosureCurrentDfa() {
      // build NFA with new initial S0 ->λ all states reachable from initial
      const obj = snapshot();
      const statesArr = obj.states.map(s => ({...s}));
      const transArr = obj.transitions.map(([k, arr]) => [k, Array.isArray(arr) ? arr.slice() : [arr]]);
      const reachable = new Set();
      const q = [obj.initialId];
      while (q.length) {
        const x = q.shift(); if (!x || reachable.has(x)) continue; reachable.add(x);
        for (const [k, arr] of transArr) {
          const [src] = String(k).split('|'); if (src !== x) continue;
          for (const d of arr) if (!reachable.has(d)) q.push(d);
        }
      }
      const S0 = 'S_suffix_start';
      statesArr.push({ id: S0, name: 'S', x: 60, y: 60, isInitial: true, isFinal: false });
      // clear previous initial flags
      statesArr.forEach(s => { if (s.id !== S0) s.isInitial = false; });
      transArr.push([keyTS(S0, 'λ'), Array.from(reachable)]);
      const nfaObj = { alphabet: obj.alphabet, states: statesArr, transitions: transArr, initialId: S0 };
      const dfa = toDFA(nfaObj);
      // materialize DFA into current canvas
      const alpha = Array.from(new Set(obj.alphabet.filter(s => s !== 'λ')));
      const newStates = Array.from(dfa.states.entries()).map(([id, s], i) => ({ id, name: id, x: 120 + (i%8)*70, y: 120 + Math.floor(i/8)*70, isInitial: (id===dfa.initialId), isFinal: s.isFinal }));
      const newTrans = Array.from(dfa.transitions.entries());
      restoreFromObject({ alphabet: alpha, states: newStates, transitions: newTrans, initialId: dfa.initialId, nextId: newStates.length });
      saveLS(); renderAll();
    }

    // ============== Auto-layout (spring/force simplistic) ==============
    function readLayoutParams() {
      // Inputs podem não existir; retornamos defaults
      const getNum = (id, def, min, max) => {
        const el = document.getElementById(id);
        let v = el ? parseFloat(el.value) : def;
        if (isNaN(v)) v = def; if (min != null) v = Math.max(min, v); if (max != null) v = Math.min(max, v);
        return v;
      };
      const it = Math.round(getNum('layoutIterInput', 200, 10, 3000));
      const rep = getNum('layoutRepInput', 8000, 0, 50000);
      const K = getNum('layoutKInput', 0.02, 0, 1);
      const damp = getNum('layoutDampInput', 0.85, 0.5, 0.99);
      const center = !!(document.getElementById('layoutCenterInput')?.checked);
      return { it, rep, K, damp, center };
    }

    function autoLayout(params) {
      const W = svg.clientWidth || 800, H = svg.clientHeight || 500;
      const nodes = Array.from(A.states.values()); if (nodes.length <= 1) return;
      const edges = [];
      for (const [k, dests] of A.transitions.entries()) {
        const [src, sym] = k.split('|'); if (sym === 'λ') continue;
        for (const to of dests) edges.push([src, to]);
      }
      const pos = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y, vx: 0, vy: 0 }]));
      const p = params || readLayoutParams();
      const K = p.K, REP = p.rep, DAMP = p.damp, ITER = p.it, MAXS = 8;
      function apply() {
        // repulsive between all nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = pos.get(nodes[i].id), b = pos.get(nodes[j].id);
            let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx*dx + dy*dy; if (d2 < 0.01) { dx = (Math.random()-.5); dy=(Math.random()-.5); d2 = dx*dx+dy*dy; }
            const f = REP / d2; const fx = f * dx, fy = f * dy;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          }
        }
        // attractive along edges
        for (const [u, v] of edges) {
          const a = pos.get(u), b = pos.get(v); if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y; const dist = Math.hypot(dx, dy) || 1;
          const fx = K * dx, fy = K * dy; a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        // integrate
        for (const n of nodes) {
          const p = pos.get(n.id); p.vx *= DAMP; p.vy *= DAMP;
          const s = Math.min(1, MAXS / (Math.hypot(p.vx, p.vy) || 1));
          n.x = clamp(p.x + p.vx * s, 30, W - 30);
          n.y = clamp(p.y + p.vy * s, 30, H - 30);
          p.x = n.x; p.y = n.y;
        }
      }
      for (let t = 0; t < ITER; t++) apply();
      if (p.center) {
        // center graph bounding box
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const targetCx = W / 2, targetCy = H / 2;
        const dx = targetCx - cx, dy = targetCy - cy;
        for (const n of nodes) { n.x = clamp(n.x + dx, 30, W - 30); n.y = clamp(n.y + dy, 30, H - 30); }
      }
      renderAll(); saveLS();
    }

    function applyLayoutPreset(name) {
      const map = {
        compact: { it: 150, rep: 3000, K: 0.05, damp: 0.85, center: true },
        balanced: { it: 200, rep: 8000, K: 0.02, damp: 0.85, center: true },
        spread: { it: 250, rep: 20000, K: 0.01, damp: 0.88, center: true },
      };
      const p = map[name] || map.balanced;
      showBadge(`Preset: ${name}`);
      autoLayout(p);
    }

    // ============== δ-table (DFA) ==============
    function renderDeltaTable() {
      const host = document.getElementById('deltaTable'); if (!host) return;
      // only for DFA context (ignore λ columns)
      const symbols = Array.from(A.alphabet).filter(s => s !== 'λ');
      const states = Array.from(A.states.values());
      const byId = new Map(states.map(s => [s.id, s]));
      const idList = states.map(s => s.id);
      const table = document.createElement('table');
      table.style.width = '100%'; table.style.borderCollapse = 'collapse';
      const thead = document.createElement('thead'); const trh = document.createElement('tr');
      const th0 = document.createElement('th'); th0.textContent = 'q'; th0.style.textAlign='left'; trh.appendChild(th0);
      for (const a of symbols) { const th = document.createElement('th'); th.textContent = a; trh.appendChild(th); }
      thead.appendChild(trh); table.appendChild(thead);
      const tbody = document.createElement('tbody');
      for (const s of states) {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td'); tdName.textContent = s.name || s.id; tr.appendChild(tdName);
        for (const a of symbols) {
          const td = document.createElement('td');
          const k = keyTS(s.id, a); const set = A.transitions.get(k);
          const cur = set && set.size ? Array.from(set)[0] : '';
          const sel = document.createElement('select');
          const optEmpty = document.createElement('option'); optEmpty.value = ''; optEmpty.textContent = '—'; sel.appendChild(optEmpty);
          for (const id of idList) {
            const opt = document.createElement('option'); opt.value = id; opt.textContent = byId.get(id)?.name || id; sel.appendChild(opt);
          }
          sel.value = cur || '';
          sel.addEventListener('change', () => {
            if (sel.value === '') {
              A.transitions.delete(k);
            } else {
              A.transitions.set(k, new Set([sel.value]));
            }
            bumpTransitionsVersion(); renderAll(); saveLS();
            // keep table in sync but avoid full rebuild
          });
          td.appendChild(sel); tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      host.innerHTML = '';
      host.appendChild(table);
    }

    // ============== DFA completeness indicator (AFD pages) ==============
    function analyzeDfaCompleteness() {
      const result = { complete: true, nondet: false, missing: 0, lambda: false };
      const alpha = Array.from(A.alphabet).filter(s => s !== 'λ');
      if (!alpha.length || A.states.size === 0) { result.complete = false; return result; }
      for (const k of A.transitions.keys()) if (k.endsWith('|λ')) { result.lambda = true; result.complete = false; }
      for (const s of A.states.values()) {
        for (const sym of alpha) {
          const set = A.transitions.get(keyTS(s.id, sym));
          if (!set || set.size === 0) { result.missing++; result.complete = false; }
          else if (set.size > 1) { result.nondet = true; result.complete = false; }
        }
      }
      return result;
    }

    function updateDfaCompletenessBadge() {
      // only on pages com operações de AFD (index/gr)
      if (hasAFNops) return; // afn.html não mostra badge
      const wrapper = document.getElementById('canvasWrapper'); if (!wrapper) return;
      let el = document.getElementById('dfaBadge');
      const info = analyzeDfaCompleteness();
      if (!el) {
        el = document.createElement('div'); el.id = 'dfaBadge'; el.className = 'badge';
        el.style.position = 'absolute'; el.style.top = '8px'; el.style.right = '8px'; el.style.zIndex = '50';
        wrapper.appendChild(el);
      }
      if (info.complete) {
        el.textContent = 'Completo'; el.style.borderColor = 'rgba(52, 211, 153, .45)'; el.style.background = 'rgba(52,211,153,.12)';
      } else {
        let txt = 'Incompleto';
        if (info.lambda) txt += ' (λ)';
        if (info.nondet) txt += ' (ND)';
        if (info.missing) txt += ` (faltam ${info.missing})`;
        el.textContent = txt; el.style.borderColor = 'rgba(251, 113, 133, .45)'; el.style.background = 'rgba(251,113,133,.12)';
      }
    }

    function areEquivalent(obj1, obj2) {
      const dfa1 = toDFA(obj1);
      const dfa2 = toDFA(obj2);
      const alpha = new Set([...dfa1.alphabet, ...dfa2.alphabet]);
      const trap1 = '__trap1__', trap2 = '__trap2__';
      const queue = [[dfa1.initialId || trap1, dfa2.initialId || trap2]];
      const seen = new Set();
      while (queue.length) {
        const [s1, s2] = queue.shift();
        const key = s1 + '|' + s2;
        if (seen.has(key)) continue;
        seen.add(key);
        const f1 = dfa1.states.get(s1)?.isFinal || false;
        const f2 = dfa2.states.get(s2)?.isFinal || false;
        if (f1 !== f2) return false;
        for (const sym of alpha) {
          const n1 = s1 === trap1 ? trap1 : (dfa1.transitions.get(keyTS(s1, sym)) || trap1);
          const n2 = s2 === trap2 ? trap2 : (dfa2.transitions.get(keyTS(s2, sym)) || trap2);
          queue.push([n1, n2]);
        }
      }
      return true;
    }

    /* -------------------- Conversões -------------------- */
    /** ε-fecho/λ-fecho sobre o grafo de transições. */
    function epsilonClosureMap(states, trans) {
      const stack = Array.from(states);
      const closure = new Set(states);
      while (stack.length) {
        const s = stack.pop();
        const k = keyTS(s, 'λ');
        if (trans.has(k)) {
          for (const nxt of trans.get(k)) {
            if (!closure.has(nxt)) { closure.add(nxt); stack.push(nxt); }
          }
        }
      }
      return closure;
    }

    /** AFNλ → AFN por ε-fechos e reconstrução de transições. */
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
      elAlphabetView.textContent = `Σ = { ${alphaStr()} }`;
      renderAll(); saveLS();
    }

    /** AFN → AFD pelo método dos subconjuntos (sem λ). */
    function convertNfaToDfa() {
      const withLambda = Array.from(A.transitions.keys()).filter(k => k.endsWith('|λ'));
      if (withLambda.length) {
        alert('Remova transições λ antes de converter para AFD.\nEx.: ' + withLambda.slice(0,5).join(', ') + (withLambda.length>5?'...':''));
        return;
      }
      const old = snapshot();
      const oldStates = new Map(old.states.map(s => [s.id, s]));
      const oldTrans = new Map(old.transitions.map(([k, arr]) => [k, new Set(arr)]));
      const alphabet = Array.from(A.alphabet).filter(sym => sym !== 'λ');

      function subsetKey(set) { return Array.from(set).sort().join(','); }
      function subsetName(set) {
        return '{' + Array.from(set).map(id => oldStates.get(id)?.name || id).join(',') + '}';
      }

      A.states.clear();
      A.transitions.clear();
      A.nextId = 0;

      const subsetMap = new Map();
      const queue = [];
      function getIdFor(set) {
        const key = subsetKey(set);
        if (!subsetMap.has(key)) {
          const sid = id();
          const st = {
            id: sid,
            name: subsetName(set),
            x: 120 + Math.random() * 320,
            y: 120 + Math.random() * 220,
            isInitial: false,
            isFinal: [...set].some(s => oldStates.get(s)?.isFinal)
          };
          subsetMap.set(key, sid);
          A.states.set(sid, st);
          queue.push(set);
          emitAlgoStep('nfaToDfa', 'newState', { id: sid, subset: Array.from(set) });
        }
        return subsetMap.get(key);
      }

      const startSet = new Set([old.initialId]);
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
            if (oldTrans.has(k)) {
              oldTrans.get(k).forEach(d => dest.add(d));
            }
          }
          if (dest.size) {
            const toId = getIdFor(dest);
            if (!A.transitions.has(keyTS(fromId, sym))) A.transitions.set(keyTS(fromId, sym), new Set());
            A.transitions.get(keyTS(fromId, sym)).add(toId);
            emitAlgoStep('nfaToDfa', 'transition', { from: fromId, sym, to: toId });
          }
        }
      }
      bumpTransitionsVersion();
      // update Σ to exclude λ in the resulting DFA
      A.alphabet = new Set(alphabet);
      elAlphabetView.textContent = `Σ = { ${alphaStr()} }`;
      renderAll(); saveLS();
    }

    const btnLambda = document.getElementById('lambdaToNfaBtn');
    if (btnLambda) btnLambda.onclick = () => {
      emitAlgoStep('removeLambda', 'start', {});
      removeLambdaTransitions();
    };
    const btnDfa = document.getElementById('nfaToDfaBtn');
    if (btnDfa) btnDfa.onclick = () => {
      emitAlgoStep('nfaToDfa', 'start', {});
      convertNfaToDfa();
    };
    const btnDfaOpen = document.getElementById('nfaToDfaOpenBtn');
    if (btnDfaOpen) btnDfaOpen.onclick = () => {
      emitAlgoStep('nfaToDfa', 'start', {});
      const before = Array.from(A.transitions.keys()).some(k => k.endsWith('|λ'));
      if (before) { alert('Remova transições λ antes de converter para AFD.'); return; }
      convertNfaToDfa();
      if (typeof window.pushCrossImport === 'function') window.pushCrossImport('index.html');
    };

renderAll();
