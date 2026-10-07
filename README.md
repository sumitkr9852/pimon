# SUMIT — personal portfolio site

A dark, minimalist, interactive 3D portfolio: a 22,000-particle WebGL field that
morphs with scroll — sphere on the hero, Instagram icon on the IG contact
section, Gmail envelope on the Gmail section — with a lime theme shift, glass
cards, and a real Node + SQLite backend.

## What's inside

- `server.js` — Express + built-in Node SQLite. Public APIs: visit counter,
  contact form. Admin APIs (session-cookie auth): inbox, mark read, delete, stats.
  - Admin login: username `Sumit0001` / password `Sumit@0001` (footer corner → "Admin")
  - Login is rate-limited (10 attempts / 5 min per IP)
- `public/` — the site
  - `app.js` — Three.js scroll-morph engine, mouse interaction, contact form,
    admin dashboard UI. `?shot=N` renders N frames then freezes (for screenshots)
  - `projects.js` — **edit this file** to add/replace projects (title, desc, tags, live/code links)
  - `vendor/` — three.js, lenis (smooth scroll), Space Grotesk font — all local,
    no CDN dependency, fully open-source
- `render.yaml` — one-click Render blueprint (free tier)

## Run locally

```bash
cd flux-site
npm install
npm start
# open http://localhost:3000
```

## Put it live for free (Render)

1. Push this folder to a GitHub repo.
2. **render.com** → sign up (free) → **New +** → **Blueprint**, point at the repo.
3. Deploy → free `https://<name>.onrender.com` URL.

Free tier sleeps after ~15 min idle (first visit after sleep takes ~30s to wake).
