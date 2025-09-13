(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/modules/state.js
  function setLsKey(k) {
    LS_KEY = String(k || "afd_sim_state_v3");
  }
  function isAfn() {
    return LS_KEY.startsWith("afn");
  }
  function alphaStr() {
    return Array.from(A.alphabet).join(", ");
  }
  function bumpTransitionsVersion() {
    _transitionsVersion++;
  }
  function getTransitionsVersion() {
    return _transitionsVersion;
  }
  function snapshot() {
    return {
      version: 3,
      alphabet: Array.from(A.alphabet),
      states: Array.from(A.states.values()).map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, isInitial: s.isInitial, isFinal: s.isFinal })),
      nextId: A.nextId,
      transitions: Array.from(A.transitions.entries()).map(([k, set]) => [k, Array.from(set)]),
      initialId: A.initialId
    };
  }
  function saveLS() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot()));
    } catch (e) {
      console.warn("localStorage save failed", e);
    }
  }
  function loadLS() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      restoreFromObject(data);
      return true;
    } catch (e) {
      console.warn("localStorage load failed", e);
      return false;
    }
  }
  function resetAll() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
    }
    A.alphabet = /* @__PURE__ */ new Set();
    A.states.clear();
    A.transitions.clear();
    bumpTransitionsVersion();
    A.nextId = 0;
    A.initialId = void 0;
    A.selectedStateId = null;
    A.connectFrom = null;
    A.connectMode = false;
  }
  function restoreFromObject(obj) {
    if (!obj || typeof obj !== "object") throw new Error("JSON malformado");
    if (!Array.isArray(obj.states) || !Array.isArray(obj.alphabet)) throw new Error("Faltam campos essenciais");
    const ids = new Set(obj.states.map((s) => s.id));
    if (obj.initialId && !ids.has(obj.initialId)) throw new Error("initialId inexistente nos estados");
    A.alphabet = new Set(
      Array.from(new Set(Array.isArray(obj.alphabet) ? obj.alphabet : [])).map((s) => String(s).trim()).filter((s) => s.length === 1)
    );
    A.states.clear();
    for (const st of obj.states) {
      A.states.set(st.id, { ...st });
    }
    A.initialId = obj.initialId;
    A.nextId = typeof obj.nextId === "number" ? obj.nextId : obj.states.length;
    A.transitions = /* @__PURE__ */ new Map();
    const IS_AFN = isAfn();
    if (Array.isArray(obj.transitions)) {
      for (const [k, v] of obj.transitions) {
        const [src, sym] = String(k).split("|");
        if (!ids.has(src)) continue;
        if (!IS_AFN && sym === "\u03BB") continue;
        const dests = Array.isArray(v) ? v : [v];
        const valid = dests.filter((d) => ids.has(d));
        if (!valid.length) continue;
        const chosen = !IS_AFN && valid.length > 1 ? [valid[0]] : valid;
        A.transitions.set(k, new Set(chosen));
      }
    }
    bumpTransitionsVersion();
  }
  function checkCrossImport() {
    try {
      const raw = localStorage.getItem("AF_CROSS_IMPORT");
      if (!raw) return false;
      const obj = JSON.parse(raw);
      restoreFromObject(obj);
      saveLS();
      localStorage.removeItem("AF_CROSS_IMPORT");
      return true;
    } catch (e) {
      console.warn("cross-import failed", e);
      localStorage.removeItem("AF_CROSS_IMPORT");
      return false;
    }
  }
  function pushCrossImport(targetPath) {
    try {
      localStorage.setItem("AF_CROSS_IMPORT", JSON.stringify(snapshot()));
    } catch (_) {
    }
    window.location.href = targetPath;
  }
  var A, runHighlight, LS_KEY, keyTS, id, clamp, _transitionsVersion;
  var init_state = __esm({
    "js/modules/state.js"() {
      A = {
        alphabet: /* @__PURE__ */ new Set(),
        states: /* @__PURE__ */ new Map(),
        // id -> {id,name,x,y,isInitial,isFinal}
        nextId: 0,
        selectedStateId: null,
        selectedIds: /* @__PURE__ */ new Set(),
        selectedEdge: null,
        // {src,to}
        connectMode: false,
        connectFrom: null,
        transitions: /* @__PURE__ */ new Map(),
        // key: src|sym -> Set(dest)
        initialId: void 0
      };
      runHighlight = /* @__PURE__ */ new Map();
      LS_KEY = "afd_sim_state_v3";
      keyTS = (s, sym) => `${s}|${sym}`;
      id = () => `q${A.nextId++}`;
      clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      _transitionsVersion = 0;
    }
  });

  // js/modules/algorithms.js
  var algorithms_exports = {};
  __export(algorithms_exports, {
    areEquivalent: () => areEquivalent,
    combineAFDs: () => combineAFDs,
    combineNFAs: () => combineNFAs,
    complementCurrentDfa: () => complementCurrentDfa,
    completeCurrentDfa: () => completeCurrentDfa,
    convertNfaToDfa: () => convertNfaToDfa,
    dfaToRegex: () => dfaToRegex,
    emitAlgoStep: () => emitAlgoStep,
    epsilonClosureMap: () => epsilonClosureMap,
    prefixClosureCurrentDfa: () => prefixClosureCurrentDfa,
    removeLambdaTransitions: () => removeLambdaTransitions,
    starNFA: () => starNFA,
    suffixClosureCurrentDfa: () => suffixClosureCurrentDfa,
    toDFA: () => toDFA
  });
  function emitAlgoStep(algo, step, detail = {}) {
    document.dispatchEvent(new CustomEvent("algoStep", { detail: { algo, step, ...detail } }));
  }
  function dfaToRegex(allowEps = false) {
    const msg = [];
    const states = Array.from(A.states.keys());
    if (!A.initialId) return { output: "", msg: `<span class="warn">Defina um estado inicial.</span>` };
    const finals = states.filter((s) => A.states.get(s).isFinal);
    if (!finals.length) return { output: "", msg: `<span class="warn">Nenhum estado final definido.</span>` };
    if (!A.alphabet.size) return { output: "", msg: `<span class="warn">Defina \u03A3.</span>` };
    const idx = /* @__PURE__ */ new Map();
    states.forEach((s, i) => idx.set(s, i));
    const n = states.length;
    let R = Array.from({ length: n }, (_) => Array.from({ length: n }, (_2) => null));
    for (const [k, dests] of A.transitions.entries()) {
      const [src, sym] = k.split("|");
      for (const to of dests) {
        const i = idx.get(src), j = idx.get(to);
        R[i][j] = R[i][j] ? union(R[i][j], sym) : sym;
      }
    }
    const init = idx.get(A.initialId);
    const fins = finals.map((f) => idx.get(f));
    const N = n + 2, Saux = n, Faux = n + 1;
    let G = Array.from({ length: N }, (_) => Array.from({ length: N }, (_2) => null));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (R[i][j]) G[i][j] = R[i][j];
    G[Saux][init] = "\u03BB";
    for (const j of fins) G[j][Faux] = union(G[j][Faux], "\u03BB");
    const statesOrder = [];
    for (let k = 0; k < N; k++) if (k !== Saux && k !== Faux) statesOrder.push(k);
    for (const k of statesOrder) {
      emitAlgoStep("dfaToRegex", "eliminate", { state: states[k] });
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
          const fromName = i === Saux ? "I" : i < n ? A.states.get(states[i])?.name || states[i] : "";
          const toName = j === Faux ? "F" : j < n ? A.states.get(states[j])?.name || states[j] : "";
          emitAlgoStep("dfaToRegex", "transition", { from: fromId, to: toId, via: states[k], regex: via, fromName, toName });
        }
      }
      for (let i = 0; i < N; i++) {
        G[i][k] = null;
        G[k][i] = null;
      }
      G[k][k] = null;
      emitAlgoStep("dfaToRegex", "remove", { state: states[k] });
    }
    let Rfinal = G[Saux][Faux] || null;
    if (!Rfinal) {
      return { output: "", msg: `<span class="warn">A linguagem reconhecida \xE9 vazia (sem caminhos).</span>` };
    }
    Rfinal = simplify(Rfinal);
    emitAlgoStep("dfaToRegex", "final", { regex: Rfinal });
    if (!allowEps && Rfinal.includes("\u03BB")) {
      msg.push(`<span class="warn">A express\xE3o exata envolve \u03BB. Como voc\xEA desativou \u201CPermitir \u03BB\u201D, tentei remover/absorver \u03BB por \xE1lgebra b\xE1sica; se n\xE3o foi poss\xEDvel sem alterar a linguagem, o resultado foi omitido.</span>`);
      const noEps = dropEpsilonIfSafe(Rfinal);
      if (noEps === null) return { output: "", msg: msg.join("<br>") };
      Rfinal = noEps;
    }
    if (!onlyAllowedTokens(Rfinal)) {
      msg.push(`<span class="warn">A sa\xEDda usa apenas s\xEDmbolos de \u03A3, par\xEAnteses, \u201C\u222A\u201D e \u201C*\u201D. Se vir algo diferente, houve falha na normaliza\xE7\xE3o.</span>`);
    }
    return { output: Rfinal, msg: msg.join("<br>") };
  }
  function isNull(x) {
    return x === null || x === "\u2205";
  }
  function isEps(x) {
    return x === "\u03BB";
  }
  function balanced(s) {
    let d = 0;
    for (const c of s) {
      if (c === "(") d++;
      else if (c === ")") d--;
      if (d < 0) return false;
    }
    return d === 0;
  }
  function union(a, b) {
    if (isNull(a)) return b || null;
    if (isNull(b)) return a || null;
    if (a === b) return a;
    const parts = new Set(splitTopUnion(a).concat(splitTopUnion(b)));
    return Array.from(parts).join(" \u222A ");
  }
  function concat(a, b) {
    if (isNull(a) || isNull(b)) return null;
    if (isEps(a)) return b;
    if (isEps(b)) return a;
    return a && b ? needsPar(a, "concat") + needsPar(b, "concat") : null;
  }
  function needsPar(x, ctx) {
    const hasUnion = x.includes(" \u222A ");
    const simpleAtom = /^[A-Za-z0-9]$/.test(x) || x === "\u03BB" || x.endsWith("*") && balanced(x.slice(0, -1));
    if (simpleAtom) return x;
    if (ctx === "concat" && hasUnion) return `(${x})`;
    return `(${x})`;
  }
  function star(x) {
    if (isNull(x) || isEps(x)) return "\u03BB";
    if (x.endsWith("*")) return x;
    return `${needsPar(x)}*`;
  }
  function simplify(r) {
    if (!r) return r;
    const parts = splitTopUnion(r);
    const cleaned = parts.map(cleanFactor);
    const uniq = Array.from(new Set(cleaned));
    return uniq.join(" \u222A ");
  }
  function splitTopUnion(r) {
    const parts = [];
    let d = 0, cur = "";
    for (let i = 0; i < r.length; i++) {
      const c = r[i];
      if (c === "(") d++;
      if (c === ")") d--;
      if (d === 0 && r.slice(i, i + 3) === " \u222A ") {
        parts.push(cur);
        cur = "";
        i += 2;
        continue;
      }
      cur += c;
    }
    if (cur) parts.push(cur);
    return parts;
  }
  function cleanFactor(f) {
    while (f.startsWith("(") && f.endsWith(")") && balanced(f.slice(1, -1))) f = f.slice(1, -1);
    return f;
  }
  function dropEpsilonIfSafe(r) {
    if (!r.includes("\u03BB")) return r;
    const parts = splitTopUnion(r);
    const hasEps = parts.includes("\u03BB");
    if (hasEps) {
      const others = parts.filter((p) => p !== "\u03BB");
      if (others.length === 0) return null;
      const someStar = others.some((p) => p.endsWith("*"));
      return someStar ? simplify(others.join(" \u222A ")) : null;
    }
    return r.replaceAll("\u03BB", "");
  }
  function onlyAllowedTokens(r) {
    return /^[A-Za-z0-9 ()∪*]+$/.test(r);
  }
  function epsilonClosureMap(states, trans) {
    const st = new Set(states);
    const stack = Array.from(states);
    while (stack.length) {
      const s = stack.pop();
      const k = keyTS(s, "\u03BB");
      const set = trans.get(k);
      if (!set) continue;
      for (const d of set) if (!st.has(d)) {
        st.add(d);
        stack.push(d);
      }
    }
    return st;
  }
  function removeLambdaTransitions() {
    const closures = /* @__PURE__ */ new Map();
    for (const id2 of A.states.keys()) {
      const cl = epsilonClosureMap(/* @__PURE__ */ new Set([id2]), A.transitions);
      closures.set(id2, cl);
      emitAlgoStep("removeLambda", "closure", { state: id2, closure: Array.from(cl) });
    }
    for (const s of A.states.values()) {
      s.isFinal = [...closures.get(s.id)].some((id2) => A.states.get(id2)?.isFinal);
      emitAlgoStep("removeLambda", "final", { state: s.id, isFinal: s.isFinal });
    }
    const newTrans = /* @__PURE__ */ new Map();
    for (const id2 of A.states.keys()) {
      for (const sym of A.alphabet) {
        if (sym === "\u03BB") continue;
        const dests = /* @__PURE__ */ new Set();
        for (const q of closures.get(id2)) {
          const k = keyTS(q, sym);
          if (A.transitions.has(k)) {
            for (const d of A.transitions.get(k)) {
              epsilonClosureMap(/* @__PURE__ */ new Set([d]), A.transitions).forEach((x) => dests.add(x));
            }
          }
        }
        if (dests.size) {
          newTrans.set(keyTS(id2, sym), dests);
          emitAlgoStep("removeLambda", "transition", { from: id2, sym, to: Array.from(dests) });
        }
      }
    }
    A.transitions = newTrans;
    bumpTransitionsVersion();
    A.alphabet.delete("\u03BB");
  }
  function convertNfaToDfa() {
    const withLambda = Array.from(A.transitions.keys()).filter((k) => k.endsWith("|\u03BB"));
    if (withLambda.length) {
      alert("Remova transi\xE7\xF5es \u03BB antes de converter para AFD.\nEx.: " + withLambda.slice(0, 5).join(", ") + (withLambda.length > 5 ? "..." : ""));
      return;
    }
    const oldStates = new Map(Array.from(A.states.values()).map((s) => [s.id, s]));
    const oldTrans = new Map(Array.from(A.transitions.entries()).map(([k, set]) => [k, new Set(set)]));
    const alphabet = Array.from(A.alphabet).filter((sym) => sym !== "\u03BB");
    function subsetKey(set) {
      return Array.from(set).sort().join(",");
    }
    function subsetName(set) {
      return "{" + Array.from(set).map((id2) => oldStates.get(id2)?.name || id2).join(",") + "}";
    }
    A.states.clear();
    A.transitions.clear();
    A.nextId = 0;
    const subsetMap = /* @__PURE__ */ new Map();
    const queue = [];
    function getIdFor(set) {
      const key = subsetKey(set);
      if (!subsetMap.has(key)) {
        const sid = `q${subsetMap.size}`;
        const st = { id: sid, name: subsetName(set), x: 120 + Math.random() * 320, y: 120 + Math.random() * 220, isInitial: false, isFinal: [...set].some((s) => oldStates.get(s)?.isFinal) };
        subsetMap.set(key, sid);
        A.states.set(sid, st);
        queue.push(set);
        emitAlgoStep("nfaToDfa", "newState", { id: sid, subset: Array.from(set) });
      }
      return subsetMap.get(key);
    }
    const startSet = /* @__PURE__ */ new Set([A.initialId]);
    const startId = getIdFor(startSet);
    A.states.get(startId).isInitial = true;
    A.initialId = startId;
    while (queue.length) {
      const set = queue.shift();
      const fromId = getIdFor(set);
      for (const sym of alphabet) {
        const dest = /* @__PURE__ */ new Set();
        for (const s of set) {
          const k = keyTS(s, sym);
          if (oldTrans.has(k)) oldTrans.get(k).forEach((d) => dest.add(d));
        }
        if (dest.size) {
          const toId = getIdFor(dest);
          const key = keyTS(fromId, sym);
          if (!A.transitions.has(key)) A.transitions.set(key, /* @__PURE__ */ new Set());
          A.transitions.get(key).add(toId);
          emitAlgoStep("nfaToDfa", "transition", { from: fromId, sym, to: toId });
        }
      }
    }
    bumpTransitionsVersion();
    A.alphabet = new Set(alphabet);
  }
  function readDfa(obj) {
    const states = new Map(obj.states.map((s) => [s.id, { ...s }]));
    const trans = /* @__PURE__ */ new Map();
    for (const [k, v] of obj.transitions || []) {
      const [src, sym] = String(k).split("|");
      const dest = Array.isArray(v) ? v[0] : v;
      if (dest) trans.set(keyTS(src, sym), dest);
    }
    const alphabet = [...obj.alphabet || []].filter((s) => s !== "\u03BB");
    let trap = null;
    function ensureTrap() {
      if (!trap) {
        trap = "__trap__";
        states.set(trap, { id: trap, name: "trap", isFinal: false });
      }
    }
    for (const sid of states.keys()) {
      for (const sym of alphabet) {
        const k = keyTS(sid, sym);
        if (!trans.has(k)) {
          ensureTrap();
          trans.set(k, trap);
        }
      }
    }
    if (trap) {
      for (const sym of alphabet) trans.set(keyTS(trap, sym), trap);
    }
    return { states, trans, alphabet, initialId: obj.initialId };
  }
  function removeUnreachableStates(obj) {
    const reachable = /* @__PURE__ */ new Set();
    function dfs(stateId) {
      if (reachable.has(stateId)) return;
      reachable.add(stateId);
      for (const [k, dest] of obj.transitions) {
        const [from] = k.split("|");
        if (from === stateId) {
          const arr = Array.isArray(dest) ? dest : [dest];
          arr.forEach(dfs);
        }
      }
    }
    dfs(obj.initialId);
    obj.states = obj.states.filter((s) => reachable.has(s.id));
    obj.transitions = obj.transitions.map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).filter((d) => reachable.has(d))]).filter(([k, arr]) => arr.length > 0);
    return obj;
  }
  function nfaAcceptsEmpty(obj) {
    const trans = new Map((obj.transitions || []).map(([k, v]) => [k, new Set(Array.isArray(v) ? v : [v])]));
    const closure = epsilonClosureMap(/* @__PURE__ */ new Set([obj.initialId]), trans);
    const finals = new Set(obj.states.filter((s) => s.isFinal).map((s) => s.id));
    for (const q of closure) if (finals.has(q)) return true;
    return false;
  }
  function combineNFAs(obj1, obj2, op) {
    const alpha = Array.from(/* @__PURE__ */ new Set([...obj1.alphabet || [], ...obj2.alphabet || []]));
    const states = /* @__PURE__ */ new Map();
    const transitions = /* @__PURE__ */ new Map();
    const map1 = /* @__PURE__ */ new Map();
    const map2 = /* @__PURE__ */ new Map();
    let idCounter = 0;
    const nid = () => "q" + idCounter++;
    function clone(obj, map) {
      for (const s of obj.states) {
        const id2 = nid();
        states.set(id2, { id: id2, name: s.name, x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isFinal: s.isFinal, isInitial: false });
        map.set(s.id, id2);
      }
      for (const [k, v] of obj.transitions) {
        const [src, sym] = String(k).split("|");
        if (!map.has(src)) continue;
        const arr = Array.isArray(v) ? v : [v];
        const key = keyTS(map.get(src), sym);
        const set = transitions.get(key) || /* @__PURE__ */ new Set();
        arr.forEach((d) => {
          if (map.has(d)) set.add(map.get(d));
        });
        if (set.size) transitions.set(key, set);
      }
    }
    clone(obj1, map1);
    clone(obj2, map2);
    let initialId = "";
    if (op === "union") {
      initialId = nid();
      const initFinal = nfaAcceptsEmpty(obj1) || nfaAcceptsEmpty(obj2);
      states.set(initialId, { id: initialId, name: "init", x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isInitial: true, isFinal: initFinal });
      const set = /* @__PURE__ */ new Set([map1.get(obj1.initialId), map2.get(obj2.initialId)]);
      transitions.set(keyTS(initialId, "\u03BB"), set);
    } else if (op === "concat") {
      initialId = map1.get(obj1.initialId);
      states.get(initialId).isInitial = true;
      const init2 = map2.get(obj2.initialId);
      const acceptsEmpty2 = nfaAcceptsEmpty(obj2);
      for (const s of obj1.states) {
        const id2 = map1.get(s.id);
        states.get(id2).isFinal = acceptsEmpty2 && s.isFinal;
        if (s.isFinal) {
          const key = keyTS(id2, "\u03BB");
          const set = transitions.get(key) || /* @__PURE__ */ new Set();
          set.add(init2);
          transitions.set(key, set);
        }
      }
    }
    for (const s of obj2.states) {
      const id2 = map2.get(s.id);
      states.get(id2).isFinal = s.isFinal;
    }
    return removeUnreachableStates({ alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()).map(([k, set]) => [k, Array.from(set)]), initialId, nextId: idCounter });
  }
  function starNFA(obj) {
    const alpha = Array.from(new Set(obj.alphabet || []));
    const states = /* @__PURE__ */ new Map();
    const transitions = /* @__PURE__ */ new Map();
    const map = /* @__PURE__ */ new Map();
    let idCounter = 0;
    const nid = () => "q" + idCounter++;
    for (const s of obj.states) {
      const id2 = nid();
      states.set(id2, { id: id2, name: s.name, x: Math.random() * 500 + 50, y: Math.random() * 300 + 50, isFinal: s.isFinal, isInitial: false });
      map.set(s.id, id2);
    }
    for (const [k, v] of obj.transitions) {
      const [src, sym] = String(k).split("|");
      const arr = Array.isArray(v) ? v : [v];
      const key = keyTS(map.get(src), sym);
      const set2 = transitions.get(key) || /* @__PURE__ */ new Set();
      arr.forEach((d) => set2.add(map.get(d)));
      transitions.set(key, set2);
    }
    const initOld = map.get(obj.initialId);
    const newInit = nid();
    states.set(newInit, { id: newInit, name: "S", x: 60, y: 60, isInitial: true, isFinal: true });
    const set = /* @__PURE__ */ new Set([initOld]);
    transitions.set(keyTS(newInit, "\u03BB"), set);
    for (const s of obj.states) {
      const id2 = map.get(s.id);
      if (s.isFinal) {
        const key = keyTS(id2, "\u03BB");
        const st = transitions.get(key) || /* @__PURE__ */ new Set();
        st.add(initOld);
        st.add(newInit);
        transitions.set(key, st);
      }
    }
    return removeUnreachableStates({ alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()).map(([k, set2]) => [k, Array.from(set2)]), initialId: newInit, nextId: idCounter });
  }
  function toDFA(obj) {
    const trans = /* @__PURE__ */ new Map();
    obj.transitions.forEach(([k, v]) => trans.set(k, new Set(Array.isArray(v) ? v : [v])));
    const states = new Map(obj.states.map((s) => [s.id, { ...s }]));
    const alphabet = Array.from(new Set(obj.alphabet.filter((s) => s !== "\u03BB")));
    const subsetMap = /* @__PURE__ */ new Map();
    const queue = [];
    function subsetKey(set) {
      return Array.from(set).sort().join(",");
    }
    function subsetName(set) {
      return "{" + Array.from(set).map((id2) => states.get(id2)?.name || id2).join(",") + "}";
    }
    function getIdFor(set, dfa2) {
      const key = subsetKey(set);
      if (!subsetMap.has(key)) {
        const id2 = "S" + subsetMap.size;
        dfa2.states.set(id2, { id: id2, name: subsetName(set), isFinal: [...set].some((s) => states.get(s)?.isFinal) });
        subsetMap.set(key, id2);
        queue.push(set);
      }
      return subsetMap.get(key);
    }
    const dfa = { states: /* @__PURE__ */ new Map(), transitions: /* @__PURE__ */ new Map(), alphabet, initialId: null };
    const s0 = getIdFor(/* @__PURE__ */ new Set([obj.initialId]), dfa);
    dfa.initialId = s0;
    while (queue.length) {
      const set = queue.shift();
      const fromId = getIdFor(set, dfa);
      for (const sym of alphabet) {
        const dest = /* @__PURE__ */ new Set();
        for (const s of set) {
          const k = keyTS(s, sym);
          (trans.get(k) || []).forEach((d) => dest.add(d));
        }
        if (dest.size) {
          const toId = getIdFor(dest, dfa);
          dfa.transitions.set(keyTS(fromId, sym), toId);
        }
      }
    }
    return dfa;
  }
  function combineAFDs(obj1, obj2, op) {
    if (JSON.stringify(obj1.alphabet) !== JSON.stringify(obj2.alphabet)) {
      alert("Alfabetos diferentes!");
      return;
    }
    const A1 = readDfa(obj1);
    const A2 = readDfa(obj2);
    const alpha = A1.alphabet;
    const pairKey = (p1, p2) => `${p1}|${p2}`;
    const states = /* @__PURE__ */ new Map();
    const idMap = /* @__PURE__ */ new Map();
    const transitions = /* @__PURE__ */ new Map();
    let idCounter = 0;
    const nid = () => "q" + idCounter++;
    function ensurePair(p1, p2) {
      const k = pairKey(p1, p2);
      if (idMap.has(k)) return idMap.get(k);
      const id2 = nid();
      const s1 = A1.states.get(p1), s2 = A2.states.get(p2);
      let final = false;
      if (op === "union") final = s1.isFinal || s2.isFinal;
      else if (op === "intersection") final = s1.isFinal && s2.isFinal;
      else if (op === "difference") final = s1.isFinal && !s2.isFinal;
      const st = { id: id2, name: `(${s1.name},${s2.name})`, x: 100 + idCounter % 8 * 70, y: 140 + Math.floor(idCounter / 8) * 70, isFinal: final, isInitial: false };
      idMap.set(k, id2);
      states.set(id2, st);
      return id2;
    }
    const q0 = ensurePair(A1.initialId, A2.initialId);
    states.get(q0).isInitial = true;
    const queue = [[A1.initialId, A2.initialId]];
    const seen = /* @__PURE__ */ new Set();
    while (queue.length) {
      const [p1, p2] = queue.shift();
      const key = pairKey(p1, p2);
      if (seen.has(key)) continue;
      seen.add(key);
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
    return removeUnreachableStates({ alphabet: alpha, states: Array.from(states.values()), transitions: Array.from(transitions.entries()), initialId: q0, nextId: idCounter });
  }
  function areEquivalent(obj1, obj2) {
    const dfa1 = toDFA(obj1);
    const dfa2 = toDFA(obj2);
    const alpha = /* @__PURE__ */ new Set([...dfa1.alphabet, ...dfa2.alphabet]);
    const trap1 = "__trap1__", trap2 = "__trap2__";
    const queue = [[dfa1.initialId || trap1, dfa2.initialId || trap2]];
    const seen = /* @__PURE__ */ new Set();
    while (queue.length) {
      const [s1, s2] = queue.shift();
      const key = s1 + "|" + s2;
      if (seen.has(key)) continue;
      seen.add(key);
      const f1 = dfa1.states.get(s1)?.isFinal || false;
      const f2 = dfa2.states.get(s2)?.isFinal || false;
      if (f1 !== f2) return false;
      for (const sym of alpha) {
        const n1 = s1 === trap1 ? trap1 : dfa1.transitions.get(keyTS(s1, sym)) || trap1;
        const n2 = s2 === trap2 ? trap2 : dfa2.transitions.get(keyTS(s2, sym)) || trap2;
        queue.push([n1, n2]);
      }
    }
    return true;
  }
  function completeCurrentDfa() {
    const alpha = Array.from(A.alphabet).filter((s) => s !== "\u03BB");
    const states = Array.from(A.states.keys());
    let trapId = null;
    function ensureTrap() {
      if (!trapId) {
        trapId = `trap_${states.length}`;
        A.states.set(trapId, { id: trapId, name: "trap", x: 80, y: 80, isInitial: false, isFinal: false });
      }
    }
    for (const sid of states) {
      for (const sym of alpha) {
        const k = keyTS(sid, sym);
        const set = A.transitions.get(k);
        if (!set || set.size === 0) {
          ensureTrap();
          A.transitions.set(k, /* @__PURE__ */ new Set([trapId]));
        } else if (set.size > 1) {
          const first = set.values().next().value;
          A.transitions.set(k, /* @__PURE__ */ new Set([first]));
        }
      }
    }
    if (trapId) {
      for (const sym of alpha) A.transitions.set(keyTS(trapId, sym), /* @__PURE__ */ new Set([trapId]));
    }
    bumpTransitionsVersion();
  }
  function complementCurrentDfa() {
    completeCurrentDfa();
    for (const s of A.states.values()) s.isFinal = !s.isFinal;
  }
  function prefixClosureCurrentDfa() {
    const reach = /* @__PURE__ */ new Set();
    const q = [A.initialId];
    while (q.length) {
      const x = q.shift();
      if (!x || reach.has(x)) continue;
      reach.add(x);
      for (const [k, dests] of A.transitions.entries()) {
        const [src] = k.split("|");
        if (src !== x) continue;
        dests.forEach((d) => {
          if (!reach.has(d)) q.push(d);
        });
      }
    }
    const canReachFinal = /* @__PURE__ */ new Set();
    const rev = /* @__PURE__ */ new Map();
    for (const [k, dests] of A.transitions.entries()) {
      const [src, sym] = k.split("|");
      if (sym === "\u03BB") continue;
      for (const d of dests) {
        if (!rev.has(d)) rev.set(d, /* @__PURE__ */ new Set());
        rev.get(d).add(src);
      }
    }
    const finals = Array.from(A.states.values()).filter((s) => s.isFinal).map((s) => s.id);
    const stack = finals.slice();
    while (stack.length) {
      const y = stack.pop();
      if (canReachFinal.has(y)) continue;
      canReachFinal.add(y);
      const preds = rev.get(y) || /* @__PURE__ */ new Set();
      preds.forEach((p) => {
        if (!canReachFinal.has(p)) stack.push(p);
      });
    }
    for (const s of A.states.values()) s.isFinal = reach.has(s.id) && canReachFinal.has(s.id);
  }
  function suffixClosureCurrentDfa() {
    const obj = { alphabet: Array.from(A.alphabet), states: Array.from(A.states.values()).map((s) => ({ ...s })), transitions: Array.from(A.transitions.entries()).map(([k, set]) => [k, Array.from(set)]), initialId: A.initialId };
    const transArr = obj.transitions.map(([k, arr]) => [k, Array.isArray(arr) ? arr.slice() : [arr]]);
    const reachable = /* @__PURE__ */ new Set();
    const q = [obj.initialId];
    while (q.length) {
      const x = q.shift();
      if (!x || reachable.has(x)) continue;
      reachable.add(x);
      for (const [k, arr] of transArr) {
        const [src] = String(k).split("|");
        if (src !== x) continue;
        for (const d of arr) if (!reachable.has(d)) q.push(d);
      }
    }
    const S0 = "S_suffix_start";
    const statesArr = obj.states.map((s) => ({ ...s }));
    statesArr.push({ id: S0, name: "S", x: 60, y: 60, isInitial: true, isFinal: false });
    statesArr.forEach((s) => {
      if (s.id !== S0) s.isInitial = false;
    });
    transArr.push([keyTS(S0, "\u03BB"), Array.from(reachable)]);
    const nfaObj = { alphabet: obj.alphabet, states: statesArr, transitions: transArr, initialId: S0 };
    const dfa = toDFA(nfaObj);
    const alpha = Array.from(new Set(obj.alphabet.filter((s) => s !== "\u03BB")));
    const newStates = Array.from(dfa.states.entries()).map(([id2, s], i) => ({ id: id2, name: id2, x: 120 + i % 8 * 70, y: 120 + Math.floor(i / 8) * 70, isInitial: id2 === dfa.initialId, isFinal: s.isFinal }));
    const newTrans = Array.from(dfa.transitions.entries());
    A.alphabet = new Set(alpha);
    A.states = new Map(newStates.map((s) => [s.id, s]));
    A.transitions = new Map(newTrans.map(([k, v]) => [k, new Set(Array.isArray(v) ? v : [v])]));
    A.initialId = dfa.initialId;
    bumpTransitionsVersion();
  }
  var init_algorithms = __esm({
    "js/modules/algorithms.js"() {
      init_state();
    }
  });

  // js/main.js
  init_state();

  // js/modules/ui.js
  init_state();
  init_algorithms();
  init_state();

  // examples/afd_ends_with_a.json
  var afd_ends_with_a_default = {
    version: 3,
    alphabet: ["a", "b"],
    states: [
      { id: "q0", name: "q0", x: 200, y: 220, isInitial: true, isFinal: false },
      { id: "q1", name: "q1", x: 380, y: 220, isInitial: false, isFinal: true }
    ],
    nextId: 2,
    transitions: [
      ["q0|a", ["q1"]],
      ["q0|b", ["q0"]],
      ["q1|a", ["q1"]],
      ["q1|b", ["q0"]]
    ],
    initialId: "q0"
  };

  // examples/afd_binary_divisible_by_3.json
  var afd_binary_divisible_by_3_default = {
    version: 3,
    alphabet: ["0", "1"],
    states: [
      { id: "q0", name: "q0", x: 200, y: 200, isInitial: true, isFinal: true },
      { id: "q1", name: "q1", x: 380, y: 200, isInitial: false, isFinal: false },
      { id: "q2", name: "q2", x: 560, y: 200, isInitial: false, isFinal: false }
    ],
    nextId: 3,
    transitions: [
      ["q0|0", ["q0"]],
      ["q0|1", ["q1"]],
      ["q1|0", ["q2"]],
      ["q1|1", ["q0"]],
      ["q2|0", ["q1"]],
      ["q2|1", ["q2"]]
    ],
    initialId: "q0"
  };

  // examples/afd_parity_AB.json
  var afd_parity_AB_default = {
    version: 3,
    alphabet: ["A", "B"],
    states: [
      { id: "q0", name: "q0", x: 180, y: 200, isInitial: true, isFinal: false },
      { id: "q1", name: "q1", x: 360, y: 200, isInitial: false, isFinal: true }
    ],
    nextId: 2,
    transitions: [
      ["q0|A", ["q1"]],
      ["q1|B", ["q0"]]
    ],
    initialId: "q0"
  };

  // examples/afn_lambda_a_or_ab.json
  var afn_lambda_a_or_ab_default = {
    version: 3,
    alphabet: ["a", "b", "\u03BB"],
    states: [
      { id: "s0", name: "s0", x: 160, y: 200, isInitial: true, isFinal: false },
      { id: "s1", name: "s1", x: 320, y: 200, isInitial: false, isFinal: false },
      { id: "s2", name: "s2", x: 500, y: 200, isInitial: false, isFinal: true }
    ],
    nextId: 3,
    transitions: [
      ["s0|a", ["s1"]],
      ["s1|b", ["s2"]],
      ["s1|\u03BB", ["s2"]]
    ],
    initialId: "s0"
  };

  // js/modules/examples.js
  var EXAMPLES = [
    { label: "AFD: termina com a", data: afd_ends_with_a_default },
    { label: "AFD: m\xFAltiplos de 3 (bin\xE1rio)", data: afd_binary_divisible_by_3_default },
    { label: "AFD: alterna A/B (simples)", data: afd_parity_AB_default },
    { label: "AFN\u03BB: a ou ab", data: afn_lambda_a_or_ab_default }
  ];

  // js/modules/ui.js
  function onClick(id2, handler) {
    const el = document.getElementById(id2);
    if (el) el.addEventListener("click", handler);
  }
  function getSvgRefs() {
    return {
      svg: document.getElementById("svg"),
      gStates: document.getElementById("states"),
      gEdges: document.getElementById("edges"),
      gLabels: document.getElementById("labels"),
      gInitial: document.getElementById("initialPointers")
    };
  }
  function updateAlphabetView() {
    const el = document.getElementById("alphabetView");
    if (el) el.textContent = `\u03A3 = { ${alphaStr()} }`;
  }
  function clearSelection() {
    A.selectedIds.clear();
    A.selectedStateId = null;
    A.selectedEdge = null;
    renderAll();
  }
  function selectExclusive(id0) {
    A.selectedIds = /* @__PURE__ */ new Set([id0]);
    A.selectedStateId = id0;
    A.selectedEdge = null;
    renderStates();
  }
  function toggleSelect(id0) {
    if (A.selectedIds.has(id0)) {
      A.selectedIds.delete(id0);
      if (A.selectedStateId === id0) A.selectedStateId = null;
    } else {
      A.selectedIds.add(id0);
      A.selectedStateId = id0;
    }
    A.selectedEdge = null;
    renderStates();
  }
  function markSelected(id0) {
    selectExclusive(id0);
  }
  function setConnectMode(on, from = null) {
    A.connectMode = on;
    A.connectFrom = on ? from : null;
    document.body.classList.toggle("connect-mode", on);
    renderStates();
    if (A.selectedStateId) markSelected(A.selectedStateId);
  }
  function setSelectedEdge(src, to) {
    if (src && to) A.selectedEdge = { src, to };
    else A.selectedEdge = null;
    renderEdges();
  }
  function showBadge(msg) {
    const note = document.createElement("div");
    note.textContent = msg;
    note.className = "badge";
    Object.assign(note.style, { position: "fixed", top: "8px", right: "16px", zIndex: 500 });
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 1200);
  }
  function ensureUniqueSymbols(str) {
    return Array.from(new Set(String(str).split(",").map((s) => s.trim()).filter(Boolean)));
  }
  function exportCanvasPng() {
    const { svg: svg2 } = getSvgRefs();
    if (!svg2) return;
    function collectCssText() {
      let css = "";
      try {
        for (const s of Array.from(document.styleSheets)) {
          try {
            const rules = s.cssRules || [];
            for (const r of Array.from(rules)) css += r.cssText + "\n";
          } catch (_) {
          }
        }
      } catch (_) {
      }
      return css;
    }
    const svgNode = svg2.cloneNode(true);
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.setAttribute("type", "text/css");
    styleEl.textContent = collectCssText() || "";
    svgNode.insertBefore(styleEl, svgNode.firstChild);
    const finalize = () => {
      const bboxW = svg2.clientWidth;
      const bboxH = svg2.clientHeight;
      svgNode.setAttribute("width", String(bboxW));
      svgNode.setAttribute("height", String(bboxH));
      svgNode.setAttribute("viewBox", `0 0 ${bboxW} ${bboxH}`);
      const xml = new XMLSerializer().serializeToString(svgNode);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(bboxW * dpr);
        canvas.height = Math.floor(bboxH * dpr);
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#0f172a";
        ctx.fillRect(0, 0, bboxW, bboxH);
        ctx.drawImage(img, 0, 0, bboxW, bboxH);
        canvas.toBlob((blob) => {
          const a = document.createElement("a");
          const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
          a.download = `canvas-${ts}.png`;
          a.href = URL.createObjectURL(blob);
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setTimeout(() => URL.revokeObjectURL(a.href), 5e3);
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert("Falha ao gerar PNG.");
      };
      img.src = url;
    };
    finalize();
  }
  function renderStates() {
    const { svg: svg2, gStates, gInitial } = getSvgRefs();
    if (!svg2 || !gStates || !gInitial) return;
    gStates.innerHTML = "";
    gInitial.innerHTML = "";
    for (const s of A.states.values()) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("state");
      g.setAttribute("data-id", s.id);
      if (A.connectMode && A.connectFrom === s.id) g.classList.add("connect-from");
      const r = 24;
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", s.x);
      circle.setAttribute("cy", s.y);
      circle.setAttribute("r", r);
      circle.setAttribute("class", "st-circle" + (s.isFinal ? " final" : ""));
      const hl = runHighlight.get(s.id);
      if (hl) circle.classList.add(hl);
      else if (A.selectedIds.has(s.id) || A.selectedStateId === s.id) circle.style.stroke = s.isFinal ? "var(--danger)" : "var(--ok)";
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", s.x);
      label.setAttribute("y", s.y + 4);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "st-label");
      label.textContent = s.name;
      g.appendChild(circle);
      g.appendChild(label);
      if (A.selectedStateId === s.id) {
        if (!runHighlight.has(s.id)) circle.style.stroke = s.isFinal ? "var(--danger)" : "var(--ok)";
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "path");
        handle.setAttribute("d", "M19.902 4.098a3.75 3.75 0 0 0-5.304 0l-4.5 4.5a3.75 3.75 0 0 0 1.035 6.037.75.75 0 0 1-.646 1.353 5.25 5.25 0 0 1-1.449-8.45l4.5-4.5a5.25 5.25 0 1 1 7.424 7.424l-1.757 1.757a.75.75 0 1 1-1.06-1.06l1.757-1.757a3.75 3.75 0 0 0 0-5.304Zm-7.389 4.267a.75.75 0 0 1 1-.353 5.25 5.25 0 0 1 1.449 8.45l-4.5 4.5a5.25 5.25 0 1 1-7.424-7.424l1.757-1.757a.75.75 0 1 1 1.06 1.06l-1.757 1.757a3.75 3.75 0 1 0 5.304 5.304l4.5-4.5a3.75 3.75 0 0 0-1.035-6.037.75.75 0 0 1-.354-1Z");
        handle.setAttribute("class", "connect-handle");
        handle.setAttribute("transform", `translate(${s.x + r + 6},${s.y - r - 22}) scale(0.66)`);
        handle.addEventListener("mousedown", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          setConnectMode(true, s.id);
        });
        g.appendChild(handle);
        const renameHandle = document.createElementNS("http://www.w3.org/2000/svg", "path");
        renameHandle.setAttribute("d", "M2.69509 14.7623L1.4333 17.9168C1.27004 18.3249 1.67508 18.73 2.08324 18.5667L5.2377 17.3049C5.74067 17.1037 6.19753 16.8025 6.58057 16.4194L17.4998 5.50072C18.3282 4.67229 18.3282 3.32914 17.4998 2.50072C16.6713 1.67229 15.3282 1.67229 14.4998 2.50071L3.58057 13.4194C3.19752 13.8025 2.89627 14.2593 2.69509 14.7623Z");
        renameHandle.setAttribute("class", "rename-handle");
        renameHandle.setAttribute("transform", `translate(${s.x + r + 6},${s.y - r - 44}) scale(0.66)`);
        renameHandle.addEventListener("mousedown", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          const newName = prompt("Novo nome do estado:", s.name);
          if (newName && newName.trim() !== "") {
            s.name = newName.trim();
            saveLS();
            renderAll();
          }
        });
        g.appendChild(renameHandle);
      }
      g.addEventListener("mousedown", (ev) => {
        if (ev.detail === 2) return;
        const sid = s.id;
        if (A.connectMode) {
          if (!A.connectFrom) {
            setConnectMode(true, sid);
            selectExclusive(sid);
          } else {
            const from = A.connectFrom, to = sid;
            if (!A.alphabet.size) {
              alert("Defina \u03A3 (alfabeto) primeiro.");
              setConnectMode(false);
              return;
            }
            promptSymbolAndCreate(from, to);
            setConnectMode(false);
          }
          return;
        }
        const wasSelected = A.selectedIds.has(sid) || A.selectedStateId === sid;
        if (ev.shiftKey) {
          toggleSelect(sid);
          return;
        }
        if (!wasSelected) {
          selectExclusive(sid);
        }
        startDrag(ev, sid, wasSelected);
      });
      g.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        const newName = prompt("Novo nome do estado:", s.name);
        if (newName && newName.trim() !== "") {
          s.name = newName.trim();
          saveLS();
          renderAll();
        }
      });
      gStates.appendChild(g);
      if (s.isInitial) {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const ex = s.x - r - 2, ey = s.y;
        const sx = ex - 42, sy = ey;
        p.setAttribute("d", `M ${sx},${sy} L ${ex},${ey}`);
        p.setAttribute("class", "edge initialPointer");
        p.setAttribute("marker-end", "url(#arrow)");
        gInitial.appendChild(p);
      }
    }
  }
  function groupEdges() {
    const map = /* @__PURE__ */ new Map();
    for (const [k, dests] of A.transitions.entries()) {
      const [src, sym] = k.split("|");
      for (const to of dests) {
        const gk = `${src}|${to}`;
        if (!map.has(gk)) map.set(gk, { src, to, syms: [] });
        map.get(gk).syms.push(sym);
      }
    }
    return Array.from(map.values());
  }
  var _edgesCache = { version: -1, grouped: [] };
  function groupEdgesCached() {
    const v = getTransitionsVersion();
    if (_edgesCache.version === v) return _edgesCache.grouped;
    const g = groupEdges();
    _edgesCache = { version: v, grouped: g };
    return g;
  }
  function edgePathTrimmed(a, b) {
    const SA = A.states.get(a), SB = A.states.get(b);
    const r = 24;
    if (a === b) {
      const cx2 = SA.x, cy2 = SA.y - r;
      const sx2 = cx2 + r, sy2 = cy2;
      const ex2 = cx2 - r, ey2 = cy2;
      return `M ${sx2},${sy2} Q ${cx2},${cy2 - 40} ${ex2},${ey2}`;
    }
    const midx = (SA.x + SB.x) / 2, midy = (SA.y + SB.y) / 2;
    const dx = SB.x - SA.x, dy = SB.y - SA.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = 28;
    const ux = -dy / len * off, uy = dx / len * off;
    const cx = midx + ux, cy = midy + uy;
    let ux2 = cx - SA.x, uy2 = cy - SA.y;
    let un = Math.hypot(ux2, uy2) || 1;
    ux2 /= un;
    uy2 /= un;
    const sx = SA.x + ux2 * (r + 2), sy = SA.y + uy2 * (r + 2);
    let vx = SB.x - cx, vy = SB.y - cy;
    let vn = Math.hypot(vx, vy) || 1;
    vx /= vn;
    vy /= vn;
    const ex = SB.x - vx * (r + 2), ey = SB.y - vy * (r + 2);
    return `M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`;
  }
  function editEdgeSymbols(src, to) {
    const current = [];
    for (const [k, dests] of A.transitions.entries()) {
      const [s, sym] = k.split("|");
      if (s === src && dests.has(to)) current.push(sym);
    }
    const raw = window.prompt(`S\xEDmbolos para ${A.states.get(src)?.name || src} \u2192 ${A.states.get(to)?.name || to}
Separe por v\xEDrgula.`, current.sort().join(","));
    if (raw === null) return;
    const list = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
    const allowed = new Set(list.filter((sym) => {
      if (sym === "\u03BB") return true;
      return sym.length === 1 && A.alphabet.has(sym);
    }));
    for (const sym of current) {
      if (!allowed.has(sym)) {
        const k = keyTS(src, sym);
        const set = A.transitions.get(k);
        if (set) {
          set.delete(to);
          if (!set.size) A.transitions.delete(k);
        }
      }
    }
    for (const sym of allowed) {
      const k = keyTS(src, sym);
      if (!A.transitions.has(k)) A.transitions.set(k, /* @__PURE__ */ new Set());
      const set = A.transitions.get(k);
      if (set.size && !set.has(to)) set.clear();
      set.add(to);
    }
    bumpTransitionsVersion();
    renderAll();
    saveLS();
  }
  function renderEdges() {
    const { gEdges, gLabels } = getSvgRefs();
    const elTransitionsList = document.getElementById("transitionsList");
    if (!gEdges || !gLabels) return;
    gEdges.innerHTML = "";
    gLabels.innerHTML = "";
    const grouped = groupEdgesCached();
    for (const e of grouped) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", edgePathTrimmed(e.src, e.to));
      path.setAttribute("class", "edge");
      path.setAttribute("marker-end", "url(#arrow)");
      path.dataset.src = e.src;
      path.dataset.to = e.to;
      if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) path.classList.add("sel");
      path.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) {
          setSelectedEdge(null);
        } else {
          setSelectedEdge(e.src, e.to);
        }
      });
      path.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        editEdgeSymbols(e.src, e.to);
      });
      gEdges.appendChild(path);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("class", "edge-label");
      const sA = A.states.get(e.src), sB = A.states.get(e.to);
      const mx = (sA.x + sB.x) / 2, my = (sA.y + sB.y) / 2;
      let dx = sB.x - sA.x, dy = sB.y - sA.y;
      const norm = Math.hypot(dx, dy) || 1;
      const nx = -dy / norm * 12, ny = dx / norm * 12;
      if (e.src === e.to) {
        t.setAttribute("x", sA.x + 2);
        t.setAttribute("y", sA.y - 44);
      } else {
        t.setAttribute("x", mx + nx);
        t.setAttribute("y", my + ny);
      }
      t.textContent = e.syms.sort().join(" , ");
      t.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (A.selectedEdge && A.selectedEdge.src === e.src && A.selectedEdge.to === e.to) {
          setSelectedEdge(null);
        } else {
          setSelectedEdge(e.src, e.to);
        }
      });
      t.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        editEdgeSymbols(e.src, e.to);
      });
      gLabels.appendChild(t);
    }
    if (elTransitionsList) {
      elTransitionsList.innerHTML = "";
      for (const [k, dests] of A.transitions.entries()) {
        const [src, sym] = k.split("|");
        for (const to of dests) {
          const item = document.createElement("div");
          const s1 = document.createElement("span");
          s1.className = "kbd";
          s1.textContent = A.states.get(src)?.name || src;
          const mid1 = document.createTextNode(" , ");
          const s2 = document.createElement("span");
          s2.className = "kbd";
          s2.textContent = sym;
          const mid2 = document.createTextNode(" \u2192 ");
          const s3 = document.createElement("span");
          s3.className = "kbd";
          s3.textContent = A.states.get(to)?.name || to;
          const edit = document.createElement("button");
          edit.className = "mini";
          edit.style.marginLeft = "8px";
          edit.textContent = "editar";
          edit.title = "Editar s\xEDmbolos desta aresta (origem\u2192destino)";
          edit.onclick = () => editEdgeSymbols(src, to);
          const btn = document.createElement("button");
          btn.className = "mini btn-danger";
          btn.style.marginLeft = "8px";
          btn.textContent = "remover";
          btn.title = "Remover apenas este s\xEDmbolo";
          btn.onclick = () => {
            dests.delete(to);
            if (!dests.size) A.transitions.delete(k);
            bumpTransitionsVersion();
            renderAll();
            saveLS();
          };
          item.appendChild(s1);
          item.appendChild(mid1);
          item.appendChild(s2);
          item.appendChild(mid2);
          item.appendChild(s3);
          item.appendChild(edit);
          item.appendChild(btn);
          elTransitionsList.appendChild(item);
        }
      }
    }
  }
  function renderAll() {
    renderStates();
    renderEdges();
    updateDfaCompletenessBadge();
    if (document.getElementById("deltaTable")) renderDeltaTable();
    updateAlphabetView();
  }
  function startDrag(ev, sid, wasSelectedOnDown = false) {
    const { svg: svg2 } = getSvgRefs();
    if (!svg2) return;
    const movingIds = A.selectedIds.has(sid) && A.selectedIds.size > 0 ? Array.from(A.selectedIds) : [sid];
    const movingStates = movingIds.map((id2) => A.states.get(id2)).filter(Boolean);
    const pt = svg2.createSVGPoint();
    const starts = new Map(movingStates.map((s) => [s.id, { x: s.x, y: s.y }]));
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = svg2.getScreenCTM().inverse();
    let p0 = pt.matrixTransform(m);
    let rafPending = false;
    let lastClient = { x: ev.clientX, y: ev.clientY };
    let __dragMoved = false;
    function tick() {
      rafPending = false;
      pt.x = lastClient.x;
      pt.y = lastClient.y;
      const p = pt.matrixTransform(m);
      const dx = p.x - p0.x, dy = p.y - p0.y;
      for (const ms of movingStates) {
        const st = starts.get(ms.id);
        ms.x = clamp(st.x + dx, 30, svg2.clientWidth - 30);
        ms.y = clamp(st.y + dy, 30, svg2.clientHeight - 30);
      }
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) __dragMoved = true;
      renderAll();
    }
    function onMove(e) {
      lastClient.x = e.clientX;
      lastClient.y = e.clientY;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(tick);
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
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
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function promptSymbolAndCreate(from, to) {
    const syms = Array.from(A.alphabet);
    const defaultSym = "\u03BB";
    const raw = window.prompt(`S\xEDmbolo(s) da transi\xE7\xE3o ${A.states.get(from).name} \u2192 ${A.states.get(to).name}
Separe por v\xEDrgula. \u03A3 = { ${syms.join(", ")} }`, defaultSym);
    if (raw === null) return;
    const parts = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
    if (!parts.length) return;
    const errors = [];
    let created = 0;
    for (let sym of parts) {
      if (sym === "") continue;
      if (sym !== "\u03BB" && (!A.alphabet.has(sym) || sym.length !== 1)) {
        errors.push(`s\xEDmbolo inv\xE1lido: "${sym}"`);
        continue;
      }
      const k = keyTS(from, sym);
      if (!A.transitions.has(k)) A.transitions.set(k, /* @__PURE__ */ new Set());
      A.transitions.get(k).add(to);
      created++;
    }
    if (created) {
      bumpTransitionsVersion();
      renderAll();
      saveLS();
    }
    if (errors.length) alert(errors.join("\n"));
  }
  function renderDeltaTable() {
    const host = document.getElementById("deltaTable");
    if (!host) return;
    const symbols = Array.from(A.alphabet).filter((s) => s !== "\u03BB");
    const states = Array.from(A.states.values());
    const byId = new Map(states.map((s) => [s.id, s]));
    const idList = states.map((s) => s.id);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    const th0 = document.createElement("th");
    th0.textContent = "q";
    th0.style.textAlign = "left";
    trh.appendChild(th0);
    for (const a of symbols) {
      const th = document.createElement("th");
      th.textContent = a;
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const s of states) {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.textContent = s.name || s.id;
      tr.appendChild(tdName);
      for (const a of symbols) {
        const td = document.createElement("td");
        const k = keyTS(s.id, a);
        const set = A.transitions.get(k);
        const cur = set && set.size ? Array.from(set)[0] : "";
        const sel = document.createElement("select");
        const optEmpty = document.createElement("option");
        optEmpty.value = "";
        optEmpty.textContent = "\u2014";
        sel.appendChild(optEmpty);
        for (const id2 of idList) {
          const opt = document.createElement("option");
          opt.value = id2;
          opt.textContent = byId.get(id2)?.name || id2;
          sel.appendChild(opt);
        }
        sel.value = cur || "";
        sel.addEventListener("change", () => {
          if (sel.value === "") {
            A.transitions.delete(k);
          } else {
            A.transitions.set(k, /* @__PURE__ */ new Set([sel.value]));
          }
          bumpTransitionsVersion();
          renderAll();
          saveLS();
        });
        td.appendChild(sel);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    host.innerHTML = "";
    host.appendChild(table);
  }
  function analyzeDfaCompleteness() {
    const result = { complete: true, nondet: false, missing: 0, lambda: false };
    const alpha = Array.from(A.alphabet).filter((s) => s !== "\u03BB");
    if (!alpha.length || A.states.size === 0) {
      result.complete = false;
      return result;
    }
    for (const k of A.transitions.keys()) if (k.endsWith("|\u03BB")) {
      result.lambda = true;
      result.complete = false;
    }
    for (const s of A.states.values()) {
      for (const sym of alpha) {
        const set = A.transitions.get(keyTS(s.id, sym));
        if (!set || set.size === 0) {
          result.missing++;
          result.complete = false;
        } else if (set.size > 1) {
          result.nondet = true;
          result.complete = false;
        }
      }
    }
    return result;
  }
  function updateDfaCompletenessBadge() {
    const wrapper = document.getElementById("canvasWrapper");
    if (!wrapper) return;
    let el = document.getElementById("dfaBadge");
    const info = analyzeDfaCompleteness();
    if (!el) {
      el = document.createElement("div");
      el.id = "dfaBadge";
      el.className = "badge";
      Object.assign(el.style, { position: "absolute", top: "8px", right: "8px", zIndex: 50 });
      wrapper.appendChild(el);
    }
    if (info.complete) {
      el.textContent = "Completo";
      el.style.borderColor = "rgba(52, 211, 153, .45)";
      el.style.background = "rgba(52,211,153,.12)";
    } else {
      let txt = "Incompleto";
      if (info.lambda) txt += " (\u03BB)";
      if (info.nondet) txt += " (ND)";
      if (info.missing) txt += ` (faltam ${info.missing})`;
      el.textContent = txt;
      el.style.borderColor = "rgba(251, 113, 133, .45)";
      el.style.background = "rgba(251,113,133,.12)";
    }
  }
  function showHelp() {
    const msg = [
      "Ajuda r\xE1pida \u2013 Intera\xE7\xE3o com o Canvas",
      "",
      "Sele\xE7\xE3o:",
      "\u2022 Clique: seleciona um estado; Shift+Clique: sele\xE7\xE3o m\xFAltipla.",
      "\u2022 Shift+Arrastar no vazio: sele\xE7\xE3o por ret\xE2ngulo (v\xE1rios estados).",
      "\u2022 Clique na aresta/label: seleciona aresta; Delete remove s\xEDmbolos (prompt).",
      "",
      "Edi\xE7\xE3o:",
      "\u2022 C: alterna modo de conex\xE3o; clique origem \u2192 destino e digite s\xEDmbolo(s).",
      "\u2022 E: editar estado (renomear) ou aresta (s\xEDmbolos) da sele\xE7\xE3o.",
      "\u2022 Duplo-clique no r\xF3tulo da aresta: editar s\xEDmbolos da aresta.",
      "\u2022 V\xE1rias transi\xE7\xF5es de uma vez: separe s\xEDmbolos por v\xEDrgula (ex.: a,b,c).",
      "",
      "Layout:",
      "\u2022 Setas: deslocam a sele\xE7\xE3o (Shift duplica o passo).",
      "\u2022 Presets: Compacto, Balanceado e Espalhar aplicam auto\u2011layout.",
      "\u2022 Ctrl+Shift+D: Completar AFD (quando aplic\xE1vel).",
      "",
      "Execu\xE7\xE3o: use \u201CRodar\u201D ou \u201CModo Run\u201D para simular palavras."
    ].join("\n");
    alert(msg);
  }
  function setupUIEventListeners() {
    onClick("addStateBtn", () => {
      const s = { id: id(), name: "", x: 120 + Math.random() * 320, y: 120 + Math.random() * 220, isInitial: A.states.size === 0, isFinal: false };
      s.name = s.id;
      A.states.set(s.id, s);
      if (s.isInitial) A.initialId = s.id;
      markSelected(s.id);
      renderAll();
      saveLS();
    });
    onClick("toggleInitialBtn", () => {
      if (!A.selectedStateId) return;
      for (const st of A.states.values()) st.isInitial = false;
      A.states.get(A.selectedStateId).isInitial = true;
      A.initialId = A.selectedStateId;
      renderAll();
      saveLS();
    });
    onClick("toggleFinalBtn", () => {
      if (!A.selectedStateId) return;
      const s = A.states.get(A.selectedStateId);
      s.isFinal = !s.isFinal;
      renderAll();
      saveLS();
    });
    onClick("deleteSelectedBtn", () => {
      if (!A.selectedStateId) return;
      const sid = A.selectedStateId;
      for (const [k, set] of Array.from(A.transitions.entries())) {
        const [src] = k.split("|");
        if (src === sid) {
          A.transitions.delete(k);
          continue;
        }
        if (set.has(sid)) {
          set.delete(sid);
          if (set.size === 0) A.transitions.delete(k);
        }
      }
      A.states.delete(sid);
      if (A.initialId === sid) A.initialId = void 0;
      A.selectedStateId = null;
      bumpTransitionsVersion();
      renderAll();
      saveLS();
    });
    onClick("editBtn", () => {
      if (A.selectedEdge) {
        editEdgeSymbols(A.selectedEdge.src, A.selectedEdge.to);
      } else if (A.selectedStateId) {
        const s = A.states.get(A.selectedStateId);
        const newName = prompt("Novo nome do estado:", s.name);
        if (newName && newName.trim() !== "") {
          s.name = newName.trim();
          saveLS();
          renderAll();
        }
      } else {
        alert("Selecione um estado ou uma aresta para editar.");
      }
    });
    onClick("resetBtn", () => {
      if (confirm("Limpar AF atual?")) {
        resetAll();
        updateAlphabetView();
        renderAll();
      }
    });
    const setAlphaBtn = document.getElementById("setAlphabetBtn");
    if (setAlphaBtn) setAlphaBtn.onclick = () => {
      const raw = document.getElementById("alphabetInput").value;
      const syms = ensureUniqueSymbols(raw);
      A.alphabet = new Set(syms);
      updateAlphabetView();
      renderAll();
      saveLS();
    };
    const exportBtn = document.getElementById("exportBtn");
    const importBtn = document.getElementById("importBtn");
    const importFile = document.getElementById("importFile");
    const TYPE_LABEL = "afd";
    if (exportBtn) exportBtn.onclick = () => {
      const data = snapshot();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `${TYPE_LABEL}-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
    if (importBtn && importFile) {
      importBtn.onclick = () => importFile.click();
      importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const obj = JSON.parse(reader.result);
            if (!confirm("Importar ir\xE1 substituir o AFD atual. Continuar?")) {
              importFile.value = "";
              return;
            }
            restoreFromObject(obj);
            saveLS();
            renderAll();
          } catch (err) {
            alert("Arquivo inv\xE1lido: " + err.message);
          } finally {
            importFile.value = "";
          }
        };
        reader.readAsText(file);
      };
    }
    onClick("layoutPresetCompactBtn", () => applyLayoutPreset("compact"));
    onClick("layoutPresetBalancedBtn", () => applyLayoutPreset("balanced"));
    onClick("layoutPresetSpreadBtn", () => applyLayoutPreset("spread"));
    onClick("exportPngBtn", () => exportCanvasPng());
    const hasAFNops = !!document.getElementById("concatBtn");
    if (hasAFNops) {
      onClick("unionBtn", () => importTwoNFAs("union"));
      onClick("concatBtn", () => importTwoNFAs("concat"));
      onClick("closureBtn", () => importOneNFAStar());
    } else {
      onClick("unionBtn", () => importTwoAndCombine("union"));
      onClick("intersectionBtn", () => importTwoAndCombine("intersection"));
      onClick("differenceBtn", () => importTwoAndCombine("difference"));
      onClick("equivalenceBtn", () => importTwoAndCheckEquivalence());
    }
    onClick("completeDfaBtn", () => {
      completeCurrentDfa();
      renderAll();
      saveLS();
    });
    onClick("complementBtn", () => {
      complementCurrentDfa();
      renderAll();
      saveLS();
    });
    onClick("prefixClosureBtn", () => {
      prefixClosureCurrentDfa();
      renderAll();
      saveLS();
    });
    onClick("suffixClosureBtn", () => {
      suffixClosureCurrentDfa();
      renderAll();
      saveLS();
    });
    onClick("lambdaToNfaBtn", () => {
      emitAlgoStep("removeLambda", "start", {});
      removeLambdaTransitions();
      renderAll();
      saveLS();
    });
    onClick("nfaToDfaBtn", () => {
      emitAlgoStep("nfaToDfa", "start", {});
      convertNfaToDfa();
      renderAll();
      saveLS();
    });
    onClick("nfaToDfaOpenBtn", () => {
      emitAlgoStep("nfaToDfa", "start", {});
      const before = Array.from(A.transitions.keys()).some((k) => k.endsWith("|\u03BB"));
      if (before) {
        alert("Remova transi\xE7\xF5es \u03BB antes de converter para AFD.");
        return;
      }
      convertNfaToDfa();
      renderAll();
      saveLS();
      pushCrossImport("index.html");
    });
    const buildRegexBtn = document.getElementById("buildRegexBtn");
    if (buildRegexBtn) buildRegexBtn.onclick = () => {
      const allowEps = document.getElementById("allowEpsilon")?.checked || false;
      const elRegexOut = document.getElementById("regexOut");
      const elRegexMsg = document.getElementById("regexMsg");
      emitAlgoStep("dfaToRegex", "start", {});
      const res = dfaToRegex(allowEps);
      if (elRegexOut) elRegexOut.textContent = res.output || "";
      if (elRegexMsg) elRegexMsg.innerHTML = res.msg || "";
    };
    onClick("helpBtn", () => showHelp());
    (function initExamplesMenu() {
      const sel = document.getElementById("examplesSelect");
      const btn = document.getElementById("loadExampleBtn");
      if (!sel || !btn) return;
      EXAMPLES.forEach((ex, idx) => {
        const opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = ex.label;
        sel.appendChild(opt);
      });
      btn.addEventListener("click", () => {
        const idx = sel.value;
        if (idx === "") return;
        try {
          const data = EXAMPLES[Number(idx)].data;
          restoreFromObject(data);
          saveLS();
          renderAll();
        } catch (e) {
          alert("Falha ao carregar exemplo.");
        }
      });
    })();
    document.addEventListener("keydown", (ev) => {
      if (ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA")) return;
      if (ev.key.toLowerCase() === "c") {
        if (A.connectMode) setConnectMode(false);
        else setConnectMode(true, A.selectedStateId || null);
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === "d") {
        completeCurrentDfa();
        ev.preventDefault();
        renderAll();
        saveLS();
        return;
      }
      if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key.toLowerCase() === "e") {
        const s = A.selectedStateId && A.states.get(A.selectedStateId);
        if (A.selectedEdge) {
          editEdgeSymbols(A.selectedEdge.src, A.selectedEdge.to);
        } else if (s) {
          const newName = prompt("Novo nome do estado:", s.name);
          if (newName && newName.trim() !== "") {
            s.name = newName.trim();
            saveLS();
            renderAll();
          }
        }
        ev.preventDefault();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) {
        const ids = A.selectedIds.size ? Array.from(A.selectedIds) : A.selectedStateId ? [A.selectedStateId] : [];
        if (ids.length) {
          const { svg: svg3 } = getSvgRefs();
          const step = 5 * (ev.shiftKey ? 2 : 1);
          for (const id0 of ids) {
            const s = A.states.get(id0);
            if (!s || !svg3) continue;
            if (ev.key === "ArrowLeft") s.x = clamp(s.x - step, 30, svg3.clientWidth - 30);
            if (ev.key === "ArrowRight") s.x = clamp(s.x + step, 30, svg3.clientWidth - 30);
            if (ev.key === "ArrowUp") s.y = clamp(s.y - step, 30, svg3.clientHeight - 30);
            if (ev.key === "ArrowDown") s.y = clamp(s.y + step, 30, svg3.clientHeight - 30);
          }
          renderAll();
          saveLS();
          ev.preventDefault();
        }
        return;
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (A.selectedEdge) {
          const { src, to } = A.selectedEdge;
          const syms = [];
          for (const [k, set] of A.transitions.entries()) {
            const [from, sym] = k.split("|");
            if (from === src && set.has(to)) syms.push(sym);
          }
          if (!syms.length) {
            A.selectedEdge = null;
            renderAll();
            return;
          }
          const name = (x) => A.states.get(x)?.name || x;
          const input = window.prompt(`Remover quais s\xEDmbolos para ${name(src)} \u2192 ${name(to)}?
Separe por v\xEDrgula ou digite * para todos.
Atuais: ${syms.sort().join(", ")}`, syms.sort().join(","));
          if (input === null) {
            ev.preventDefault();
            return;
          }
          const trimmed = input.trim();
          let toRemove = [];
          if (trimmed === "") {
            ev.preventDefault();
            return;
          } else if (trimmed === "*" || trimmed.toLowerCase() === "todos" || trimmed.toLowerCase() === "all") {
            toRemove = syms.slice();
          } else {
            const asked = Array.from(new Set(trimmed.split(",").map((s) => s.trim()).filter(Boolean)));
            toRemove = asked.filter((s) => syms.includes(s));
          }
          if (!toRemove.length) {
            ev.preventDefault();
            return;
          }
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
            const still = Array.from(A.transitions.entries()).some(([k, set]) => {
              const [from] = k.split("|");
              return from === src && set.has(to);
            });
            if (!still) A.selectedEdge = null;
            bumpTransitionsVersion();
            renderAll();
            saveLS();
          }
          ev.preventDefault();
          return;
        }
        const toDelete = A.selectedIds.size ? Array.from(A.selectedIds) : A.selectedStateId ? [A.selectedStateId] : [];
        if (toDelete.length) {
          for (const sid of toDelete) {
            for (const [k, set] of Array.from(A.transitions.entries())) {
              const [src] = k.split("|");
              if (src === sid) {
                A.transitions.delete(k);
                continue;
              }
              if (set.has(sid)) {
                set.delete(sid);
                if (set.size === 0) A.transitions.delete(k);
              }
            }
            A.states.delete(sid);
            if (A.initialId === sid) A.initialId = void 0;
          }
          A.selectedIds.clear();
          A.selectedStateId = null;
          bumpTransitionsVersion();
          renderAll();
          saveLS();
          ev.preventDefault();
        }
      }
    });
    const { svg: svg2 } = getSvgRefs();
    if (svg2) {
      svg2.addEventListener("click", () => {
        setSelectedEdge(null);
      });
      svg2.addEventListener("mousedown", (ev) => {
        if (ev.target.closest && ev.target.closest("g.state")) return;
        if (!ev.shiftKey) return;
        ev.preventDefault();
        const pt = svg2.createSVGPoint();
        const m = svg2.getScreenCTM().inverse();
        pt.x = ev.clientX;
        pt.y = ev.clientY;
        let p0 = pt.matrixTransform(m);
        let x0 = p0.x, y0 = p0.y, x1 = x0, y1 = y0;
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("fill", "rgba(34,211,238,0.15)");
        rect.setAttribute("stroke", "var(--accent)");
        rect.setAttribute("stroke-dasharray", "4 2");
        rect.setAttribute("rx", "4");
        svg2.appendChild(rect);
        function update() {
          const x = Math.min(x0, x1), y = Math.min(y0, y1);
          const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
          rect.setAttribute("x", x);
          rect.setAttribute("y", y);
          rect.setAttribute("width", w);
          rect.setAttribute("height", h);
        }
        function onMove(e) {
          pt.x = e.clientX;
          pt.y = e.clientY;
          const p = pt.matrixTransform(m);
          x1 = p.x;
          y1 = p.y;
          update();
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          svg2.removeChild(rect);
          const x = Math.min(x0, x1), y = Math.min(y0, y1);
          const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
          if (w < 2 && h < 2) return;
          const newly = [];
          for (const s of A.states.values()) {
            if (s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h) newly.push(s.id);
          }
          for (const id0 of newly) A.selectedIds.add(id0);
          if (newly.length) {
            A.selectedStateId = newly[newly.length - 1];
            renderStates();
          }
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    }
    onClick("helpBtn", () => showHelp());
  }
  function autoLayout(params) {
    const { svg: svg2 } = getSvgRefs();
    if (!svg2) return;
    const W = svg2.clientWidth || 800, H = svg2.clientHeight || 500;
    const nodes = Array.from(A.states.values());
    if (nodes.length <= 1) return;
    const edges = [];
    for (const [k, dests] of A.transitions.entries()) {
      const [src, sym] = k.split("|");
      if (sym === "\u03BB") continue;
      for (const to of dests) edges.push([src, to]);
    }
    const pos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, vx: 0, vy: 0 }]));
    const p = params || { it: 200, rep: 8e3, K: 0.02, damp: 0.85, center: true };
    const K = p.K, REP = p.rep, DAMP = p.damp, ITER = p.it, MAXS = 8;
    function apply() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id), b = pos.get(nodes[j].id);
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = dx * dx + dy * dy;
          }
          const f = REP / d2;
          const fx = f * dx, fy = f * dy;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      for (const [u, v] of edges) {
        const a = pos.get(u), b = pos.get(v);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const fx = K * dx, fy = K * dy;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      for (const n of nodes) {
        const p0 = pos.get(n.id);
        p0.vx *= DAMP;
        p0.vy *= DAMP;
        const s = Math.min(1, MAXS / (Math.hypot(p0.vx, p0.vy) || 1));
        n.x = clamp(p0.x + p0.vx * s, 30, W - 30);
        n.y = clamp(p0.y + p0.vy * s, 30, H - 30);
        p0.x = n.x;
        p0.y = n.y;
      }
    }
    for (let t = 0; t < ITER; t++) apply();
    if (p.center) {
      const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const targetCx = W / 2, targetCy = H / 2;
      const dx = targetCx - cx, dy = targetCy - cy;
      for (const n of nodes) {
        n.x = clamp(n.x + dx, 30, W - 30);
        n.y = clamp(n.y + dy, 30, H - 30);
      }
    }
    renderAll();
    saveLS();
  }
  function applyLayoutPreset(name) {
    const map = { compact: { it: 150, rep: 3e3, K: 0.05, damp: 0.85, center: true }, balanced: { it: 200, rep: 8e3, K: 0.02, damp: 0.85, center: true }, spread: { it: 250, rep: 2e4, K: 0.01, damp: 0.88, center: true } };
    const p = map[name] || map.balanced;
    showBadge(`Preset: ${name}`);
    autoLayout(p);
  }
  function importTwoAndCombine(op) {
    const file1 = document.getElementById("importFile1");
    const file2 = document.getElementById("importFile2");
    if (!file1 || !file2) {
      alert("Entrada de arquivo n\xE3o encontrada");
      return;
    }
    let data1 = null, data2 = null;
    file1.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        data1 = JSON.parse(reader.result);
        file2.click();
      };
      reader.readAsText(file1.files[0]);
    };
    file2.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        data2 = JSON.parse(reader.result);
        const res = combineAFDs(data1, data2, op);
        if (res) {
          restoreFromObject(res);
          saveLS();
          renderAll();
        }
      };
      reader.readAsText(file2.files[0]);
    };
    file1.click();
  }
  function importTwoAndCheckEquivalence() {
    const file1 = document.getElementById("importFile1");
    const file2 = document.getElementById("importFile2");
    if (!file1 || !file2) {
      alert("Entrada de arquivo n\xE3o encontrada");
      return;
    }
    let data1 = null, data2 = null;
    file1.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        data1 = JSON.parse(reader.result);
        file2.click();
      };
      reader.readAsText(file1.files[0]);
    };
    file2.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        data2 = JSON.parse(reader.result);
        Promise.resolve().then(() => (init_algorithms(), algorithms_exports)).then(({ areEquivalent: areEquivalent2 }) => {
          const eq = areEquivalent2(data1, data2);
          alert(eq ? "Equivalentes" : "N\xE3o equivalentes");
        });
      };
      reader.readAsText(file2.files[0]);
    };
    file1.click();
  }
  function importTwoNFAs(op) {
    const file1 = document.getElementById("importFile1");
    const file2 = document.getElementById("importFile2");
    if (!file1 || !file2) {
      alert("Entrada de arquivo n\xE3o encontrada");
      return;
    }
    let data1 = null, data2 = null;
    file1.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        data1 = JSON.parse(reader.result);
        file2.click();
      };
      reader.readAsText(file1.files[0]);
    };
    file2.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        data2 = JSON.parse(reader.result);
        const res = combineNFAs(data1, data2, op);
        if (res) {
          restoreFromObject(res);
          saveLS();
          renderAll();
        }
      };
      reader.readAsText(file2.files[0]);
    };
    file1.click();
  }
  function importOneNFAStar() {
    const file1 = document.getElementById("importFile1");
    if (!file1) {
      alert("Entrada de arquivo n\xE3o encontrada");
      return;
    }
    file1.onchange = () => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = JSON.parse(reader.result);
        const res = starNFA(data);
        if (res) {
          restoreFromObject(res);
          saveLS();
          renderAll();
        }
      };
      reader.readAsText(file1.files[0]);
    };
    file1.click();
  }

  // js/modules/run.js
  init_state();
  init_algorithms();
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function setupRunControls() {
    const elRunResult = document.getElementById("runResult");
    const elRunSteps = document.getElementById("runSteps");
    const runBtn = document.getElementById("runBtn");
    const runStartBtn = document.getElementById("runStartBtn");
    const runStepBtn = document.getElementById("runStepBtn");
    const wordInput = document.getElementById("wordInput");
    if (!elRunResult || !elRunSteps || !runBtn || !runStartBtn || !runStepBtn || !wordInput) return;
    let stepRun = null;
    function resetRunVisuals() {
      runHighlight.clear();
      renderStates();
    }
    function setRunStates(ids, status) {
      runHighlight.clear();
      ids.forEach((id2) => runHighlight.set(id2, status));
      renderStates();
    }
    function namesOf(set) {
      return Array.from(set).map((id2) => A.states.get(id2)?.name || id2).join(", ");
    }
    function addStep(t) {
      const div = document.createElement("div");
      div.textContent = t;
      elRunSteps.appendChild(div);
    }
    runBtn.onclick = () => {
      resetRunVisuals();
      elRunSteps.innerHTML = "";
      elRunResult.innerHTML = "";
      const w = (wordInput.value || "").trim().split("");
      if (!A.initialId) {
        elRunResult.innerHTML = `<span class="warn">Defina um estado inicial.</span>`;
        return;
      }
      if (!A.alphabet.size) {
        elRunResult.innerHTML = `<span class="warn">Defina \u03A3.</span>`;
        return;
      }
      for (const c of w) if (!A.alphabet.has(c)) {
        elRunResult.innerHTML = `<span class="err">HALT: s\xEDmbolo "${esc(c)}" n\xE3o pertence a \u03A3 = { ${esc(alphaStr())} }.</span>`;
        setRunStates(/* @__PURE__ */ new Set([A.initialId]), "rejected");
        return;
      }
      let cur = epsilonClosureMap(/* @__PURE__ */ new Set([A.initialId]), A.transitions);
      addStep(`In\xEDcio em {${namesOf(cur)}}`);
      setRunStates(cur, "running");
      for (const c of w) {
        let next = /* @__PURE__ */ new Set();
        for (const s of cur) {
          const k = keyTS(s, c);
          if (A.transitions.has(k)) {
            for (const dest of A.transitions.get(k)) {
              epsilonClosureMap(/* @__PURE__ */ new Set([dest]), A.transitions).forEach((d) => next.add(d));
            }
          }
        }
        if (next.size === 0) {
          elRunResult.innerHTML = `<span class="err">HALT: transi\xE7\xE3o n\xE3o definida para ({${esc(namesOf(cur))}}, ${esc(c)})</span>`;
          setRunStates(cur, "rejected");
          return;
        }
        addStep(`({${namesOf(cur)}}, ${c}) \u2192 {${namesOf(next)}}`);
        cur = next;
        setRunStates(cur, "running");
      }
      const finals = new Set([...cur].filter((id2) => A.states.get(id2)?.isFinal));
      if (finals.size) {
        elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em {${namesOf(finals)}})`;
        runHighlight.clear();
        finals.forEach((id2) => runHighlight.set(id2, "accepted"));
        [...cur].filter((id2) => !finals.has(id2)).forEach((id2) => runHighlight.set(id2, "rejected"));
        renderStates();
      } else {
        elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em {${namesOf(cur)}})`;
        setRunStates(cur, "rejected");
      }
    };
    runStartBtn.onclick = () => {
      resetRunVisuals();
      elRunSteps.innerHTML = "";
      elRunResult.innerHTML = "";
      if (!A.initialId) {
        elRunResult.innerHTML = `<span class="warn">Defina um estado inicial.</span>`;
        return;
      }
      if (!A.alphabet.size) {
        elRunResult.innerHTML = `<span class="warn">Defina \u03A3.</span>`;
        return;
      }
      const word = (wordInput.value || "").trim().split("");
      stepRun = { word, pos: 0, cur: epsilonClosureMap(/* @__PURE__ */ new Set([A.initialId]), A.transitions), halted: false };
      addStep(`In\xEDcio em {${namesOf(stepRun.cur)}}`);
      setRunStates(stepRun.cur, "running");
      if (stepRun.word.length === 0) {
        const finals = new Set([...stepRun.cur].filter((id2) => A.states.get(id2)?.isFinal));
        if (finals.size) {
          elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em {${namesOf(finals)}})`;
          runHighlight.clear();
          finals.forEach((id2) => runHighlight.set(id2, "accepted"));
          [...stepRun.cur].filter((id2) => !finals.has(id2)).forEach((id2) => runHighlight.set(id2, "rejected"));
          renderStates();
        } else {
          elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em {${namesOf(stepRun.cur)}})`;
          setRunStates(stepRun.cur, "rejected");
        }
        stepRun = null;
        runStepBtn.disabled = true;
      } else {
        runStepBtn.disabled = false;
      }
    };
    runStepBtn.onclick = () => {
      if (!stepRun || stepRun.halted) return;
      if (stepRun.pos >= stepRun.word.length) return;
      const c = stepRun.word[stepRun.pos];
      if (!A.alphabet.has(c)) {
        elRunResult.innerHTML = `<span class="err">HALT: s\xEDmbolo "${esc(c)}" n\xE3o pertence a \u03A3 = { ${esc(alphaStr())} }.</span>`;
        runStepBtn.disabled = true;
        stepRun.halted = true;
        setRunStates(stepRun.cur, "rejected");
        return;
      }
      let next = /* @__PURE__ */ new Set();
      for (const s of stepRun.cur) {
        const k = keyTS(s, c);
        if (A.transitions.has(k)) {
          for (const dest of A.transitions.get(k)) {
            epsilonClosureMap(/* @__PURE__ */ new Set([dest]), A.transitions).forEach((d) => next.add(d));
          }
        }
      }
      if (next.size === 0) {
        elRunResult.innerHTML = `<span class="err">HALT: transi\xE7\xE3o n\xE3o definida para ({${esc(namesOf(stepRun.cur))}}, ${esc(c)})</span>`;
        runStepBtn.disabled = true;
        stepRun.halted = true;
        setRunStates(stepRun.cur, "rejected");
        return;
      }
      addStep(`({${namesOf(stepRun.cur)}}, ${c}) \u2192 {${namesOf(next)}}`);
      stepRun.cur = next;
      stepRun.pos++;
      setRunStates(stepRun.cur, "running");
      if (stepRun.pos >= stepRun.word.length) {
        const finals = new Set([...stepRun.cur].filter((id2) => A.states.get(id2)?.isFinal));
        if (finals.size) {
          elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em {${namesOf(finals)}})`;
          runHighlight.clear();
          finals.forEach((id2) => runHighlight.set(id2, "accepted"));
          [...stepRun.cur].filter((id2) => !finals.has(id2)).forEach((id2) => runHighlight.set(id2, "rejected"));
          renderStates();
        } else {
          elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em {${namesOf(stepRun.cur)}})`;
          setRunStates(stepRun.cur, "rejected");
        }
        runStepBtn.disabled = true;
        stepRun = null;
      }
    };
    const svg2 = document.getElementById("svg");
    if (svg2) svg2.addEventListener("mousedown", resetRunVisuals);
    document.querySelectorAll("button").forEach((btn) => {
      if (!["runBtn", "runStartBtn", "runStepBtn"].includes(btn.id)) {
        btn.addEventListener("click", resetRunVisuals);
      }
    });
  }

  // js/modules/algoview.js
  init_state();
  function nameOf(id2) {
    return A.states.get(id2)?.name || id2;
  }
  function setupAlgoView() {
    const elSteps = document.getElementById("algoSteps");
    document.addEventListener("algoStep", (ev) => {
      if (!elSteps) return;
      const { algo, step, ...data } = ev.detail;
      if (step === "start") {
        elSteps.innerHTML = `<strong>${{ removeLambda: "AFN\u03BB \u2192 AFN", nfaToDfa: "AFN \u2192 AFD", dfaToRegex: "AFD \u2192 ER" }[algo] || algo}</strong>`;
        runHighlight.clear();
        renderStates();
        return;
      }
      const div = document.createElement("div");
      if (algo === "removeLambda") {
        if (step === "closure") {
          div.textContent = `\u03B5-fecho(${nameOf(data.state)}) = {${data.closure.map(nameOf).join(", ")}}`;
        } else if (step === "final") {
          div.textContent = `${nameOf(data.state)} ${data.isFinal ? "\xE9" : "n\xE3o \xE9"} final`;
        } else if (step === "transition") {
          div.textContent = `(${nameOf(data.from)}, ${data.sym}) \u2192 {${data.to.map(nameOf).join(", ")}}`;
          runHighlight.clear();
          runHighlight.set(data.from, "running");
          data.to.forEach((id2) => runHighlight.set(id2, "running"));
          renderStates();
        } else {
          div.textContent = `${step}`;
        }
      } else if (algo === "nfaToDfa") {
        if (step === "newState") {
          div.textContent = `novo estado ${nameOf(data.id)} = {${data.subset.map(nameOf).join(", ")}}`;
        } else if (step === "transition") {
          div.textContent = `(${nameOf(data.from)}, ${data.sym}) \u2192 ${nameOf(data.to)}`;
          runHighlight.clear();
          runHighlight.set(data.from, "running");
          runHighlight.set(data.to, "running");
          renderStates();
        } else {
          div.textContent = `${step}`;
        }
      } else if (algo === "dfaToRegex") {
        if (step === "eliminate") {
          div.textContent = `eliminando ${nameOf(data.state)}`;
          runHighlight.clear();
          runHighlight.set(data.state, "running");
          renderStates();
        } else if (step === "transition") {
          div.textContent = `${data.fromName} \u2192 ${data.toName} via ${nameOf(data.via)}: ${data.regex}`;
          runHighlight.clear();
          if (data.from) runHighlight.set(data.from, "running");
          if (data.via) runHighlight.set(data.via, "running");
          if (data.to) runHighlight.set(data.to, "running");
          renderStates();
        } else if (step === "remove") {
          div.textContent = `estado ${nameOf(data.state)} removido`;
        } else if (step === "final") {
          div.textContent = `ER = ${data.regex}`;
        } else {
          div.textContent = `${step}`;
        }
      } else {
        div.textContent = `${algo}:${step}`;
      }
      elSteps.appendChild(div);
    });
  }

  // js/modules/regex.js
  init_state();
  function isLiteral(c) {
    return /^[A-Za-z0-9]$/.test(c);
  }
  function needsConcat(a, b) {
    return (isLiteral(a) || a === ")" || a === "*" || a === "\u03BB") && (isLiteral(b) || b === "(" || b === "\u03BB");
  }
  function regexToPostfix(re) {
    re = re.replace(/\s+/g, "").replace(/∪/g, "|").replace(/ε/g, "\u03BB");
    const tokens = re.split("");
    const out = [];
    const ops = [];
    const prec = { "|": 1, ".": 2, "*": 3 };
    const right = { "*": true };
    const t2 = [];
    for (let i = 0; i < tokens.length; i++) {
      const t1 = tokens[i];
      t2.push(t1);
      const tnext = tokens[i + 1];
      if (!tnext) continue;
      if (needsConcat(t1, tnext)) t2.push(".");
    }
    for (const t of t2) {
      if (isLiteral(t) || t === "\u03BB") out.push(t);
      else if (t === "(") ops.push(t);
      else if (t === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
        if (!ops.length) throw new Error("Mismatched parens");
        ops.pop();
      } else {
        while (ops.length && ops[ops.length - 1] !== "(" && (prec[ops[ops.length - 1]] > prec[t] || prec[ops[ops.length - 1]] === prec[t] && !right[t])) out.push(ops.pop());
        ops.push(t);
      }
    }
    while (ops.length) {
      const op = ops.pop();
      if (op === "(" || op === ")") throw new Error("Mismatched parens");
      out.push(op);
    }
    return out;
  }
  function buildFromPostfix(post) {
    const stack = [];
    const alphabet = /* @__PURE__ */ new Set();
    function newState() {
      const sid = id();
      const s = { id: sid, name: sid, x: 120 + Math.random() * 320, y: 120 + Math.random() * 220, isInitial: false, isFinal: false };
      A.states.set(sid, s);
      return sid;
    }
    function addTrans(from, sym, to) {
      const k = keyTS(from, sym);
      if (!A.transitions.has(k)) A.transitions.set(k, /* @__PURE__ */ new Set());
      A.transitions.get(k).add(to);
    }
    for (const token of post) {
      if (isLiteral(token) || token === "\u03BB") {
        const s = newState();
        const f = newState();
        addTrans(s, token, f);
        if (token !== "\u03BB") alphabet.add(token);
        stack.push({ start: s, end: f });
      } else if (token === ".") {
        const b = stack.pop();
        const a = stack.pop();
        addTrans(a.end, "\u03BB", b.start);
        stack.push({ start: a.start, end: b.end });
      } else if (token === "|") {
        const b = stack.pop();
        const a = stack.pop();
        const s = newState();
        const f = newState();
        addTrans(s, "\u03BB", a.start);
        addTrans(s, "\u03BB", b.start);
        addTrans(a.end, "\u03BB", f);
        addTrans(b.end, "\u03BB", f);
        stack.push({ start: s, end: f });
      } else if (token === "*") {
        const a = stack.pop();
        const s = newState();
        const f = newState();
        addTrans(s, "\u03BB", a.start);
        addTrans(s, "\u03BB", f);
        addTrans(a.end, "\u03BB", a.start);
        addTrans(a.end, "\u03BB", f);
        stack.push({ start: s, end: f });
      } else throw new Error("Invalid token");
    }
    if (stack.length !== 1) throw new Error("Invalid ER");
    return { start: stack[0].start, end: stack[0].end, alphabet };
  }
  function buildFromRegex() {
    const rawEl = document.getElementById("regexInput");
    if (!rawEl) return;
    const raw = (rawEl.value || "").trim();
    if (!raw) return;
    try {
      const postfix = regexToPostfix(raw);
      resetNfa();
      const result = buildFromPostfix(postfix);
      A.states.get(result.start).isInitial = true;
      A.states.get(result.end).isFinal = true;
      A.initialId = result.start;
      A.alphabet = result.alphabet;
      bumpTransitionsVersion();
      updateAlphabetView();
      renderAll();
    } catch (e) {
      alert("ER inv\xE1lida");
    }
  }
  function resetNfa() {
    A.alphabet = /* @__PURE__ */ new Set();
    A.states.clear();
    A.transitions.clear();
    A.nextId = 0;
    A.initialId = void 0;
  }

  // js/modules/grammar.js
  init_state();
  init_algorithms();
  init_state();
  function buildFromGrammar() {
    const ta = document.getElementById("grammarInput");
    if (!ta) return;
    const raw = ta.value;
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    resetAllLocal();
    const ntMap = /* @__PURE__ */ new Map();
    const alphabet = /* @__PURE__ */ new Set();
    const transitions = [];
    let startNt = null;
    function ensureState(nt) {
      if (!ntMap.has(nt)) {
        const sid = id();
        const s = { id: sid, name: nt, x: 120 + Math.random() * 320, y: 120 + Math.random() * 220, isInitial: false, isFinal: false };
        A.states.set(sid, s);
        ntMap.set(nt, sid);
      }
      return ntMap.get(nt);
    }
    for (const line of lines) {
      const [lhs, rhs] = line.split("->").map((s) => s.trim());
      if (!lhs || !rhs) continue;
      if (!startNt) startNt = lhs;
      const fromId = ensureState(lhs);
      const prods = rhs.split("|").map((p) => p.trim()).filter(Boolean);
      for (const prod of prods) {
        if (prod === "\u03BB" || prod === "epsilon" || prod === "\u03B5") {
          A.states.get(fromId).isFinal = true;
          continue;
        }
        const sym = prod.charAt(0);
        alphabet.add(sym);
        const rest = prod.slice(1);
        if (!rest) {
          transitions.push([fromId, sym, "FINAL"]);
        } else {
          const toId = ensureState(rest);
          transitions.push([fromId, sym, toId]);
        }
      }
    }
    const finalId = id();
    A.states.set(finalId, { id: finalId, name: "F", x: 120 + Math.random() * 320, y: 120 + Math.random() * 220, isInitial: false, isFinal: true });
    for (const [src, sym, dest] of transitions) {
      const to = dest === "FINAL" ? finalId : dest;
      const k = keyTS(src, sym);
      if (!A.transitions.has(k)) A.transitions.set(k, /* @__PURE__ */ new Set());
      A.transitions.get(k).add(to);
    }
    A.alphabet = alphabet;
    if (startNt) {
      const initId = ntMap.get(startNt);
      A.states.get(initId).isInitial = true;
      A.initialId = initId;
    }
    updateAlphabetView();
    renderAll();
    saveLS();
  }
  function buildFromGrammarToDfa() {
    buildFromGrammar();
    convertNfaToDfa();
    renderAll();
    saveLS();
  }
  function buildFromGrammarToDfaOpen() {
    buildFromGrammarToDfa();
    pushCrossImport("index.html#afd");
  }
  function exportGrammarFromAF() {
    const withLambda = Array.from(A.transitions.keys()).filter((k) => k.endsWith("|\u03BB"));
    if (withLambda.length) {
      alert("Remova transi\xE7\xF5es \u03BB (AFN\u03BB \u2192 AFN) antes de exportar a gram\xE1tica.");
      return;
    }
    const nameOf2 = (id2) => A.states.get(id2)?.name || id2;
    const nonterminals = /* @__PURE__ */ new Map();
    const used = /* @__PURE__ */ new Set();
    for (const id2 of A.states.keys()) {
      let n = nameOf2(id2);
      if (!n || used.has(n)) n = id2;
      used.add(n);
      nonterminals.set(id2, n);
    }
    const prods = /* @__PURE__ */ new Map();
    function addProd(lhs, rhs) {
      if (!prods.has(lhs)) prods.set(lhs, []);
      prods.get(lhs).push(rhs);
    }
    for (const [k, dests] of A.transitions.entries()) {
      const [src, sym] = k.split("|");
      if (sym === "\u03BB") continue;
      for (const to of dests) {
        addProd(nonterminals.get(src), sym + nonterminals.get(to));
        if (A.states.get(to)?.isFinal) addProd(nonterminals.get(src), sym);
      }
    }
    for (const s of A.states.values()) {
      if (s.isFinal) addProd(nonterminals.get(s.id), "\u03BB");
    }
    const start = A.initialId ? nonterminals.get(A.initialId) : null;
    const keys = Array.from(prods.keys()).sort((a, b) => a.localeCompare(b));
    if (start) {
      const i = keys.indexOf(start);
      if (i > 0) {
        keys.splice(i, 1);
        keys.unshift(start);
      }
    }
    const lines = keys.map((nt) => `${nt}->${Array.from(new Set(prods.get(nt))).join("|")}`);
    const out = lines.join("\n");
    const taOut = document.getElementById("grammarOut");
    if (taOut) {
      taOut.value = out || "// Sem produ\xE7\xF5es (verifique se h\xE1 estados/transi\xE7\xF5es).";
      taOut.focus();
      taOut.select();
      try {
        document.execCommand("copy");
      } catch {
      }
    } else {
      alert(out || "Sem produ\xE7\xF5es");
    }
  }
  function resetAllLocal() {
    A.alphabet = /* @__PURE__ */ new Set();
    A.states.clear();
    A.transitions.clear();
    A.nextId = 0;
    A.initialId = void 0;
  }

  // js/main.js
  var hash = (location.hash || "").toLowerCase();
  var MODE = hash === "#afn" ? "afn" : hash === "#gr" ? "gr" : "afd";
  window.MODE = MODE;
  var LS_KEY2 = MODE === "afn" ? "afn_sim_state_v1" : MODE === "gr" ? "afn_gr_sim_state_v1" : "afd_sim_state_v3";
  setLsKey(LS_KEY2);
  var app = document.getElementById("app");
  var tpl = document.getElementById("tmpl-" + MODE);
  app.appendChild(tpl.content.cloneNode(true));
  document.querySelectorAll("nav.tabs a").forEach((a) => {
    const m = a.getAttribute("data-mode");
    if (m === MODE) a.classList.add("active");
    else a.classList.remove("active");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (m === MODE) return;
      location.hash = "#" + m;
      location.reload();
    });
  });
  window.addEventListener("hashchange", () => location.reload());
  var hadCross = checkCrossImport();
  var hadState = hadCross ? true : loadLS();
  if (!hadState) {
    A.alphabet = /* @__PURE__ */ new Set(["A", "B"]);
    const s0 = { id: "q0", name: "q0", x: 180, y: 200, isInitial: true, isFinal: false };
    const s1 = { id: "q1", name: "q1", x: 380, y: 200, isInitial: false, isFinal: true };
    A.states.set(s0.id, s0);
    A.states.set(s1.id, s1);
    A.initialId = s0.id;
    A.nextId = 2;
    A.transitions.set(`${s0.id}|A`, /* @__PURE__ */ new Set([s1.id]));
    A.transitions.set(`${s1.id}|B`, /* @__PURE__ */ new Set([s0.id]));
    saveLS();
  }
  setupUIEventListeners();
  setupRunControls();
  setupAlgoView();
  var btnRegex = document.getElementById("buildFromRegexBtn");
  if (btnRegex) btnRegex.addEventListener("click", buildFromRegex);
  var btnG = document.getElementById("buildFromGrammarBtn");
  if (btnG) btnG.addEventListener("click", buildFromGrammar);
  var btnGdfa = document.getElementById("buildFromGrammarToDfaBtn");
  if (btnGdfa) btnGdfa.addEventListener("click", buildFromGrammarToDfa);
  var btnGdfaOpen = document.getElementById("buildFromGrammarToDfaOpenBtn");
  if (btnGdfaOpen) btnGdfaOpen.addEventListener("click", buildFromGrammarToDfaOpen);
  var btnExportGr = document.getElementById("exportGrammarBtn");
  if (btnExportGr) btnExportGr.addEventListener("click", exportGrammarFromAF);
  updateAlphabetView();
  renderAll();
  var svg = document.getElementById("svg");
  if (svg) svg.addEventListener("mousedown", () => {
    runHighlight.clear();
    renderAll();
  });
})();
