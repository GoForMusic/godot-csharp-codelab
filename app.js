'use strict';

const TOTAL = 17;
const TITLES = [
  'Setup & Project Structure',
  '3D Nodes & Scripts',
  '3D Player Movement',
  'Camera & Mouse Input',
  'Animations & AnimationTree',
  'Sound & Music System',
  'UI & HUD System',
  'Signals & Events',
  'Enemy AI & Behavior',
  'Save & Load System',
  'Scene Management',
  'Final Project',
  'Visual Effects & Particles',
  'Custom Shaders',
  'Multiplayer',
  'Export & Deploy',
  'GUT Testing',
];

let cur = 0;

/* ─── Navigation ─────────────────────────────── */
function go(idx) {
  if (idx < 0 || idx >= TOTAL) return;
  document.getElementById('l' + cur).classList.remove('active');
  const prevNav = document.getElementById('n' + cur);
  prevNav.classList.remove('active');
  if (idx > cur) prevNav.classList.add('done');
  cur = idx;
  document.getElementById('l' + cur).classList.add('active');
  const nav = document.getElementById('n' + cur);
  nav.classList.add('active');
  nav.classList.remove('done');
  updateProgress();
  document.getElementById('mainScroll').scrollTo({ top: 0, behavior: 'smooth' });
}

function next()    { go(cur + 1); }
function prev()    { go(cur - 1); }

function restart() {
  for (let i = 0; i < TOTAL; i++) {
    const n = document.getElementById('n' + i);
    n.classList.remove('active', 'done');
    const inner = n.querySelector('.nav-num-inner');
    if (inner) inner.textContent = i + 1;
  }
  cur = 0;
  go(0);
}

/* ─── Progress ─────────────────────────────── */
function updateProgress() {
  const pct = Math.round((cur + 1) / TOTAL * 100);
  document.getElementById('progFill').style.width = pct + '%';
  document.getElementById('progPct').textContent  = pct + '%';
  document.getElementById('progLabel').textContent = `Lesson ${cur + 1} / ${TOTAL}`;
  document.getElementById('crumbCur').textContent  = TITLES[cur];
}

/* ─── Quiz ─────────────────────────────── */
function qz(el, correct, id) {
  el.closest('.quiz-opts').querySelectorAll('.quiz-o').forEach(o => {
    o.style.cursor = 'default';
    o.onclick = null;
  });
  const fb = document.getElementById(id);
  if (correct) {
    el.classList.add('correct');
    fb.textContent = '✅ Correct! Well done.';
    fb.className   = 'quiz-fb show ok';
  } else {
    el.classList.add('wrong');
    fb.textContent = '❌ Not quite — review the section above!';
    fb.className   = 'quiz-fb show bad';
  }
}

/* ─── Copy code ─────────────────────────────── */
function copyCode(btn) {
  const pre = btn.closest('.cb').querySelector('pre');
  navigator.clipboard.writeText(pre.innerText).then(() => {
    btn.textContent = '✓ COPIED';
    setTimeout(() => (btn.textContent = 'COPY'), 2000);
  });
}

/* ─── Keyboard nav ─────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' || e.key === 'l') next();
  if (e.key === 'ArrowLeft'  || e.key === 'h') prev();
});
