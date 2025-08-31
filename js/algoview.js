import { A, renderStates, runHighlight } from './core.js';

const elSteps = document.getElementById('algoSteps');
const titles = {
  removeLambda: 'AFNλ → AFN',
  nfaToDfa: 'AFN → AFD',
};

function nameOf(id) {
  return A.states.get(id)?.name || id;
}

document.addEventListener('algoStep', ev => {
  if (!elSteps) return;
  const { algo, step, ...data } = ev.detail;
  if (step === 'start') {
    elSteps.innerHTML = `<strong>${titles[algo] || algo}</strong>`;
    runHighlight.clear();
    renderStates();
    return;
  }
  const div = document.createElement('div');
  if (algo === 'removeLambda') {
    if (step === 'closure') {
      div.textContent = `ε-fecho(${nameOf(data.state)}) = {${data.closure.map(nameOf).join(', ')}}`;
    } else if (step === 'final') {
      div.textContent = `${nameOf(data.state)} ${data.isFinal ? 'é' : 'não é'} final`;
    } else if (step === 'transition') {
      div.textContent = `(${nameOf(data.from)}, ${data.sym}) → {${data.to.map(nameOf).join(', ')}}`;
      runHighlight.clear();
      runHighlight.set(data.from, 'running');
      data.to.forEach(id => runHighlight.set(id, 'running'));
      renderStates();
    } else {
      div.textContent = `${step}`;
    }
  } else if (algo === 'nfaToDfa') {
    if (step === 'newState') {
      div.textContent = `novo estado ${nameOf(data.id)} = {${data.subset.map(nameOf).join(', ')}}`;
    } else if (step === 'transition') {
      div.textContent = `(${nameOf(data.from)}, ${data.sym}) → ${nameOf(data.to)}`;
      runHighlight.clear();
      runHighlight.set(data.from, 'running');
      runHighlight.set(data.to, 'running');
      renderStates();
    } else {
      div.textContent = `${step}`;
    }
  } else {
    div.textContent = `${algo}:${step}`;
  }
  elSteps.appendChild(div);
});

