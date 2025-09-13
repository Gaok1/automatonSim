// Ponto de entrada do app (ES Modules)
// - Injeta o template conforme o hash (#afd|#afn|#gr)
// - Configura LS_KEY/mode no estado
// - Conecta eventos de UI e módulos auxiliares

import { setLsKey, loadLS, snapshot, saveLS, A, runHighlight, checkCrossImport } from './modules/state.js';
import { renderAll, setupUIEventListeners, updateAlphabetView } from './modules/ui.js';
import { setupRunControls } from './modules/run.js';
import { setupAlgoView } from './modules/algoview.js';
import { buildFromRegex } from './modules/regex.js';
import { buildFromGrammar, buildFromGrammarToDfa, buildFromGrammarToDfaOpen, exportGrammarFromAF } from './modules/grammar.js';

// 1) Detecta modo pela hash e injeta o template
const hash = (location.hash || '').toLowerCase();
const MODE = hash === '#afn' ? 'afn' : (hash === '#gr' ? 'gr' : 'afd');
window.MODE = MODE;
const LS_KEY = MODE === 'afn' ? 'afn_sim_state_v1' : (MODE === 'gr' ? 'afn_gr_sim_state_v1' : 'afd_sim_state_v3');
setLsKey(LS_KEY);

const app = document.getElementById('app');
const tpl = document.getElementById('tmpl-' + MODE);
app.appendChild(tpl.content.cloneNode(true));

// Tabs (navegação)
document.querySelectorAll('nav.tabs a').forEach(a => {
  const m = a.getAttribute('data-mode');
  if (m === MODE) a.classList.add('active'); else a.classList.remove('active');
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (m === MODE) return;
    location.hash = '#' + m;
    location.reload();
  });
});
window.addEventListener('hashchange', () => location.reload());

// 2) Carrega do localStorage ou cria um exemplo simples
const hadCross = checkCrossImport();
const hadState = hadCross ? true : loadLS();
if (!hadState) {
  // Exemplo didático mínimo
  A.alphabet = new Set(['A', 'B']);
  const s0 = { id: 'q0', name: 'q0', x: 180, y: 200, isInitial: true, isFinal: false };
  const s1 = { id: 'q1', name: 'q1', x: 380, y: 200, isInitial: false, isFinal: true };
  A.states.set(s0.id, s0); A.states.set(s1.id, s1); A.initialId = s0.id; A.nextId = 2;
  A.transitions.set(`${s0.id}|A`, new Set([s1.id]));
  A.transitions.set(`${s1.id}|B`, new Set([s0.id]));
  saveLS();
}

// 3) Conecta eventos principais da UI e módulos
setupUIEventListeners();
setupRunControls();
setupAlgoView();

// GR (regex/gramática) botões – ligados só quando presentes no DOM
const btnRegex = document.getElementById('buildFromRegexBtn');
if (btnRegex) btnRegex.addEventListener('click', buildFromRegex);
const btnG = document.getElementById('buildFromGrammarBtn');
if (btnG) btnG.addEventListener('click', buildFromGrammar);
const btnGdfa = document.getElementById('buildFromGrammarToDfaBtn');
if (btnGdfa) btnGdfa.addEventListener('click', buildFromGrammarToDfa);
const btnGdfaOpen = document.getElementById('buildFromGrammarToDfaOpenBtn');
if (btnGdfaOpen) btnGdfaOpen.addEventListener('click', buildFromGrammarToDfaOpen);
const btnExportGr = document.getElementById('exportGrammarBtn');
if (btnExportGr) btnExportGr.addEventListener('click', exportGrammarFromAF);

// 4) Primeira renderização e ajuste do Σ exibido
updateAlphabetView();
renderAll();

// Limpa destaques de simulação ao interagir com o canvas
const svg = document.getElementById('svg');
if (svg) svg.addEventListener('mousedown', () => { runHighlight.clear(); renderAll(); });
