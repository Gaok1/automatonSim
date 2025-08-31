const elRunResult = document.getElementById('runResult');
const elRunSteps = document.getElementById('runSteps');
const runBtn = document.getElementById('runBtn');
const runStartBtn = document.getElementById('runStartBtn');
const runStepBtn = document.getElementById('runStepBtn');
let stepRun = null;

function resetRunVisuals() {
  runHighlight.clear();
  renderStates();
}

function setRunStates(ids, status) {
  runHighlight.clear();
  ids.forEach(id => runHighlight.set(id, status));
  renderStates();
}

function namesOf(set) {
  return Array.from(set).map(id => A.states.get(id)?.name || id).join(', ');
}

function epsilonClosure(states) {
  const stack = Array.from(states);
  const closure = new Set(states);
  while (stack.length) {
    const s = stack.pop();
    const k = keyTS(s, 'λ');
    if (A.transitions.has(k)) {
      for (const nxt of A.transitions.get(k)) {
        if (!closure.has(nxt)) { closure.add(nxt); stack.push(nxt); }
      }
    }
  }
  return closure;
}

runBtn.onclick = () => {
  resetRunVisuals();
  elRunSteps.innerHTML = '';
  elRunResult.innerHTML = '';
  const w = (document.getElementById('wordInput').value || '').trim().split('');
  if (!A.initialId) { elRunResult.innerHTML = `<span class="warn">Defina um estado inicial.</span>`; return; }
  if (!A.alphabet.size) { elRunResult.innerHTML = `<span class="warn">Defina Σ.</span>`; return; }
  for (const c of w) if (!A.alphabet.has(c)) {
    elRunResult.innerHTML = `<span class="err">HALT: símbolo \"${c}\" não pertence a Σ = { ${alphaStr()} }.</span>`;
    setRunStates(new Set([A.initialId]), 'rejected');
    return;
  }
  let cur = epsilonClosure(new Set([A.initialId]));
  addStep(`Início em {${namesOf(cur)}}`);
  setRunStates(cur, 'running');
  for (const c of w) {
    let next = new Set();
    for (const s of cur) {
      const k = keyTS(s, c);
      if (A.transitions.has(k)) {
        for (const dest of A.transitions.get(k)) {
          epsilonClosure(new Set([dest])).forEach(d => next.add(d));
        }
      }
    }
    if (next.size === 0) {
      elRunResult.innerHTML = `<span class="err">HALT: transição não definida para ({${namesOf(cur)}}, ${c})</span>`;
      setRunStates(cur, 'rejected');
      return;
    }
    addStep(`({${namesOf(cur)}}, ${c}) → {${namesOf(next)}}`);
    cur = next;
    setRunStates(cur, 'running');
  }
  const finals = new Set([...cur].filter(id => A.states.get(id)?.isFinal));
  if (finals.size) {
    elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em {${namesOf(finals)}})`;
    runHighlight.clear();
    finals.forEach(id => runHighlight.set(id, 'accepted'));
    [...cur].filter(id => !finals.has(id)).forEach(id => runHighlight.set(id, 'rejected'));
    renderStates();
  } else {
    elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em {${namesOf(cur)}})`;
    setRunStates(cur, 'rejected');
  }
};

runStartBtn.onclick = () => {
  resetRunVisuals();
  elRunSteps.innerHTML = '';
  elRunResult.innerHTML = '';
  if (!A.initialId) { elRunResult.innerHTML = `<span class="warn">Defina um estado inicial.</span>`; return; }
  if (!A.alphabet.size) { elRunResult.innerHTML = `<span class="warn">Defina Σ.</span>`; return; }
  const word = (document.getElementById('wordInput').value || '').trim().split('');
  stepRun = { word, pos: 0, cur: epsilonClosure(new Set([A.initialId])), halted: false };
  addStep(`Início em {${namesOf(stepRun.cur)}}`);
  setRunStates(stepRun.cur, 'running');
  if (stepRun.word.length === 0) {
    const finals = new Set([...stepRun.cur].filter(id => A.states.get(id)?.isFinal));
    if (finals.size) {
      elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em {${namesOf(finals)}})`;
      runHighlight.clear();
      finals.forEach(id => runHighlight.set(id, 'accepted'));
      [...stepRun.cur].filter(id => !finals.has(id)).forEach(id => runHighlight.set(id, 'rejected'));
      renderStates();
    } else {
      elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em {${namesOf(stepRun.cur)}})`;
      setRunStates(stepRun.cur, 'rejected');
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
    elRunResult.innerHTML = `<span class="err">HALT: símbolo \"${c}\" não pertence a Σ = { ${alphaStr()} }.</span>`;
    runStepBtn.disabled = true;
    stepRun.halted = true;
    setRunStates(stepRun.cur, 'rejected');
    return;
  }
  let next = new Set();
  for (const s of stepRun.cur) {
    const k = keyTS(s, c);
    if (A.transitions.has(k)) {
      for (const dest of A.transitions.get(k)) {
        epsilonClosure(new Set([dest])).forEach(d => next.add(d));
      }
    }
  }
  if (next.size === 0) {
    elRunResult.innerHTML = `<span class="err">HALT: transição não definida para ({${namesOf(stepRun.cur)}}, ${c})</span>`;
    runStepBtn.disabled = true;
    stepRun.halted = true;
    setRunStates(stepRun.cur, 'rejected');
    return;
  }
  addStep(`({${namesOf(stepRun.cur)}}, ${c}) → {${namesOf(next)}}`);
  stepRun.cur = next;
  stepRun.pos++;
  setRunStates(stepRun.cur, 'running');
  if (stepRun.pos >= stepRun.word.length) {
    const finals = new Set([...stepRun.cur].filter(id => A.states.get(id)?.isFinal));
    if (finals.size) {
      elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em {${namesOf(finals)}})`;
      runHighlight.clear();
      finals.forEach(id => runHighlight.set(id, 'accepted'));
      [...stepRun.cur].filter(id => !finals.has(id)).forEach(id => runHighlight.set(id, 'rejected'));
      renderStates();
    } else {
      elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em {${namesOf(stepRun.cur)}})`;
      setRunStates(stepRun.cur, 'rejected');
    }
    runStepBtn.disabled = true;
    stepRun = null;
  }
};

function addStep(t) {
  const div = document.createElement('div');
  div.textContent = t;
  elRunSteps.appendChild(div);
}

svg.addEventListener('mousedown', resetRunVisuals);
document.querySelectorAll('button').forEach(btn => {
  if (!['runBtn', 'runStartBtn', 'runStepBtn'].includes(btn.id)) {
    btn.addEventListener('click', resetRunVisuals);
  }
});

