import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { randomUUID, timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';
import { execFile } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ---- Admin credentials (owner-approved simple auth for this personal site) ----
const ADMIN_USER = 'Sumit0001';
const ADMIN_PASS = 'Sumit@0001';
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours

// ---- Database ----
const db = new DatabaseSync(path.join(__dirname, 'flux.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO meta (key, value) VALUES ('visits', 0);
  CREATE TABLE IF NOT EXISTS reels (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    lyric TEXT NOT NULL DEFAULT '',
    ig_url TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO reels (id, label, lyric) VALUES
    (1, 'REEL 01', 'pick a vibe'),
    (2, 'REEL 02', 'pick a vibe'),
    (3, 'REEL 03', 'pick a vibe');
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    desc TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    live TEXT NOT NULL DEFAULT '#',
    code TEXT NOT NULL DEFAULT '#',
    sort INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
if (!db.prepare('SELECT COUNT(*) AS c FROM projects').get().c) {
  const ins = db.prepare('INSERT INTO projects (title, desc, tags, live, code, sort) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run('Password Saver', 'Browser extension that generates and stores strong passwords locally. No cloud, no tracking — your vault never leaves the device.', JSON.stringify(['Extension', 'JavaScript', 'Security']), '#', '#', 1);
  ins.run('FLUX Engine', 'Real-time WebGL particle system — 22k GPU particles morphing between shapes, driven by scroll and cursor.', JSON.stringify(['Three.js', 'WebGL', 'Creative']), '#', '#', 2);
  ins.run('Project Three', 'Short description of your next project. Replace this card with something real.', JSON.stringify(['Web', 'Design']), '#', '#', 3);
}

// ---- Sessions (in-memory) ----
const sessions = new Map(); // token -> expiresAt
setInterval(() => {
  const now = Date.now();
  for (const [tok, exp] of sessions) if (exp < now) sessions.delete(tok);
}, 60 * 1000).unref();

function getSessionToken(req) {
  const m = /flux_admin=([^;]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
function requireAdmin(req, res, next) {
  const tok = getSessionToken(req);
  const exp = tok && sessions.get(tok);
  if (!exp || exp < Date.now()) {
    if (tok) sessions.delete(tok);
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
function safeEqual(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ---- Login rate limiting (10 attempts / 5 min per IP) ----
const attempts = new Map(); // ip -> { count, resetAt }
function loginAllowed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) { attempts.set(ip, { count: 0, resetAt: now + 5 * 60 * 1000 }); return true; }
  return rec.count < 10;
}
function loginFailed(ip) {
  const rec = attempts.get(ip);
  if (rec) rec.count++;
}

app.use(express.json({ limit: '20kb' }));

// ---- Auth ----
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!loginAllowed(ip)) return res.status(429).json({ error: 'too many attempts, try later' });
  const { username = '', password = '' } = req.body || {};
  if (safeEqual(String(username), ADMIN_USER) && safeEqual(String(password), ADMIN_PASS)) {
    attempts.delete(ip);
    const tok = randomUUID();
    sessions.set(tok, Date.now() + SESSION_TTL);
    res.setHeader('Set-Cookie', `flux_admin=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`);
    return res.json({ ok: true });
  }
  loginFailed(ip);
  res.status(401).json({ error: 'invalid credentials' });
});
app.post('/api/logout', (req, res) => {
  const tok = getSessionToken(req);
  if (tok) sessions.delete(tok);
  res.setHeader('Set-Cookie', 'flux_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

// ---- Admin APIs ----
app.get('/api/admin/contacts', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, message, read, created_at FROM contacts ORDER BY id DESC LIMIT 200').all();
  res.json(rows);
});
app.post('/api/admin/contacts/:id/read', requireAdmin, (req, res) => {
  db.prepare('UPDATE contacts SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/contacts/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const visits = db.prepare("SELECT value FROM meta WHERE key = 'visits'").get().value;
  const msgs = db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c;
  const unread = db.prepare('SELECT COUNT(*) AS c FROM contacts WHERE read = 0').get().c;
  res.json({ visits, messages: msgs, unread });
});

// ---- Reels: resolve an IG link (or any page) to a direct mp4 ----
function runCmd(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout);
    });
  });
}
async function resolveReel(url) {
  url = String(url || '').trim();
  if (!url) throw new Error('empty url');
  if (/\.mp4(\?|#|$)/i.test(url)) return url; // already direct
  // 1) yt-dlp (best effort — IG often blocks datacenters)
  const ytdlp = await runCmd('yt-dlp', ['--no-playlist', '-g', '-f', 'mp4', url], 30000);
  if (ytdlp) {
    const first = ytdlp.split('\n').map((s) => s.trim()).find((s) => /^https?:\/\//.test(s));
    if (first) return first;
  }
  // 2) cobalt public API instances (open source)
  for (const inst of ['https://api.cobalt.tools/api/json', 'https://cobalt-api.meowing.de/api/json']) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(inst, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url }),
        signal: ctl.signal,
      });
      clearTimeout(to);
      const j = await r.json().catch(() => null);
      if (j && typeof j.url === 'string' && /^https?:\/\//.test(j.url)) return j.url;
    } catch { /* try next */ }
  }
  throw new Error('Could not fetch video from that link. Instagram often blocks servers — download the reel as MP4 and paste a direct link instead.');
}

// ---- Projects APIs ----
function parseProject(r) {
  let tags = [];
  try { tags = JSON.parse(r.tags || '[]'); } catch { /* keep [] */ }
  return { id: r.id, title: r.title, desc: r.desc, tags: Array.isArray(tags) ? tags : [], live: r.live, code: r.code };
}
app.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY sort ASC, id ASC').all();
  res.json(rows.map(parseProject));
});
app.post('/api/admin/projects', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'title required' });
  const tags = Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const r = db.prepare('INSERT INTO projects (title, desc, tags, live, code, sort) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(b.title).slice(0, 80), String(b.desc || '').slice(0, 500), JSON.stringify(tags.slice(0, 8)),
      String(b.live || '#').slice(0, 300), String(b.code || '#').slice(0, 300), Number(b.sort) || 0);
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});
app.put('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  const cur = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  const tags = b.tags === undefined ? cur.tags
    : JSON.stringify((Array.isArray(b.tags) ? b.tags : String(b.tags || '').split(',').map((t) => t.trim()).filter(Boolean)).slice(0, 8));
  db.prepare('UPDATE projects SET title = ?, desc = ?, tags = ?, live = ?, code = ?, sort = ? WHERE id = ?').run(
    String(b.title ?? cur.title).slice(0, 80), String(b.desc ?? cur.desc).slice(0, 500), tags,
    String(b.live ?? cur.live).slice(0, 300), String(b.code ?? cur.code).slice(0, 300),
    b.sort === undefined ? cur.sort : (Number(b.sort) || 0), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Reels APIs ----
app.get('/api/reels', (req, res) => {
  const rows = db.prepare('SELECT id, label, lyric, ig_url, video_url FROM reels ORDER BY id').all();
  res.json(rows);
});

app.put('/api/admin/reels', requireAdmin, (req, res) => {
  const list = Array.isArray(req.body?.reels) ? req.body.reels : [];
  const getCur = db.prepare('SELECT label, lyric, ig_url, video_url FROM reels WHERE id = ?');
  const stmt = db.prepare('UPDATE reels SET label = ?, lyric = ?, ig_url = ?, video_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  for (const r of list.slice(0, 3)) {
    const id = [1, 2, 3].includes(Number(r.id)) ? Number(r.id) : null;
    if (!id) continue;
    const cur = getCur.get(id) || { label: '', lyric: '', ig_url: '', video_url: '' };
    const pick = (key, max) => (key in r ? String(r[key] ?? '').slice(0, max) : cur[key]);
    stmt.run(pick('label', 40), pick('lyric', 80), pick('ig_url', 300), pick('video_url', 500), id);
  }
  res.json({ ok: true });
});

app.post('/api/admin/reels/fetch', requireAdmin, async (req, res) => {
  try {
    const video_url = await resolveReel(req.body?.url);
    res.json({ ok: true, video_url });
  } catch (e) {
    res.status(422).json({ ok: false, error: e.message });
  }
});

// ---- Public APIs ----
app.post('/api/visit', (req, res) => {
  db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'visits'").run();
  const row = db.prepare("SELECT value FROM meta WHERE key = 'visits'").get();
  res.json({ visits: row.value });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post('/api/contact', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 40);
  const email = String(req.body?.email || '').trim().slice(0, 80);
  const message = String(req.body?.message || '').trim().slice(0, 1000);
  if (!name || !message) return res.status(400).json({ error: 'name and message required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'valid email required' });
  const info = db.prepare('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)').run(name, email, message);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Site running on http://localhost:${PORT}`));
