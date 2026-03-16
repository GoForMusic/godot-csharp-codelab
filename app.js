'use strict';

/* ─── Lesson manifest ─────────────────────────────────────────────────── */
const LESSONS = [
  { title: 'Setup & Project Structure',      file: './lessons/00-setup.md' },
  { title: '3D Nodes & Scripts',             file: './lessons/01-nodes-3d.md' },
  { title: '3D Player Movement',             file: './lessons/02-player-movement.md' },
  { title: 'Camera & Mouse Input',           file: './lessons/03-camera-input.md' },
  { title: 'Animations & AnimationTree',     file: './lessons/04-animations.md' },
  { title: 'Sound & Music System',           file: './lessons/05-sound.md' },
  { title: 'UI & HUD System',               file: './lessons/06-ui-hud.md' },
  { title: 'Signals & Events',              file: './lessons/07-signals.md' },
  { title: 'Enemy AI & Behavior',           file: './lessons/08-enemy-ai.md' },
  { title: 'Save & Load System',            file: './lessons/09-save-load.md' },
  { title: 'Scene Management',              file: './lessons/10-scene-management.md' },
  { title: 'Final Project',                 file: './lessons/11-final-project.md' },
  { title: 'Visual Effects & Particles',    file: './lessons/12-vfx-particles.md' },
  { title: 'Custom Shaders',               file: './lessons/13-shaders.md' },
  { title: 'Multiplayer',                  file: './lessons/14-multiplayer.md' },
  { title: 'Export & Deploy',              file: './lessons/15-export.md' },
  { title: 'GUT Testing',                  file: './lessons/16-gut-testing.md' },
  { title: 'Why Clean Architecture?',       file: './lessons/17-clean-architecture.md' },
  { title: 'Domain Entities & Value Objects', file: './lessons/18-entities.md' },
  { title: 'Interfaces & Systems',          file: './lessons/19-interfaces-systems.md' },
  { title: 'Generic State Machine',         file: './lessons/20-state-machine.md' },
  { title: 'Godot Adapters',               file: './lessons/21-adapters.md' },
  { title: 'Thin Nodes & Wiring',          file: './lessons/22-thin-nodes.md' },
  { title: 'Inventory System',             file: './lessons/23-inventory.md' },
  { title: 'Tween & Procedural Animation', file: './lessons/24-tween-animation.md' },
  { title: 'Event Bus',                    file: './lessons/25-event-bus.md' },
];

const TOTAL  = LESSONS.length;
const TITLES = LESSONS.map(l => l.title);
let   cur    = 0;

/* ─── Lesson fetch + cache ───────────────────────────────────────────── */
const _cache = {};

async function fetchLesson(idx) {
  if (_cache[idx]) return _cache[idx];
  const r = await fetch(LESSONS[idx].file);
  if (!r.ok) throw new Error(`Could not load ${LESSONS[idx].file} (${r.status})`);
  _cache[idx] = await r.text();
  return _cache[idx];
}

/* ─── Frontmatter parser ─────────────────────────────────────────────── */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split('\n').forEach(line => {
    const sep = line.indexOf(':');
    if (sep < 0) return;
    meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  });
  return { meta, body: m[2] };
}

/* ─── Hero + footer builders ─────────────────────────────────────────── */
function buildHero(meta, idx) {
  return `
<div class="lesson-hero">
  <div class="lesson-meta">
    <span class="lesson-num-badge">${String(idx + 1).padStart(2, '0')}</span>
    <span class="lesson-cat-badge">${meta.tag || ''}</span>
  </div>
  <h1 class="lesson-title">${meta.title || LESSONS[idx].title}</h1>
  <p class="lesson-sub">${meta.sub || ''}</p>
</div>`;
}

function buildFooter(idx) {
  const prev = idx > 0
    ? `<button class="btn btn-ghost" onclick="prev()">&#8592; Prev</button>`
    : `<button class="btn btn-ghost" disabled>&#8592; Prev</button>`;
  const next = idx < TOTAL - 1
    ? `<button class="btn btn-primary" onclick="next()">Next &#8594;</button>`
    : `<button class="btn btn-finish" onclick="restart()">&#x1F504; Restart Codelab</button>`;
  return `
<div class="lesson-footer">
  <div class="footer-progress">Lesson ${idx + 1} of ${TOTAL}</div>
  <div class="footer-btns">${prev}${next}</div>
</div>`;
}

/* ─── Post-render: wrap <pre> in .cb + add copy buttons + hljs ───────── */
function applyCodeBlocks(container) {
  // Run highlight.js on bare fenced code blocks
  container.querySelectorAll('pre code').forEach(code => {
    hljs.highlightElement(code);
  });

  // Wrap every <pre> that isn't already inside a .cb
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.closest('.cb')) return;
    const code = pre.querySelector('code');
    const lang = (code?.className || '')
      .split(' ')
      .find(c => c.startsWith('language-'))
      ?.replace('language-', '')
      .toUpperCase() || 'CODE';

    const wrapper = document.createElement('div');
    wrapper.className = 'cb';
    const header = document.createElement('div');
    header.className = 'cb-header';
    header.innerHTML = `<span class="cb-lang">${lang}</span><button class="copy-btn" onclick="copyCode(this)">COPY</button>`;
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

/* ─── Navigation ─────────────────────────────────────────────────────── */
let _loading = false;

async function go(idx) {
  if (idx < 0 || idx >= TOTAL || _loading) return;
  _loading = true;

  // Update nav
  document.getElementById('n' + cur).classList.remove('active');
  if (idx > cur) document.getElementById('n' + cur).classList.add('done');
  cur = idx;
  const nav = document.getElementById('n' + cur);
  nav.classList.add('active');
  nav.classList.remove('done');
  updateProgress();

  // Show loading state
  const container = document.getElementById('lessonContent');
  container.innerHTML = '<p style="color:var(--text2);padding:4rem 2rem;text-align:center">Loading…</p>';
  document.getElementById('mainScroll').scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const raw              = await fetchLesson(idx);
    const { meta, body }   = parseFrontmatter(raw);
    const bodyHtml         = marked.parse(body);
    container.innerHTML    = buildHero(meta, idx) + bodyHtml + buildFooter(idx);
    applyCodeBlocks(container);
  } catch (e) {
    container.innerHTML = `<p style="color:var(--danger);padding:2rem">⚠️ ${e.message}</p>`;
  }

  _loading = false;
}

function next()    { go(cur + 1); }
function prev()    { go(cur - 1); }

function restart() {
  for (let i = 0; i < TOTAL; i++)
    document.getElementById('n' + i).classList.remove('active', 'done');
  cur = 0;
  go(0);
}

/* ─── Progress bar ───────────────────────────────────────────────────── */
function updateProgress() {
  const pct = Math.round((cur + 1) / TOTAL * 100);
  document.getElementById('progFill').style.width  = pct + '%';
  document.getElementById('progPct').textContent   = pct + '%';
  document.getElementById('progLabel').textContent = `Lesson ${cur + 1} / ${TOTAL}`;
  document.getElementById('crumbCur').textContent  = TITLES[cur];
}

/* ─── Quiz ───────────────────────────────────────────────────────────── */
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

/* ─── Copy code ──────────────────────────────────────────────────────── */
function copyCode(btn) {
  const pre = btn.closest('.cb').querySelector('pre');
  navigator.clipboard.writeText(pre.innerText).then(() => {
    btn.textContent = '✓ COPIED';
    setTimeout(() => (btn.textContent = 'COPY'), 2000);
  });
}

/* ─── Keyboard nav ───────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' || e.key === 'l') next();
  if (e.key === 'ArrowLeft'  || e.key === 'h') prev();
});

/* ─── Boot ───────────────────────────────────────────────────────────── */
go(0);
