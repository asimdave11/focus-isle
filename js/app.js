import { SPECIES, drawSprite, drawGrowing, spriteCanvas, iconCanvas } from './sprites.js';
import * as audio from './audio.js';

// ---------- State ----------
const KEY = 'focusisle.v1';
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1; // dev: ?speed=60
const IS_DESKTOP = !matchMedia('(pointer: coarse)').matches;
const CANCEL_WINDOW = 10; // seconds: giving up this early cancels without a dead tree

// Each tag builds its own object, so the island reads as categories.
const DEFAULT_TAGS = [
  { id: 'study', name: 'Study', color: '#4dabf7', species: 'library' },
  { id: 'work', name: 'Work', color: '#f59f00', species: 'house' },
  { id: 'coding', name: 'Coding', color: '#7bd389', species: 'windmill' },
  { id: 'reading', name: 'Reading', color: '#da77f2', species: 'cherry' },
  { id: 'other', name: 'Other', color: '#adb5bd', species: 'oak' },
];
const FREE = SPECIES.filter(s => s.cost === 0).map(s => s.id);

function freshState() {
  return {
    epoch: 'e' + Date.now().toString(36), // changes on reset/import, so merges never resurrect wiped data
    sessions: [], purchases: [], coinAdjust: 0, unlocked: [...FREE], tags: DEFAULT_TAGS.map(t => ({ ...t })),
    settings: {
      duration: 25, tag: 'study', sound: 'none', volume: 0.5,
      grace: 10, desktopBlur: true, shortBreak: 5, longBreak: 15, autoDim: false,
    },
    active: null, // { start, planned, tag, species, awayAt, seenAt }
    brk: null,    // { start, planned }
  };
}

// ---------- Storage ----------
// Everything lives in localStorage on this device. Safeguards:
// - corrupt data is quarantined, never overwritten, and the backup is restored
// - saves merge sessions/purchases with what's on disk, so two tabs can't erase each other
// - an automatic backup is kept (daily, and before reset/import)
// - coins are derived from sessions and purchases, so merging can't miscount them
const BAK = 'focusisle.backup';
const storageIssues = [];

function parseState(raw) {
  try { const v = JSON.parse(raw); return v && Array.isArray(v.sessions) ? v : null; } catch { return null; }
}
function readKey(k) { try { return localStorage.getItem(k); } catch { return null; } }

function normalize(src) {
  const f = freshState();
  const out = { ...f, ...src, settings: { ...f.settings, ...src.settings } };
  if (!Array.isArray(out.tags) || !out.tags.length) out.tags = f.tags;
  if (!Array.isArray(out.purchases)) out.purchases = [];
  out.unlocked = [...new Set([...FREE, ...(out.unlocked || [])])];
  for (const t of out.tags) if (!t.species) t.species = DEFAULT_TAGS.find(d => d.id === t.id)?.species || 'oak';
  for (const x of out.sessions) {
    if (!x.id) x.id = `s${x.start}`;
    if (x.coins == null) x.coins = x.status === 'done' ? Math.round(x.planned / 60) : 0;
  }
  if (src.coinAdjust == null) { // migrate from the old stored coin balance
    out.coinAdjust = (typeof src.coins === 'number' ? src.coins : 0) - earnedOf(out) + spentOf(out);
  }
  delete out.coins;
  if (!src.epoch) out.epoch = 'e0';
  return out;
}
const earnedOf = (st) => st.sessions.reduce((t, x) => t + (x.coins || 0), 0);
const spentOf = (st) => st.purchases.reduce((t, x) => t + x.cost, 0);
const coins = () => earnedOf(state) - spentOf(state) + (state.coinAdjust || 0);

function readBackup() {
  try { const b = JSON.parse(readKey(BAK)); return b && parseState(JSON.stringify(b.data)) ? b : null; } catch { return null; }
}
function writeBackup(reason, data) {
  const prev = readBackup();
  if (!data.sessions.length && prev?.data.sessions.length) return; // never replace a real backup with an empty one
  try { localStorage.setItem(BAK, JSON.stringify({ at: Date.now(), reason, data })); } catch {}
}

function load() {
  const raw = readKey(KEY);
  const parsed = raw ? parseState(raw) : null;
  if (raw && !parsed) {
    try { localStorage.setItem(`focusisle.corrupt.${Date.now()}`, raw); } catch {}
    storageIssues.push('corrupt');
  }
  if (parsed) return normalize(parsed);
  const b = readBackup();
  if (b) { storageIssues.push('restored'); return normalize(b.data); }
  return freshState();
}

let state = load();
let saveFailed = false;
function save() {
  try {
    const disk = parseState(readKey(KEY));
    if (disk && disk.epoch === state.epoch) {
      const have = new Set(state.sessions.map(x => x.id));
      const extra = disk.sessions.filter(x => x.id && !have.has(x.id));
      if (extra.length) { state.sessions.push(...extra); state.sessions.sort((a, b) => a.start - b.start); }
      const bought = new Set(state.purchases.map(x => x.id));
      for (const x of disk.purchases || []) if (!bought.has(x.id)) state.purchases.push(x);
      state.unlocked = [...new Set([...state.unlocked, ...(disk.unlocked || [])])];
    }
    localStorage.setItem(KEY, JSON.stringify(state));
    if (saveFailed) { saveFailed = false; $('#savebar')?.remove(); }
    return true;
  } catch {
    if (!saveFailed) {
      saveFailed = true;
      document.body.append(h(`<div id="savebar" role="alert">Focus Isle couldn't save. Storage on this device may be full or blocked, for example in Private Browsing. Open Settings and export your data so you don't lose it.</div>`));
    }
    return false;
  }
}

// Another tab saved: adopt its state so this tab never writes stale data over it.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  const next = parseState(e.newValue);
  if (!next) return;
  state = normalize(next);
  renderAll();
});

// ---------- Utils ----------
const $ = (sel, root = document) => root.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const pad = (n) => String(n).padStart(2, '0');
const fmtClock = (sec) => { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}:${pad(sec % 60)}` : `${pad(m)}:${pad(sec % 60)}`; };
const fmtDur = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tagById = (id) => state.tags.find(t => t.id === id) || { id, name: id, color: '#adb5bd', species: 'oak' };
const speciesById = (id) => SPECIES.find(s => s.id === id) || SPECIES[0];
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms);
}

function modal({ title, body = '', sprite, actions = [{ label: 'OK', primary: true }] }) {
  const root = $('#modal-root');
  const back = h(`<div class="modal-back"><div class="modal"><h3>${title}</h3><div class="mb"></div><div class="actions ${actions.length === 2 ? 'two' : ''}"></div></div></div>`);
  if (sprite) $('.mb', back).append(sprite);
  $('.mb', back).append(typeof body === 'string' ? h(`<div>${body}</div>`) || '' : body);
  for (const a of actions) {
    const b = h(`<button class="btn ${a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'}">${a.label}</button>`);
    b.onclick = () => { back.remove(); a.onClick?.(); };
    $('.actions', back).append(b);
  }
  root.append(back);
}

// ---------- Derived stats ----------
function streaks() {
  const days = new Set(state.sessions.filter(s => s.status === 'done').map(s => dayKey(s.start)));
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(d))) { current++; d.setDate(d.getDate() - 1); }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = null;
  for (const k of sorted) {
    const t = new Date(k + 'T12:00:00');
    run = prev && (t - prev) / 864e5 === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return { current, best };
}

// ---------- Island renderer ----------
const WATER = '#1f6f7a', WATER_HI = '#4fa3a5', SAND = '#e9d8a6', GRASS = '#6ab04c', GRASS_D = '#4f8f3a', DIRT = '#8a5a3b';

// items: [{ species, status, progress }] — drawn from the island centre outward.
function renderIsland(canvas, items, { minLand = 9, maxCssWidth = 520, noise = 0.9, water = true } = {}) {
  const n = items.length;
  const land = Math.max(minLand, Math.ceil(n * 1.4) + 4);
  const R = Math.ceil(Math.sqrt(land / Math.PI)) + 3;
  const cells = [];
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) cells.push({ x, y, d: Math.hypot(x, y * 1.15) + hash(x, y) * noise });
  cells.sort((a, b) => a.d - b.d);
  const landCells = cells.slice(0, land);
  const isLand = new Set(landCells.map(c => `${c.x},${c.y}`));
  const xs = landCells.map(c => c.x), ys = landCells.map(c => c.y);
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
  const W = (maxX - minX + 1) * 16, H = (maxY - minY + 1) * 16;

  const dpr = window.devicePixelRatio || 1;
  const cssMax = Math.min(maxCssWidth, canvas.parentElement?.clientWidth || maxCssWidth);
  const scale = Math.max(1, Math.floor((cssMax * dpr) / W));
  canvas.width = W * scale; canvas.height = H * scale;
  canvas.style.width = `${(W * scale) / dpr}px`;
  canvas.style.height = `${(H * scale) / dpr}px`;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  if (water) {
    ctx.fillStyle = WATER; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = WATER_HI;
    for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 9) if (hash(x, y) > 0.86) ctx.fillRect(x, y, 3, 1);
  }

  const px = (c) => (c.x - minX) * 16, py = (c) => (c.y - minY) * 16;
  for (const c of landCells) { ctx.fillStyle = SAND; ctx.fillRect(px(c) - 2, py(c) - 2, 20, 21); }
  for (const c of landCells) {
    const x = px(c), y = py(c);
    ctx.fillStyle = GRASS; ctx.fillRect(x, y, 16, 16);
    if (!isLand.has(`${c.x},${c.y + 1}`)) { ctx.fillStyle = DIRT; ctx.fillRect(x, y + 14, 16, 3); }
    ctx.fillStyle = GRASS_D;
    for (let i = 0; i < 4; i++) {
      const gx = Math.floor(hash(c.x * 7 + i, c.y) * 14), gy = Math.floor(hash(c.x, c.y * 5 + i) * 12);
      ctx.fillRect(x + gx, y + gy, 1, 2);
    }
  }

  const placed = landCells.slice(0, n).map((c, i) => ({ c, item: items[i] }));
  placed.sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x);
  for (const { c, item } of placed) {
    const x = px(c), y = py(c) - 3;
    if (item.status === 'dead') drawSprite(ctx, 'dead', x, y);
    else if (item.progress != null && item.progress < 1) drawGrowing(ctx, item.species, x, y, item.progress);
    else drawSprite(ctx, item.species, x, y);
  }
  // Map from logical tile to item index, for tap-to-inspect.
  canvas._hit = (cx, cy) => {
    const lx = Math.floor((cx * dpr) / scale / 16) + minX, ly = Math.floor(((cy * dpr) / scale + 3) / 16) + minY;
    const i = landCells.slice(0, n).findIndex(c => c.x === lx && c.y === ly);
    return i >= 0 ? items[i] : null;
  };
}

// ---------- Session engine ----------
let tickTimer = null, wakeLock = null;

const elapsed = (a) => ((now() - a.start) / 1000) * SPEED;

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}

function startSession() {
  const s = state.settings;
  state.active = { start: now(), planned: s.duration * 60, tag: s.tag, species: tagById(s.tag).species || 'oak', awayAt: null, seenAt: now() };
  state.brk = null;
  save();
  audio.play(s.sound, s.volume);
  keepAwake(true);
  if (s.autoDim) setTimeout(() => state.active && dim(true), 1500);
  renderFocus();
  loop();
}

function finish(status, reason) {
  const a = state.active;
  if (!a) return;
  // Time stops counting when you left, not when we noticed.
  const until = status === 'dead' && a.awayAt ? a.awayAt : now();
  const focused = Math.max(0, Math.min(a.planned, ((until - a.start) / 1000) * SPEED));
  const rec = { id: `s${a.start}`, start: a.start, end: now(), planned: a.planned, focused, tag: a.tag, species: a.species, status, coins: status === 'done' ? Math.round(a.planned / 60) : 0 };
  state.sessions.push(rec);
  state.active = null;
  const earned = rec.coins;
  save();
  audio.stop(); keepAwake(false); dim(false);
  document.title = 'Focus Isle';
  renderFocus();
  const sp = spriteCanvas(status === 'done' ? a.species : 'dead', 6);
  sp.classList.add('px');
  if (status === 'done') {
    audio.chime();
    const doneToday = state.sessions.filter(x => x.status === 'done' && dayKey(x.start) === dayKey(now())).length;
    const long = doneToday % 4 === 0;
    const mins = long ? state.settings.longBreak : state.settings.shortBreak;
    modal({
      title: `${speciesById(a.species).name} built!`, sprite: sp,
      body: `<p>${fmtDur(a.planned)} of ${esc(tagById(a.tag).name)}. You earned <b>${earned} coins</b>.</p>${long ? '<p>4 sessions done today. Have a long break.</p>' : ''}`,
      actions: [
        { label: 'Skip', onClick: () => {} },
        { label: `${mins}m break`, primary: true, onClick: () => startBreak(mins) },
      ],
    });
  } else {
    audio.thud();
    modal({ title: `Your ${speciesById(a.species).name.toLowerCase()} withered`, sprite: sp, body: `<p>${esc(reason)}</p><p>You focused ${fmtDur(focused)}.</p>`, actions: [{ label: 'Try again', primary: true }] });
  }
}

function startBreak(mins) {
  state.brk = { start: now(), planned: mins * 60 };
  save(); renderFocus(); loop();
}

function loop() {
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 250);
  tick();
}

function tick() {
  const a = state.active;
  if (a) {
    // If the page was frozen (laptop asleep, app killed) we never saw it leave; the last heartbeat tells us.
    if (!a.awayAt && a.seenAt && now() - a.seenAt > (state.settings.grace + 6) * 1000) a.awayAt = a.seenAt;
    if (!a.awayAt && (!a.seenAt || now() - a.seenAt > 5000)) { a.seenAt = now(); save(); }
    if (a.awayAt) {
      const awaySec = (now() - a.awayAt) / 1000;
      const left = state.settings.grace - awaySec;
      if (left <= 0) return finish('dead', `You left the app for more than ${state.settings.grace}s.`);
      document.title = `⚠️ Come back! ${Math.ceil(left)}s`;
      const w = $('#warn'); if (w) { w.hidden = false; w.textContent = `Come back! Your ${speciesById(a.species).name.toLowerCase()} dies in ${Math.ceil(left)}s`; }
    } else {
      const w = $('#warn'); if (w) w.hidden = true;
    }
    const e = elapsed(a);
    if (e >= a.planned) return finish('done');
    const remain = a.planned - e;
    $('#timer') && ($('#timer').textContent = fmtClock(remain));
    $('.dim-time').textContent = fmtClock(remain);
    if (!a.awayAt) document.title = `${fmtClock(remain)} left, Focus Isle`;
    const p = e / a.planned;
    const step = Math.floor(p * 64);
    if (step !== tick.lastStep) { tick.lastStep = step; drawScene(p); }
    const gb = $('#giveup'); if (gb) gb.textContent = e / SPEED < CANCEL_WINDOW ? `Cancel (${Math.ceil(CANCEL_WINDOW - e / SPEED)})` : 'Give up';
  } else if (state.brk) {
    const b = state.brk;
    const remain = b.planned - elapsed(b);
    if (remain <= 0) {
      state.brk = null; save(); audio.chime(); renderFocus();
      document.title = 'Focus Isle';
      return toast('Break over. Ready to focus?');
    }
    $('#timer') && ($('#timer').textContent = fmtClock(remain));
    document.title = `Break ${fmtClock(remain)}, Focus Isle`;
  } else {
    clearInterval(tickTimer);
  }
}

function drawScene(p) {
  const c = $('#scene');
  if (!c) return;
  const a = state.active;
  const item = a ? { species: a.species, progress: p } : { species: tagById(state.settings.tag).species, progress: 0.0 };
  renderIsland(c, [item], { minLand: 13, maxCssWidth: 280, noise: 0.25, water: false });
  placeSun(a ? p : null);
}

const STARS = Array.from({ length: 28 }, (_, i) => `<i style="left:${(hash(i, 3) * 100).toFixed(1)}%;top:${(hash(7, i) * 100).toFixed(1)}%"></i>`).join('');
// Sky follows the real clock; during a session the sun travels across it.
function timeOfDay(d = new Date()) {
  const hr = d.getHours() + d.getMinutes() / 60;
  if (hr >= 5 && hr < 8) return 'dawn';
  if (hr >= 8 && hr < 17) return 'day';
  if (hr >= 17 && hr < 20) return 'dusk';
  return 'night';
}
function placeSun(p) {
  const stage = $('.stage');
  if (!stage) return;
  const tod = timeOfDay();
  stage.dataset.tod = tod;
  if (p == null) { // idle: park the sun/moon where the real clock puts it
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    p = tod === 'night' ? ((hr + 4) % 24) / 9 : (hr - 5) / 15;
  }
  p = Math.min(1, Math.max(0, p));
  stage.style.setProperty('--sx', `${8 + p * 84}%`);
  stage.style.setProperty('--sy', `${70 - Math.sin(Math.PI * p) * 58}%`);
}

// Strict mode: leaving the app starts the grace countdown.
function leave() {
  const a = state.active;
  if (!a || a.awayAt) return;
  a.awayAt = now(); save();
  if (IS_DESKTOP) tick();
}
function back() {
  const a = state.active;
  if (!a || !a.awayAt) return;
  if (IS_DESKTOP && state.settings.desktopBlur && !document.hasFocus()) return;
  const away = (now() - a.awayAt) / 1000;
  if (away > state.settings.grace) return finish('dead', `You were away for ${away < 120 ? `${Math.round(away)} seconds` : fmtDur(away)}.`);
  a.awayAt = null; a.seenAt = now(); save();
  keepAwake(true);
  tick();
}
document.addEventListener('visibilitychange', () => (document.hidden ? leave() : back()));
window.addEventListener('pagehide', leave);
window.addEventListener('blur', () => { if (IS_DESKTOP && state.settings.desktopBlur) leave(); });
window.addEventListener('focus', back);

function dim(on) {
  $('#dim').hidden = !on;
}
$('#dim').addEventListener('click', () => dim(false));

// ---------- Views ----------
function renderFocus() {
  const v = $('#view-focus');
  const s = state.settings;
  const a = state.active, b = state.brk;
  const { current } = streaks();
  document.body.classList.toggle('focusing', !!a);
  if (!a && !b) document.title = 'Focus Isle';

  v.innerHTML = `
    <div class="stage">
      <div class="stars" aria-hidden="true">${STARS}</div>
      <div class="sun" aria-hidden="true"></div>
      <div class="cloud one" aria-hidden="true"></div><div class="cloud two" aria-hidden="true"></div>
      <div class="hud">
        <span class="streak" title="Days in a row with a finished session">${current} day streak</span>
        <span class="coins" title="Coins">${coins()} coins</span>
      </div>
      <div class="scene"><canvas id="scene" class="px" aria-label="Your island"></canvas></div>
    </div>
    <div class="shore">
      <div id="timer" class="timer">${fmtClock((a ? a.planned : b ? b.planned : s.duration * 60))}</div>
      <div class="subtitle" id="subtitle"></div>
      <div id="controls"></div>
    </div>`;
  const sub = $('#subtitle', v), ctl = $('#controls', v);

  if (a) {
    const t = tagById(a.tag);
    sub.innerHTML = `Building a ${esc(speciesById(a.species).name.toLowerCase())} for <b>${esc(t.name)}</b>`;
    ctl.innerHTML = `
      <div id="warn" class="warn" hidden></div>
      <h2>Sound</h2>
      <div class="chips" id="sounds"></div>
      <div class="actions two session">
        <button class="btn ghost" id="dimbtn">Dim screen</button>
        <button class="btn danger" id="giveup">Give up</button>
      </div>`;
    renderSoundChips($('#sounds', ctl), true);
    $('#dimbtn', ctl).onclick = () => dim(true);
    $('#giveup', ctl).onclick = () => {
      if (elapsed(a) / SPEED < CANCEL_WINDOW) { state.active = null; save(); audio.stop(); keepAwake(false); renderFocus(); return toast('Cancelled. No harm done.'); }
      modal({
        title: 'Give up?', body: `<p>Your ${esc(speciesById(a.species).name.toLowerCase())} will wither.</p>`,
        actions: [{ label: 'Keep going', primary: true }, { label: 'Give up', danger: true, onClick: () => finish('dead', 'You gave up.') }],
      });
    };
  } else if (b) {
    sub.textContent = 'Break. Stand up, stretch, drink some water.';
    ctl.innerHTML = `<div class="actions"><button class="btn ghost block" id="skipbreak">Skip break</button></div>`;
    $('#skipbreak', ctl).onclick = () => { state.brk = null; save(); renderFocus(); };
  } else {
    sub.textContent = IS_DESKTOP && s.desktopBlur ? 'Stay in this window, or it withers.' : 'Leave the app and it withers.';
    ctl.innerHTML = `
      <div class="duration-row">
        <button class="btn step" id="minus">−</button>
        <input type="range" id="dur" min="5" max="180" step="5" value="${s.duration}" aria-label="Duration in minutes">
        <button class="btn step" id="plus">+</button>
      </div>
      <h2>What are you focusing on?</h2><div class="chips" id="tags"></div>
      <p class="hint" id="buildhint"></p>
      <h2>Sound</h2><div class="chips" id="sounds"></div>
      <div class="actions"><button class="btn primary block" id="start">Plant</button></div>`;
    const setDur = (m) => { s.duration = Math.min(180, Math.max(5, m)); save(); $('#dur').value = s.duration; $('#timer').textContent = fmtClock(s.duration * 60); };
    $('#dur', ctl).oninput = (e) => setDur(+e.target.value);
    $('#minus', ctl).onclick = () => setDur(s.duration - 5);
    $('#plus', ctl).onclick = () => setDur(s.duration + 5);

    const tagsEl = $('#tags', ctl);
    for (const t of state.tags) {
      const c = h(`<button class="chip ${t.id === s.tag ? 'sel' : ''}" style="${t.id === s.tag ? `border-color:${t.color}` : ''}"></button>`);
      const cv = spriteCanvas(t.species, 2); cv.classList.add('px');
      c.append(cv, t.name);
      c.onclick = () => { s.tag = t.id; save(); renderFocus(); };
      tagsEl.append(c);
    }
    const cur = tagById(s.tag);
    $('#buildhint', ctl).innerHTML = `${esc(cur.name)} builds a <b>${esc(speciesById(cur.species).name)}</b>. Change it in Shop or Settings.`;
    renderSoundChips($('#sounds', ctl), false);
    $('#start', ctl).onclick = startSession;
  }
  tick.lastStep = -1;
  drawScene(a ? elapsed(a) / a.planned : 0);
  if (a || b) loop();
}

function renderSoundChips(el, live) {
  const s = state.settings;
  for (const snd of audio.SOUNDS) {
    const c = h(`<button class="chip ${snd.id === s.sound ? 'sel' : ''}">${snd.name}</button>`);
    c.onclick = () => {
      s.sound = snd.id; save();
      if (live) audio.play(s.sound, s.volume);
      [...el.children].forEach(x => x.classList.remove('sel')); c.classList.add('sel');
    };
    el.append(c);
  }
}

// Island
let islandRange = 'today';
function rangeStart(r) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (r === 'today') return +d;
  if (r === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return +d; }
  if (r === 'month') { d.setDate(1); return +d; }
  return 0;
}
function renderIslandView() {
  const v = $('#view-island');
  v.innerHTML = `
    <h1>Your island</h1>
    <div class="seg" id="iseg">${['today', 'week', 'month', 'all'].map(r => `<button data-r="${r}" class="${r === islandRange ? 'sel' : ''}">${r === 'all' ? 'All time' : r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div>
    <div class="island-wrap"><canvas id="isl" class="px"></canvas></div>
    <div class="island-meta" id="imeta"></div>
    <div class="legend" id="legend"></div>`;
  $('#iseg', v).onclick = (e) => { const r = e.target.dataset.r; if (r) { islandRange = r; renderIslandView(); } };
  const from = rangeStart(islandRange);
  const list = state.sessions.filter(s => s.start >= from).sort((a, b) => a.start - b.start);
  const done = list.filter(s => s.status === 'done');
  const cv = $('#isl', v);
  requestAnimationFrame(() => renderIsland(cv, list, { minLand: 9, maxCssWidth: 560 }));
  $('#imeta', v).textContent = list.length
    ? `${done.length} built and ${list.length - done.length} withered, ${fmtDur(done.reduce((t, s) => t + s.focused, 0))} of focus. Tap a building to see when you made it.`
    : 'Nothing here yet. Plant something!';
  const lg = $('#legend', v);
  const byTag = {};
  for (const s of done) byTag[s.tag] = (byTag[s.tag] || 0) + 1;
  for (const t of state.tags) {
    const n = byTag[t.id] || 0;
    const row = h(`<div class="lg"><span class="lg-name" style="color:${t.color}">${esc(t.name)}</span><span class="lg-n">×${n}</span></div>`);
    const c = spriteCanvas(t.species, 2); c.classList.add('px'); row.prepend(c);
    lg.append(row);
  }
  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect();
    const s = cv._hit?.(e.clientX - r.left, e.clientY - r.top);
    if (s) toast(`${s.status === 'dead' ? 'Withered' : speciesById(s.species).name}: ${fmtDur(s.focused)} of ${tagById(s.tag).name}, ${new Date(s.start).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
  };
}

// Stats
let statRange = 'week', statOffset = 0;
function statWindow() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  let from, to, buckets, label, bucketOf, bucketLabel;
  if (statRange === 'day') {
    d.setDate(d.getDate() + statOffset); from = +d; const e = new Date(d); e.setDate(e.getDate() + 1); to = +e;
    buckets = 24; bucketOf = (t) => new Date(t).getHours(); bucketLabel = (i) => (i % 6 === 0 ? `${i}h` : '');
    label = statOffset === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } else if (statRange === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * statOffset); from = +d; const e = new Date(d); e.setDate(e.getDate() + 7); to = +e;
    buckets = 7; bucketOf = (t) => (new Date(t).getDay() + 6) % 7; bucketLabel = (i) => 'MTWTFSS'[i];
    label = `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(to - 1).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  } else if (statRange === 'month') {
    d.setDate(1); d.setMonth(d.getMonth() + statOffset); from = +d; const e = new Date(d); e.setMonth(e.getMonth() + 1); to = +e;
    buckets = Math.round((to - from) / 864e5); bucketOf = (t) => new Date(t).getDate() - 1; bucketLabel = (i) => ((i + 1) % 5 === 0 || i === 0 ? String(i + 1) : '');
    label = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
  } else {
    d.setMonth(0, 1); d.setFullYear(d.getFullYear() + statOffset); from = +d; const e = new Date(d); e.setFullYear(e.getFullYear() + 1); to = +e;
    buckets = 12; bucketOf = (t) => new Date(t).getMonth(); bucketLabel = (i) => 'JFMAMJJASOND'[i];
    label = String(d.getFullYear());
  }
  return { from, to, buckets, label, bucketOf, bucketLabel };
}

function barChart(values, labelOf) {
  const W = 320, H = 140, pb = 16, n = values.length;
  const max = Math.max(1, ...values);
  const bw = W / n;
  const bars = values.map((v, i) => {
    const bh = (v / max) * (H - pb - 14);
    return `<rect x="${i * bw + bw * 0.15}" y="${H - pb - bh}" width="${bw * 0.7}" height="${bh}" fill="var(--accent)"><title>${fmtDur(v * 60)}</title></rect>
      <text x="${i * bw + bw / 2}" y="${H - 3}" fill="var(--muted)" font-size="9" text-anchor="middle">${labelOf(i)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus minutes chart">
    <line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" stroke="var(--line)"/>
    <text x="0" y="10" fill="var(--muted)" font-size="9">max ${fmtDur(max * 60)}</text>${bars}</svg>`;
}

function renderStats() {
  const v = $('#view-stats');
  const w = statWindow();
  const list = state.sessions.filter(s => s.start >= w.from && s.start < w.to);
  const done = list.filter(s => s.status === 'done');
  const total = done.reduce((t, s) => t + s.focused, 0);
  const vals = Array(w.buckets).fill(0);
  for (const s of done) vals[w.bucketOf(s.start)] += s.focused / 60;
  const byTag = {};
  for (const s of done) byTag[s.tag] = (byTag[s.tag] || 0) + s.focused;
  const tagRows = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
  const maxTag = Math.max(1, ...tagRows.map(r => r[1]));
  const { current, best } = streaks();

  v.innerHTML = `
    <h1>Stats</h1>
    <div class="seg" id="sseg">${['day', 'week', 'month', 'year'].map(r => `<button data-r="${r}" class="${r === statRange ? 'sel' : ''}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div>
    <div class="rangebar"><button class="btn ghost" id="prev">‹</button><div class="label">${w.label}</div><button class="btn ghost" id="next" ${statOffset >= 0 ? 'disabled' : ''}>›</button></div>
    <p class="summary">${list.length
      ? `You focused <b>${fmtDur(total)}</b> and built <b>${done.length}</b> ${done.length === 1 ? 'thing' : 'things'}${list.length - done.length ? `, while <b>${list.length - done.length}</b> withered` : ''}.`
      : 'No focus sessions in this range yet.'}
      ${current ? `You're on a <b>${current}-day</b> streak${best > current ? `; your best is ${best}` : ''}.` : best ? `Your best streak is ${best} days.` : ''}</p>
    <h2>Minutes focused</h2>
    <div class="panel chart">${barChart(vals, w.bucketLabel)}</div>
    <h2>By tag</h2>
    <div class="panel">${tagRows.length ? tagRows.map(([id, sec]) => { const t = tagById(id); return `<div class="tagbar"><span>${esc(t.name)}</span><div class="track"><div class="fill" style="width:${(sec / maxTag) * 100}%;background:${t.color}"></div></div><span class="n">${fmtDur(sec)}</span></div>`; }).join('') : '<div class="empty">No sessions in this range.</div>'}</div>
    <h2>History</h2>
    <ul class="hist" id="hist"></ul>`;
  $('#sseg', v).onclick = (e) => { const r = e.target.dataset.r; if (r) { statRange = r; statOffset = 0; renderStats(); } };
  $('#prev', v).onclick = () => { statOffset--; renderStats(); };
  $('#next', v).onclick = () => { if (statOffset < 0) { statOffset++; renderStats(); } };
  const hist = $('#hist', v);
  if (!list.length) hist.append(h('<li class="empty" style="justify-content:center">Nothing yet.</li>'));
  for (const s of [...list].reverse().slice(0, 100)) {
    const t = tagById(s.tag);
    const li = h(`<li><div class="main"><div>${esc(speciesById(s.species).name)} <span class="tagname"><i style="background:${t.color}"></i>${esc(t.name)}</span></div>
      <div class="when">${new Date(s.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>
      <div class="dur ${s.status === 'dead' ? 'dead-txt' : ''}">${s.status === 'dead' ? 'Withered, ' : ''}${fmtDur(s.focused)}</div></li>`);
    const cv = spriteCanvas(s.status === 'dead' ? 'dead' : s.species, 2); cv.classList.add('px');
    li.prepend(cv);
    hist.append(li);
  }
}

// Shop
function renderShop() {
  const v = $('#view-shop');
  v.innerHTML = `<h1>Shop</h1>
    <p class="lede">You have <b>${coins()} coins</b>. Each finished minute of focus earns one. Unlock something new and give it to a tag.</p>
    <ul class="shelf" id="shop"></ul>`;
  const list = $('#shop', v);
  for (const sp of SPECIES) {
    const owned = state.unlocked.includes(sp.id);
    const users = state.tags.filter(t => t.species === sp.id);
    const li = h(`<li class="${owned ? '' : 'locked'}"><div class="main"><div class="name">${sp.name}</div>
      <div class="sub">${owned ? (users.length ? `Built for ${users.map(t => esc(t.name)).join(' and ')}` : 'Not given to a tag') : `${sp.cost} coins`}</div></div></li>`);
    const cv = spriteCanvas(sp.id, 4); cv.classList.add('px'); li.prepend(cv);
    if (owned) {
      const sel = h(`<select aria-label="Give ${sp.name} to a tag"><option value="">Give to…</option>${state.tags.filter(t => t.species !== sp.id).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>`);
      sel.onchange = () => { const t = tagById(sel.value); t.species = sp.id; save(); toast(`${t.name} now builds a ${sp.name.toLowerCase()}`); renderShop(); };
      li.append(sel);
    } else {
      const btn = h(`<button class="btn small">Unlock</button>`);
      if (coins() < sp.cost) { btn.disabled = true; btn.title = `You need ${sp.cost - coins()} more coins`; }
      btn.onclick = () => {
        state.purchases.push({ id: `p${now()}`, species: sp.id, cost: sp.cost, at: now() }); state.unlocked.push(sp.id); save();
        audio.chime(); toast(`Unlocked the ${sp.name.toLowerCase()}. Give it to a tag to start building it.`); renderShop();
      };
      li.append(btn);
    }
    list.append(li);
  }
}

// Settings
function renderSettings() {
  const v = $('#view-settings');
  const s = state.settings;
  v.innerHTML = `
    <h1>Settings</h1>
    <h2>Strict mode</h2>
    <div class="setting"><div>Grace period<div class="desc">How long you can be away before it withers.</div></div>
      <select id="grace">${[5, 10, 20, 30, 60].map(n => `<option ${n === s.grace ? 'selected' : ''} value="${n}">${n}s</option>`).join('')}</select></div>
    <div class="setting"><div>Mac: count switching apps<div class="desc">On: clicking into another app counts as leaving. Off: only hiding or minimizing the window counts.</div></div>
      <input type="checkbox" class="switch" id="blur" ${s.desktopBlur ? 'checked' : ''}></div>
    <div class="setting"><div>Auto-dim on start<div class="desc">Black screen while you focus (iPhone). Tap to wake.</div></div>
      <input type="checkbox" class="switch" id="autodim" ${s.autoDim ? 'checked' : ''}></div>
    <h2>Breaks</h2>
    <div class="setting"><div>Short break</div><select id="sb">${[3, 5, 10].map(n => `<option ${n === s.shortBreak ? 'selected' : ''} value="${n}">${n} min</option>`).join('')}</select></div>
    <div class="setting"><div>Long break (every 4th)</div><select id="lb">${[10, 15, 20, 30].map(n => `<option ${n === s.longBreak ? 'selected' : ''} value="${n}">${n} min</option>`).join('')}</select></div>
    <h2>Sound</h2>
    <div class="setting"><div>Volume</div><input type="range" id="vol" min="0" max="1" step="0.05" value="${s.volume}" style="max-width:180px"></div>
    <h2>Tags &amp; what they build</h2>
    <div id="tagedit"></div>
    <button class="btn ghost small" id="addtag">+ Add tag</button>
    <h2>Your data</h2>
    <div id="datainfo" class="datainfo"></div>
    <div class="actions two">
      <button class="btn ghost small" id="export">Export JSON</button>
      <button class="btn ghost small" id="import">Import JSON</button>
    </div>
    <input type="file" id="importfile" accept="application/json" hidden>
    <div class="actions"><button class="btn danger small" id="reset">Reset everything</button></div>
    <p style="color:var(--muted);font-size:12px;margin-top:20px">iPhone: open in Safari, then Share → Add to Home Screen. Locking the phone counts as leaving, so use Dim instead.</p>`;
  const bind = (id, key, conv = (x) => x) => { $(id, v).onchange = (e) => { s[key] = conv(e.target.type === 'checkbox' ? e.target.checked : e.target.value); save(); }; };
  bind('#grace', 'grace', Number); bind('#blur', 'desktopBlur'); bind('#autodim', 'autoDim');
  bind('#sb', 'shortBreak', Number); bind('#lb', 'longBreak', Number);
  $('#vol', v).oninput = (e) => { s.volume = +e.target.value; save(); if (state.active) audio.setVolume(s.volume); };

  const te = $('#tagedit', v);
  for (const t of state.tags) {
    const row = h(`<div class="tagedit"><input type="color" value="${t.color}"><input type="text" value="${esc(t.name)}" maxlength="20">
      <select class="obj" aria-label="Object for ${esc(t.name)}">${SPECIES.filter(x => state.unlocked.includes(x.id)).map(x => `<option value="${x.id}" ${x.id === t.species ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
      <button class="btn ghost x" aria-label="Delete tag">✕</button></div>`);
    const [color, name] = row.querySelectorAll('input');
    $('.obj', row).onchange = (e) => { t.species = e.target.value; save(); };
    color.onchange = () => { t.color = color.value; save(); };
    name.onchange = () => { t.name = name.value.trim() || t.name; save(); };
    $('.x', row).onclick = () => {
      if (state.tags.length <= 1) return toast('Keep at least one tag.');
      state.tags = state.tags.filter(x => x !== t);
      if (s.tag === t.id) s.tag = state.tags[0].id;
      save(); renderSettings();
    };
    te.append(row);
  }
  $('#addtag', v).onclick = () => {
    const id = 't' + Date.now().toString(36);
    state.tags.push({ id, name: 'New tag', species: 'oak', color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') });
    save(); renderSettings();
  };
  renderDataInfo($('#datainfo', v));
  $('#export', v).onclick = () => {
    state.lastExportAt = now(); save();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `focus-isle-${dayKey(now())}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    renderDataInfo($('#datainfo', v));
  };
  $('#import', v).onclick = () => $('#importfile', v).click();
  $('#importfile', v).onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.sessions)) throw new Error();
      modal({
        title: 'Import data?', body: `<p>${data.sessions.length} sessions. This replaces what's on this device.</p>`,
        actions: [{ label: 'Cancel' }, { label: 'Import', primary: true, onClick: () => { writeBackup('before import', state); state = normalize(data); state.epoch = 'e' + now().toString(36); save(); toast('Imported. Your previous data is in the backup.'); renderAll(); } }],
      });
    } catch { toast('That file is not a Focus Isle export.'); }
  };
  $('#reset', v).onclick = () => modal({
    title: 'Reset everything?', body: '<p>Clears all sessions, coins and unlocks on this device. A backup is kept, and you can restore it from Settings.</p>',
    actions: [{ label: 'Cancel', primary: true }, { label: 'Reset', danger: true, onClick: () => { writeBackup('before reset', state); state = freshState(); save(); renderAll(); toast('Reset. You can restore it from the backup in Settings.'); } }],
  });
}

async function renderDataInfo(el) {
  const b = readBackup();
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const fmtDay = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  el.innerHTML = `
    <p><b>${state.sessions.length}</b> sessions saved on this device. ${persisted ? 'The browser has agreed to keep this data.' : 'The browser may clear this data if the device runs low on space, so export now and then.'}</p>
    <p>${b ? `Automatic backup from ${fmtDay(b.at)} with ${b.data.sessions.length} sessions${b.reason !== 'daily' ? ` (made ${b.reason})` : ''}.` : 'No automatic backup yet. One is made each day you use the app.'}
      ${state.lastExportAt ? `Last export ${fmtDay(state.lastExportAt)}.` : 'Never exported.'}</p>
    ${b ? '<button class="btn ghost small" id="restore">Restore backup</button>' : ''}`;
  const r = $('#restore', el);
  if (r) r.onclick = () => modal({
    title: 'Restore backup?', body: `<p>Replaces what's on this device with the backup from ${fmtDay(b.at)} (${b.data.sessions.length} sessions). Your current data becomes the new backup.</p>`,
    actions: [{ label: 'Cancel' }, { label: 'Restore', primary: true, onClick: () => { const cur = state; state = normalize(b.data); state.epoch = 'e' + now().toString(36); writeBackup('before restore', cur); save(); toast('Backup restored'); renderAll(); } }],
  });
}

// ---------- Navigation ----------
let currentView = 'focus';
const renderers = { focus: renderFocus, island: renderIslandView, stats: renderStats, shop: renderShop, settings: renderSettings };
function show(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  renderers[view]();
  window.scrollTo(0, 0);
}
function renderAll() { show(currentView); }
for (const el of document.querySelectorAll('#tabbar [data-icon]')) {
  el.append(iconCanvas(el.dataset.icon, '#f0dcae', 2));
}
$('#tabbar').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.view); });
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (currentView === 'island') renderIslandView(); else if (currentView === 'focus') { tick.lastStep = -1; tick(); drawScene(state.active ? elapsed(state.active) / state.active.planned : 0); } }, 150); });

// ---------- Boot ----------
// Ask the browser not to clear our data under storage pressure.
navigator.storage?.persist?.().catch(() => {});
// Daily rolling backup, never replacing a backup that has more sessions than the current data.
(() => {
  const b = readBackup();
  if (!state.sessions.length) return;
  if (!b || (now() - b.at > 20 * 3600e3 && state.sessions.length >= b.data.sessions.length)) writeBackup('daily', state);
})();
if (!readKey(KEY) || storageIssues.length) save();
if (state.active && !state.active.awayAt && state.active.seenAt && now() - state.active.seenAt > (state.settings.grace + 6) * 1000) state.active.awayAt = state.active.seenAt;
if (state.active?.awayAt) back(); // resumed after being killed in the background
if (state.active && !state.active.awayAt && elapsed(state.active) >= state.active.planned) finish('done');
show('focus');
if (storageIssues.includes('restored')) toast('Your saved data was unreadable, so it was restored from the automatic backup.', 6000);
else if (storageIssues.includes('corrupt')) toast('Your saved data was unreadable. A copy was kept, but no backup was found.', 6000);
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STANDALONE = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
if (IOS && !STANDALONE && !state.settings.installHintDismissed) {
  const bar = h(`<div id="installbar"><div><b>Add Focus Isle to your Home Screen.</b> In a Safari tab, iPhone can clear your island after 7 days without a visit. Tap Share, then Add to Home Screen, and use the app from there.</div><button class="btn small" aria-label="Dismiss">OK</button></div>`);
  $('button', bar).onclick = () => { state.settings.installHintDismissed = true; save(); bar.remove(); };
  document.body.append(bar);
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
