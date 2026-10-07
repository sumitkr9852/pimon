import * as THREE from 'three';

/* ============ helpers ============ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.hidden = true), 2600);
}

/* ============ loader ============ */
let progress = 0;
const loadInt = setInterval(() => {
  progress = Math.min(100, progress + Math.random() * 22);
  $('#loadPct').textContent = String(Math.floor(progress)).padStart(2, '0');
  if (progress >= 100) {
    clearInterval(loadInt);
    setTimeout(() => $('#loader').classList.add('done'), 350);
  }
}, 120);

/* ============ smooth scroll ============ */
if (window.Lenis) {
  const lenis = new Lenis({ lerp: 0.09 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  // anchor links through lenis
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const el = document.querySelector(a.getAttribute('href'));
      if (el) { e.preventDefault(); lenis.scrollTo(el); }
    }));
}

/* ============ reveal on scroll ============ */
const io = new IntersectionObserver((es) => {
  es.forEach((e) => e.isIntersecting && e.target.classList.add('in'));
}, { threshold: 0.12 });
$$('.projects h2, .projects .grid, .projects .note, .glass-card').forEach((el) => {
  el.classList.add('reveal'); io.observe(el);
});

/* ============ custom cursor (delegated) ============ */
const cursor = $('#cursor');
let cx = -100, cy = -100, tx = -100, ty = -100;
addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
(function cursorLoop() {
  cx = lerp(cx, tx, 0.2); cy = lerp(cy, ty, 0.2);
  cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
  requestAnimationFrame(cursorLoop);
})();
document.addEventListener('mouseover', (e) => {
  cursor.classList.toggle('grow', !!e.target.closest('button, input, textarea, a'));
});

/* ============ shape generators (all return COUNT points) ============ */
const COUNT = 22000;

function outlineToSegs(pts) {
  const segs = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    segs.push([a[0], a[1], b[0], b[1]]);
  }
  return segs;
}
function sampleSegments(segments, count) {
  const lens = segments.map((s) => Math.hypot(s[2] - s[0], s[3] - s[1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const pts = [];
  let si = 0, acc = 0;
  for (let i = 0; i < count; i++) {
    const d = ((i + 0.5) / count) * total;
    while (si < lens.length - 1 && acc + lens[si] <= d) { acc += lens[si]; si++; }
    const s = segments[si], t = lens[si] ? (d - acc) / lens[si] : 0;
    pts.push([s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t]);
  }
  return pts;
}
function roundedRectOutline(w, h, r, steps = 30) {
  const pts = [];
  const hw = w / 2, hh = h / 2;
  const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]];
  for (const [ccx, ccy, a0] of corners)
    for (let i = 0; i < steps; i++) {
      const a = a0 + (i / steps) * Math.PI / 2;
      pts.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)]);
    }
  return pts;
}
function circleOutline(r, cx = 0, cy = 0, steps = 140) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function discPoints(r, cx, cy, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, rr = r * Math.sqrt(Math.random());
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
function toFloat32(list2d, zJitter = 0.06) {
  const arr = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const p = list2d[i % list2d.length];
    arr[i * 3] = p[0];
    arr[i * 3 + 1] = p[1];
    arr[i * 3 + 2] = (Math.random() - 0.5) * 2 * zJitter;
  }
  return arr;
}

function buildSphere() {
  const pts = [];
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random(), v = Math.random();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    const r = 2.4 * (0.92 + Math.random() * 0.08);
    pts.push([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), 0]);
  }
  const arr = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random(), v = Math.random();
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    const r = 2.4 * (0.92 + Math.random() * 0.08);
    arr[i * 3] = r * Math.sin(ph) * Math.cos(th);
    arr[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    arr[i * 3 + 2] = r * Math.cos(ph);
  }
  return arr;
}
function buildIG() {
  const rect = sampleSegments(outlineToSegs(roundedRectOutline(3.6, 3.6, 1.0)), 11000);
  const circ = sampleSegments(outlineToSegs(circleOutline(0.85)), 7700);
  const dot = discPoints(0.17, 1.02, 1.02, 3300);
  return toFloat32([...rect, ...circ, ...dot]);
}
function buildGmail() {
  const rectPts = [[-1.9, 1.35], [1.9, 1.35], [1.9, -1.35], [-1.9, -1.35]];
  const rect = sampleSegments(outlineToSegs(rectPts), 12100);
  const flap = sampleSegments([
    [-1.9, 1.35, -0.55, -0.35], [-0.55, -0.35, 0, 0.45],
    [0, 0.45, 0.55, -0.35], [0.55, -0.35, 1.9, 1.35],
  ], 9900);
  return toFloat32([...rect, ...flap]);
}

const SHAPES = [buildSphere(), buildIG(), buildGmail()];

/* ============ THREE scene ============ */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 7;

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(SHAPES[0].slice(), 3));
geo.setAttribute('aTarget', new THREE.BufferAttribute(SHAPES[0].slice(), 3));
geo.setAttribute('aRand', new THREE.BufferAttribute(Float32Array.from({ length: COUNT }, Math.random), 1));

const baseA = new THREE.Color('#ffffff'), baseB = new THREE.Color('#ff5a36');
const limeA = new THREE.Color('#f2ffe0'), limeB = new THREE.Color('#c8ff3d');

const uniforms = {
  uTime: { value: 0 },
  uMorph: { value: 0 },
  uEnergy: { value: 0 },
  uColorA: { value: baseA.clone() },
  uColorB: { value: baseB.clone() },
  uIcon: { value: 0 },
  uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
};

const mat = new THREE.ShaderMaterial({
  uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute vec3 aTarget;
    attribute float aRand;
    uniform float uTime, uMorph, uEnergy, uPixelRatio, uIcon;
    varying float vGlow;
    varying float vRand;
    void main() {
      vec3 p = mix(position, aTarget, uMorph);
      float t = uTime * 0.6;
      float n = sin(p.x * 2.1 + t) * sin(p.y * 1.7 + t * 1.3) * sin(p.z * 2.4 + t * 0.8);
      float amp = (0.16 + uEnergy * 0.55 + aRand * 0.06) * (1.0 - uIcon * 0.72);
      p += normalize(p + 0.0001) * n * amp;
      vGlow = smoothstep(-0.6, 0.9, n);
      vRand = aRand;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = (1.4 + vGlow * 2.6 + aRand * 1.2) * uPixelRatio * (9.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColorA, uColorB;
    uniform float uTime;
    varying float vGlow;
    varying float vRand;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.04, d);
      // gentle twinkle
      float tw = 0.78 + 0.22 * sin(uTime * 2.6 + vRand * 43.0);
      vec3 col = mix(uColorA, uColorB, vGlow * 0.85 + vRand * 0.15);
      gl_FragColor = vec4(col, soft * 0.78 * tw);
    }`,
});

const group = new THREE.Group();
group.add(new THREE.Points(geo, mat));
scene.add(group);

let mx = 0, my = 0, eTarget = 0;
addEventListener('mousemove', (e) => {
  mx = (e.clientX / innerWidth - 0.5) * 2;
  my = (e.clientY / innerHeight - 0.5) * 2;
});
addEventListener('pointerdown', () => { eTarget = 1; setTimeout(() => (eTarget = 0), 450); });

/* scroll-scrubbed morph: hero → IG icon → Gmail icon
   s1: 0→1 as viewport center travels IG-section top → IG-section center (sphere→IG)
   s2: 0→1 as viewport center travels IG-section center → Gmail-section center (IG→Gmail) */
const igSec = $('#contact-ig'), gmSec = $('#contact-gmail');
const sstep = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
function contactMorph() {
  const r1 = igSec.getBoundingClientRect(), r2 = gmSec.getBoundingClientRect();
  const c = innerHeight * 0.5;
  const igC = r1.top + r1.height / 2, gmC = r2.top + r2.height / 2;
  const s1 = sstep((c - r1.top) / Math.max(1, igC - r1.top));
  const s2 = sstep((c - igC) / Math.max(1, gmC - igC));
  return { s1, s2 };
}
let curA = 0, curB = 0, sm1 = 0, sm2 = 0, glow = 0;
function setStage(a, b, m) {
  if (a !== curA) { geo.attributes.position.array.set(SHAPES[a]); geo.attributes.position.needsUpdate = true; curA = a; }
  if (b !== curB) { geo.attributes.aTarget.array.set(SHAPES[b]); geo.attributes.aTarget.needsUpdate = true; curB = b; }
  uniforms.uMorph.value = m;
}

const clock = new THREE.Clock();
// ?shot=1 → freeze after a few frames · ?shot=60 → freeze after 60 (lets scroll-morph converge)
const _shotM = /[?&]shot=(\d*)/.exec(location.search);
const STATIC_SHOT = !!_shotM;
const SHOT_FRAMES = _shotM ? (parseInt(_shotM[1], 10) || 6) : 6;
let shotFrames = 0;
(function tick() {
  const t = clock.getElapsedTime();
  uniforms.uTime.value = t;
  uniforms.uEnergy.value = lerp(uniforms.uEnergy.value, eTarget, 0.08);

  // scroll scrub (smoothed)
  const cm = contactMorph();
  sm1 = lerp(sm1, cm.s1, 0.14);
  sm2 = lerp(sm2, cm.s2, 0.14);
  if (sm2 > 0.002) setStage(1, 2, sm2);
  else if (sm1 > 0.002) setStage(0, 1, sm1);
  else setStage(0, 0, 0);

  // lime theme fades in across the contact zone
  glow = lerp(glow, (sm1 > 0.02 || sm2 > 0.002) ? 1 : 0, 0.06);
  uniforms.uColorA.value.lerpColors(baseA, limeA, glow);
  uniforms.uColorB.value.lerpColors(baseB, limeB, glow);
  uniforms.uIcon.value = glow;

  group.rotation.y = (t * 0.12 + mx * 0.35) * (1 - glow) + mx * 0.1 * glow;
  group.rotation.x = my * 0.25 * (1 - glow * 0.6);
  // in the contact zone the icon slides beside the card (above it on mobile)
  const mob = innerWidth < 760;
  group.position.x = lerp(group.position.x, glow * (mob ? 0 : 2.8), 0.08);
  group.position.y = Math.sin(t * 0.5) * 0.12 + glow * (mob ? 1.9 : 0);
  renderer.render(scene, camera);
  if (STATIC_SHOT && ++shotFrames >= SHOT_FRAMES) return; // frozen — safe to screenshot
  requestAnimationFrame(tick);
})();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  uniforms.uPixelRatio.value = Math.min(devicePixelRatio, 2);
});

/* ============ projects ============ */
(function renderProjects() {
  const grid = $('#projectGrid');
  const list = window.PROJECTS || [];
  grid.innerHTML = list.map((p) => `
    <div class="card">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
      <div class="tags">${(p.tags || []).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      <div class="links">
        ${p.live && p.live !== '#' ? `<a href="${esc(p.live)}" target="_blank" rel="noopener">Live ↗</a>` : ''}
        ${p.code && p.code !== '#' ? `<a href="${esc(p.code)}" target="_blank" rel="noopener">Code ↗</a>` : ''}
      </div>
    </div>`).join('');
})();

/* ============ visit counter ============ */
fetch('/api/visit', { method: 'POST' })
  .then((r) => r.json())
  .then((d) => { $('#visitCount').textContent = Number(d.visits).toLocaleString('en-IN'); })
  .catch(() => { $('#visitCount').textContent = '—'; });

/* ============ copy email ============ */
$('#copyEmail').addEventListener('click', async () => {
  const email = 'sumitkr985299@gmail.com';
  try { await navigator.clipboard.writeText(email); }
  catch { const ta = document.createElement('textarea'); ta.value = email; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('Email copied');
});

/* ============ contact form ============ */
$('#contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#cName').value.trim(), email = $('#cEmail').value.trim(), message = $('#cMsg').value.trim();
  if (!name || !email || !message) return;
  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, message }),
  }).then((r) => {
    if (!r.ok) throw 0;
    $('#contactForm').reset();
    $('#formOk').hidden = false;
    toast('Message sent');
  }).catch(() => toast('Could not send — try again'));
});

/* ============ admin ============ */
const loginModal = $('#loginModal'), adminPanel = $('#adminPanel');
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (r.status === 401) throw new Error('unauthorized');
  if (!r.ok) throw new Error('request failed');
  return r.json();
}
function openLogin() { loginModal.hidden = false; $('#loginErr').hidden = true; $('#aUser').value = ''; $('#aPass').value = ''; setTimeout(() => $('#aUser').focus(), 50); }
function closeLogin() { loginModal.hidden = true; }

$('#adminOpen').addEventListener('click', async () => {
  try { await api('/api/admin/me'); openDashboard(); }
  catch { openLogin(); }
});
$('#loginCancel').addEventListener('click', closeLogin);
loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLogin(); });
async function doLogin() {
  const username = $('#aUser').value, password = $('#aPass').value;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    closeLogin(); openDashboard(); toast('Welcome back');
  } catch {
    const el = $('#loginErr');
    el.textContent = 'Invalid credentials';
    el.hidden = false;
  }
}
$('#loginGo').addEventListener('click', doLogin);
$('#aPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function openDashboard() {
  adminPanel.hidden = false;
  document.body.style.overflow = 'hidden';
  await Promise.all([loadInbox(), loadStats()]);
}
function closeDashboard() { adminPanel.hidden = true; document.body.style.overflow = ''; }
$('#adminClose').addEventListener('click', closeDashboard);
$('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  closeDashboard(); toast('Logged out');
});
$$('.tabs button').forEach((b) => b.addEventListener('click', () => {
  $$('.tabs button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  $('#tab-inbox').hidden = b.dataset.tab !== 'inbox';
  $('#tab-stats').hidden = b.dataset.tab !== 'stats';
  $('#tab-reels').hidden = b.dataset.tab !== 'reels';
  if (b.dataset.tab === 'reels') loadReels();
}));

/* ---------- admin: reels ---------- */
async function loadReels() {
  const wrap = $('#reelSlots');
  wrap.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const rows = await api('/api/reels');
    wrap.innerHTML = '';
    rows.forEach((r) => {
      const d = document.createElement('div');
      d.className = 'reel-slot';
      d.dataset.id = r.id;
      d.innerHTML = `
        <h4>REEL 0${r.id}</h4>
        <input class="r-label" placeholder="Label (e.g. MIDNIGHT DRIVE)" value="${r.label || ''}" maxlength="40">
        <input class="r-lyric" placeholder="Lyric line shown on card" value="${r.lyric || ''}" maxlength="80">
        <div class="reel-row">
          <input class="r-ig" placeholder="Instagram reel link (https://instagram.com/reel/…)" value="${r.ig_url || ''}">
          <button class="ghost r-fetch">Fetch</button>
        </div>
        <input class="r-video" placeholder="Direct MP4 link (auto-filled by Fetch, or paste manually)" value="${r.video_url || ''}">
        <video class="reel-preview" ${r.video_url ? `src="${r.video_url}"` : ''} muted loop playsinline preload="metadata"></video>
        <p class="reel-status"></p>`;
      const status = d.querySelector('.reel-status');
      const videoIn = d.querySelector('.r-video');
      const preview = d.querySelector('.reel-preview');
      videoIn.addEventListener('input', () => { preview.src = videoIn.value.trim(); });
      d.querySelector('.r-fetch').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const ig = d.querySelector('.r-ig').value.trim();
        if (!ig) { status.textContent = 'Paste an IG reel link first.'; status.className = 'reel-status err'; return; }
        btn.disabled = true;
        status.textContent = 'Fetching video… (can take ~30s)';
        status.className = 'reel-status';
        try {
          const j = await api('/api/admin/reels/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: ig }),
          });
          videoIn.value = j.video_url;
          preview.src = j.video_url;
          status.textContent = 'Video fetched ✓ — hit Save reels below.';
          status.className = 'reel-status ok';
        } catch (err) {
          status.textContent = err.message;
          status.className = 'reel-status err';
        }
        btn.disabled = false;
      });
      wrap.appendChild(d);
    });
  } catch (e) {
    wrap.innerHTML = `<p class="muted">Failed to load: ${e.message}</p>`;
  }
}
$('#saveReels').addEventListener('click', async () => {
  const reels = [...document.querySelectorAll('.reel-slot')].map((d) => ({
    id: Number(d.dataset.id),
    label: d.querySelector('.r-label').value,
    lyric: d.querySelector('.r-lyric').value,
    ig_url: d.querySelector('.r-ig').value,
    video_url: d.querySelector('.r-video').value,
  }));
  try {
    await api('/api/admin/reels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reels }),
    });
    toast('Reels saved ✓');
  } catch (e) { toast('Save failed: ' + e.message); }
});

async function loadInbox() {
  const ul = $('#inboxList');
  try {
    const rows = await api('/api/admin/contacts');
    const unread = rows.filter((r) => !r.read).length;
    $('#unreadBadge').textContent = unread || '';
    ul.innerHTML = rows.length ? rows.map((m) => `
      <li class="${m.read ? '' : 'unread'}">
        <div class="meta"><b>${esc(m.name)}</b><span>${esc(m.email)}</span><span>${esc(m.created_at)}</span></div>
        <div class="msg">${esc(m.message)}</div>
        <div class="actions">
          ${m.read ? '' : `<button data-act="read" data-id="${m.id}">Mark read</button>`}
          <button data-act="del" data-id="${m.id}" class="danger">Delete</button>
        </div>
      </li>`).join('') : '<li class="muted">Inbox empty.</li>';
    ul.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === 'read') await api(`/api/admin/contacts/${id}/read`, { method: 'POST' });
        else if (confirm('Delete this message?')) await api(`/api/admin/contacts/${id}`, { method: 'DELETE' });
        else return;
        loadInbox(); loadStats();
      } catch { toast('Action failed'); }
    }));
  } catch { ul.innerHTML = '<li class="muted">Could not load inbox.</li>'; }
}
async function loadStats() {
  try {
    const s = await api('/api/admin/stats');
    $('#statCards').innerHTML = `
      <div class="stat"><b>${Number(s.visits).toLocaleString('en-IN')}</b><span>Total visits</span></div>
      <div class="stat"><b>${s.messages}</b><span>Messages</span></div>
      <div class="stat"><b>${s.unread}</b><span>Unread</span></div>`;
  } catch { $('#statCards').innerHTML = '<p class="muted">Could not load stats.</p>'; }
}
