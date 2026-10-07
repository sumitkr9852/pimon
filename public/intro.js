// Game-style onboarding: enter → avatar + name → song → drop into home.
// Then runs the avatar companion (jumps between sections, tracks mouse).
import * as THREE from 'three';
import { AVATARS, buildAvatar, animateAvatar, startJump, stepJump, stepLand } from './avatar3d.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NICKNAMES = ['BADDIE', 'MOGGER', 'ALPHA', 'GHOST'];
const RANDOM_NAMES = ['Key Limmi', 'Pixel Don', 'Neon Baba', 'Shadow Fox', 'Glitch Bhai', 'Zero Cool'];

const state = { avatar: 'mogger', name: '', nick: 'MOGGER', vibe: null, reelLabel: '' };
let reels = [];
let nowPlaying = null; // the reel <video> that is the site soundtrack
let entered = false;

/* ---------- lights helper ---------- */
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 1.4);
  d.position.set(2, 3, 4);
  scene.add(d);
}

/* ---------- avatar preview cards ---------- */
const previewLoops = [];
function buildPreviews() {
  const grid = $('#avaGrid');
  grid.innerHTML = '';
  Object.keys(AVATARS).forEach((key) => {
    const card = document.createElement('button');
    card.className = 'ava-card' + (key === state.avatar ? ' active' : '');
    card.innerHTML = `<canvas width="132" height="132"></canvas><span>${AVATARS[key].label}</span>`;
    card.addEventListener('click', () => {
      state.avatar = key;
      grid.querySelectorAll('.ava-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
    });
    grid.appendChild(card);

    const canvas = card.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    addLights(scene);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 0.15, 3.6);
    const av = buildAvatar(key);
    scene.add(av);
    const clock = new THREE.Clock();
    let alive = true;
    const mouse = { x: 0, y: 0 };
    card.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.y = -((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    (function loop() {
      if (!alive || entered) { renderer.dispose(); return; }
      const t = clock.getElapsedTime();
      animateAvatar(av, t, mouse);
      av.rotation.y = Math.sin(t * 0.7) * 0.35;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })();
    previewLoops.push(() => { alive = false; });
  });
}

/* ---------- nickname chips ---------- */
function buildNicks() {
  const row = $('#nickRow');
  row.innerHTML = '';
  NICKNAMES.forEach((n) => {
    const b = document.createElement('button');
    b.className = 'nick' + (n === state.nick ? ' active' : '');
    b.textContent = n;
    b.addEventListener('click', () => {
      state.nick = n;
      row.querySelectorAll('.nick').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    row.appendChild(b);
  });
}

/* ---------- reel cards ---------- */
async function buildSongs() {
  const grid = $('#songGrid');
  grid.innerHTML = '<p class="ob-sub">loading reels…</p>';
  try {
    reels = await (await fetch('/api/reels')).json();
  } catch { reels = []; }
  grid.innerHTML = '';
  reels.forEach((r) => {
    const card = document.createElement('button');
    card.className = 'song-card reel-card' + (r.video_url ? '' : ' empty');
    card.innerHTML = (r.video_url
      ? `<video src="${esc(r.video_url)}" muted loop playsinline autoplay preload="auto"></video>`
      : `<div class="reel-empty">no video yet<br><small>set it in admin panel</small></div>`)
      + `<span class="song-lyric">"${esc(r.lyric || 'pick a vibe')}"</span>
         <span class="song-name">${esc(r.label || 'REEL')}</span>`;
    const vid = card.querySelector('video');
    if (vid) vid.play().catch(() => {});
    card.addEventListener('click', () => selectReel(r, vid));
    grid.appendChild(card);
  });
  const skip = document.createElement('button');
  skip.className = 'ghost ob-skip';
  skip.textContent = 'Skip →';
  skip.addEventListener('click', () => finishOnboarding());
  grid.appendChild(skip);
}

// the clicked reel's video becomes the site-wide soundtrack
function playReelVideo(reel) {
  let holder = $('#nowPlaying');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'nowPlaying';
    holder.hidden = true;
    document.body.appendChild(holder);
  }
  holder.innerHTML = '';
  nowPlaying = null;
  if (!reel || !reel.video_url) return;
  const v = document.createElement('video');
  v.src = reel.video_url;
  v.loop = true;
  v.playsInline = true;
  v.muted = false;
  holder.appendChild(v);
  nowPlaying = v;
  v.play().catch(() => {});
  const t = $('#audioToggle');
  t.hidden = false;
  t.classList.remove('muted');
}

function selectReel(r, vid) {
  state.vibe = 'reel' + r.id;
  state.reelLabel = r.label;
  playReelVideo(r);
  finishOnboarding();
}

/* ---------- stages ---------- */
function showStage(id) {
  document.querySelectorAll('.ob-stage').forEach((s) => (s.hidden = s.id !== id));
}
function currentProfile() {
  try { return JSON.parse(localStorage.getItem('flux_profile') || 'null'); }
  catch { return null; }
}

function finishOnboarding() {
  // name fallback → random
  const typed = $('#obName').value.trim().slice(0, 24);
  state.name = typed || RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  try {
    localStorage.setItem('flux_profile', JSON.stringify({
      name: state.name, nick: state.nick, avatar: state.avatar, vibe: state.vibe,
    }));
  } catch { /* private mode */ }
  window.__profile = { ...state };
  if (state.vibe && state.vibe.startsWith('reel')) $('#audioToggle').hidden = false;

  // smooth drop into home
  document.body.classList.add('entered');
  setTimeout(() => { $('#onboard').hidden = true; }, 1100);
  entered = true;
  startCompanion();
  window.dispatchEvent(new CustomEvent('flux:entered'));
}

/* ---------- companion ---------- */
let compStarted = false;
function startCompanion() {
  if (compStarted) return;
  compStarted = true;
  const wrap = $('#companion');
  wrap.hidden = false;
  $('#compLabel').textContent = `${state.nick} · ${state.name}`;

  const canvas = $('#compCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  addLights(scene);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  camera.position.set(0, 0.1, 4.4);
  const av = buildAvatar(state.avatar);
  av.userData.groundY = -0.78;
  av.position.y = -0.78;
  scene.add(av);

  const mouse = { x: 0, y: 0 };
  addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / innerWidth - 0.5) * 2;
    mouse.y = -((e.clientY / innerHeight - 0.5) * 2);
  });

  // jump when a new section takes center stage
  const seen = new Set();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting && !seen.has(e.target)) {
        seen.add(e.target);
        startJump(av);
        setTimeout(() => seen.delete(e.target), 4000);
      }
    });
  }, { threshold: 0.55 });
  document.querySelectorAll('main section').forEach((s) => io.observe(s));
  // welcome jump
  setTimeout(() => startJump(av), 900);

  const clock = new THREE.Clock();
  (function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const jumping = stepJump(av, dt);
    stepLand(av, dt);
    const baseY = av.userData.groundY || 0;
    animateAvatar(av, t, mouse, jumping ? 1 : 0);
    av.position.y = baseY + (av.userData.jumpY || 0) + Math.sin(t * 2.2) * 0.05;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();
}

/* ---------- audio toggle ---------- */
$('#audioToggle').addEventListener('click', () => {
  if (!nowPlaying) return;
  nowPlaying.muted = !nowPlaying.muted;
  if (!nowPlaying.muted) nowPlaying.play().catch(() => {});
  $('#audioToggle').classList.toggle('muted', nowPlaying.muted);
});

/* ---------- boot ---------- */
buildPreviews();
buildNicks();
buildSongs();

const saved = currentProfile();
if (saved) {
  const btn = $('#enterContinue');
  btn.hidden = false;
  btn.innerHTML = `Continue as <b>${saved.nick} · ${saved.name}</b> →`;
  btn.addEventListener('click', async () => {
    Object.assign(state, { avatar: saved.avatar, name: saved.name, nick: saved.nick, vibe: saved.vibe || null, reelLabel: saved.reelLabel || '' });
    if (state.vibe && state.vibe.startsWith('reel')) {
      try {
        const rs = await (await fetch('/api/reels')).json();
        const id = Number(state.vibe.replace('reel', ''));
        playReelVideo(rs.find((r) => r.id === id));
      } catch { /* silent entry */ }
    }
    finishOnboarding();
  });
}
$('#enterGo').addEventListener('click', () => showStage('ob-avatar'));
$('#toSong').addEventListener('click', () => showStage('ob-song'));
$('#obBack').addEventListener('click', () => showStage('ob-enter'));
showStage('ob-enter');
