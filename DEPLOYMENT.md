# Deployment Guide

This repo has two deployable pieces:

- `backend/` — Flask API → **Render**
- `frontend/` — Static HTML/CSS/JS → **Netlify**

Both have free tiers and connect to GitHub in a couple of clicks.

---

## 1. Push to GitHub

In Lovable: **Plus (+) → GitHub → Connect project → Create Repository**.

---

## 2. Deploy Backend to Render

1. Go to <https://dashboard.render.com> → **New + → Web Service**.
2. Connect your GitHub repo.
3. Render auto-detects `render.yaml` and pre-fills everything:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Runtime:** Python 3.10.13
4. Plan: **Free**. Click **Create Web Service**.
5. Wait ~3–5 min for the first build. Copy the public URL — it looks like
   `https://deepshield-backend.onrender.com`.

**Environment variables:** none required. `PORT` is injected by Render and
already read in `backend/app.py`. CORS is open (`*`) so any frontend origin
works.

> ⚠️ Free Render web services sleep after 15 min idle (≈30 s cold start on
> the next request). That's normal.

---

## 3. Deploy Frontend to Netlify

1. Go to <https://app.netlify.com> → **Add new site → Import an existing project**.
2. Pick the same GitHub repo.
3. Netlify reads `netlify.toml`. Confirm:
   - **Publish directory:** `frontend`
   - **Build command:** (auto, from `netlify.toml`)
4. Before the first deploy, go to **Site settings → Environment variables**
   and add:
   - **Key:** `API_BASE_URL`
   - **Value:** your Render URL from step 2 (no trailing slash),
     e.g. `https://deepshield-backend.onrender.com`
5. Trigger a deploy. The build writes `frontend/config.js` containing
   `window.__API_BASE_URL__ = "<your render url>"`, and `script.js` reads it.

To change the backend URL later, just edit the env var in Netlify and redeploy
— no code change needed.

---

## Local dev

```bash
# backend
cd backend
pip install -r requirements.txt
python app.py            # http://localhost:5000

# frontend
cd frontend
# edit config.js to point at http://localhost:5000 if testing locally
python -m http.server 8000
```
