const elRunResult = document.getElementById('runResult');
const elRunSteps = document.getElementById('runSteps');
const runBtn = document.getElementById('runBtn');
const runStartBtn = document.getElementById('runStartBtn');
const runStepBtn = document.getElementById('runStepBtn');
let stepRun = null;

function resetRunVisuals() {
  runHighlight = { stateId: null, status: null };
  renderStates();
}

function setRunState(id, status) {
  runHighlight = { stateId: id, status };
  renderStates();
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
    setRunState(A.initialId, 'rejected');
    return;
  }
  let cur = A.initialId;
  addStep(`Início em ${A.states.get(cur).name}`);
  setRunState(cur, 'running');
  for (const c of w) {
    const k = keyTS(cur, c);
    if (!A.transitions.has(k)) {
      elRunResult.innerHTML = `<span class="err">HALT: transição não definida para (${A.states.get(cur).name}, ${c})</span>`;
      setRunState(cur, 'rejected');
      return;
    }
    const nxt = A.transitions.get(k);
    addStep(`(${A.states.get(cur).name}, ${c}) → ${A.states.get(nxt).name}`);
    cur = nxt;
    setRunState(cur, 'running');
  }
  const acc = A.states.get(cur)?.isFinal;
  if (acc) {
    elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em estado final ${A.states.get(cur).name})`;
    setRunState(cur, 'accepted');
  } else {
    elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em estado não-final ${A.states.get(cur).name})`;
    setRunState(cur, 'rejected');
  }
};

runStartBtn.onclick = () => {
  resetRunVisuals();
  elRunSteps.innerHTML = '';
  elRunResult.innerHTML = '';
  if (!A.initialId) { elRunResult.innerHTML = `<span class="warn">Defina um estado inicial.</span>`; return; }
  if (!A.alphabet.size) { elRunResult.innerHTML = `<span class="warn">Defina Σ.</span>`; return; }
  const word = (document.getElementById('wordInput').value || '').trim().split('');
  stepRun = { word, pos: 0, cur: A.initialId, halted: false };
  addStep(`Início em ${A.states.get(stepRun.cur).name}`);
  setRunState(stepRun.cur, 'running');
  if (stepRun.word.length === 0) {
    const acc = A.states.get(stepRun.cur)?.isFinal;
    if (acc) {
      elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em estado final ${A.states.get(stepRun.cur).name})`;
      setRunState(stepRun.cur, 'accepted');
    } else {
      elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em estado não-final ${A.states.get(stepRun.cur).name})`;
      setRunState(stepRun.cur, 'rejected');
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
    setRunState(stepRun.cur, 'rejected');
    return;
  }
  const k = keyTS(stepRun.cur, c);
  if (!A.transitions.has(k)) {
    elRunResult.innerHTML = `<span class="err">HALT: transição não definida para (${A.states.get(stepRun.cur).name}, ${c})</span>`;
    runStepBtn.disabled = true;
    stepRun.halted = true;
    setRunState(stepRun.cur, 'rejected');
    return;
  }
  const nxt = A.transitions.get(k);
  addStep(`(${A.states.get(stepRun.cur).name}, ${c}) → ${A.states.get(nxt).name}`);
  stepRun.cur = nxt;
  stepRun.pos++;
  setRunState(stepRun.cur, 'running');
  if (stepRun.pos >= stepRun.word.length) {
    const acc = A.states.get(stepRun.cur)?.isFinal;
    if (acc) {
      elRunResult.innerHTML = `<span class="ok">ACEITA</span> (terminou em estado final ${A.states.get(stepRun.cur).name})`;
      setRunState(stepRun.cur, 'accepted');
    } else {
      elRunResult.innerHTML = `<span class="err">REJEITADA</span> (terminou em estado não-final ${A.states.get(stepRun.cur).name})`;
      setRunState(stepRun.cur, 'rejected');
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

