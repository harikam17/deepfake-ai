# DeepShield AI

Premium deepfake detection web app with a Flask backend and a vanilla JS + Chart.js dashboard frontend.

```
.
├── backend/         # Flask API (Render/Railway ready)
│   ├── app.py
│   ├── utils.py
│   ├── requirements.txt
│   ├── history.json
│   └── Procfile
└── frontend/        # Static site (Vercel/Netlify ready)
    ├── index.html
    ├── style.css
    └── script.js
```

## Run locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# → http://127.0.0.1:5000
```

### Frontend

Just open `frontend/index.html` in a browser, or serve it:

```bash
cd frontend
python -m http.server 5500
# → http://127.0.0.1:5500
```

The frontend talks to `http://127.0.0.1:5000` by default. Edit `API_BASE_URL` in `frontend/script.js` to point to your deployed backend.

## API

| Method | Path       | Body               | Response                                           |
| ------ | ---------- | ------------------ | -------------------------------------------------- |
| GET    | `/`        | —                  | `{ status: "ok" }`                                 |
| POST   | `/predict` | `multipart: image` | `{ result, confidence, timestamp }`                |
| GET    | `/history` | —                  | `[{ result, confidence, timestamp, filename }]`    |
| GET    | `/stats`   | —                  | `{ total, real, fake, fake_rate, avg_confidence }` |

`result` is `"REAL"` or `"FAKE"`; `confidence` is a percentage (55–99.5).

The model is a deterministic mock based on image statistics — replace `analyze_image()` in `backend/utils.py` with a real model when ready.

## Deployment

### Backend on Render

1. Push the repo to GitHub.
2. On Render: **New → Web Service** → pick the repo.
3. Settings:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
4. Deploy. Copy the URL (e.g. `https://deepshield-api.onrender.com`).

### Backend on Railway

- New project → deploy from repo → set root to `backend`.
- Railway autodetects Python; start command: `gunicorn app:app`.

### Frontend on Vercel

1. **New Project** → import the repo.
2. **Root directory:** `frontend`.
3. **Framework preset:** Other (it's static).
4. Before deploying, set `API_BASE_URL` in `frontend/script.js` to your Render URL.
5. Deploy.

### Frontend on Netlify

- Drag-and-drop the `frontend/` folder in the Netlify dashboard, or connect the repo with publish directory `frontend`.

## Notes

- History persists in `backend/history.json` and mirrors to `localStorage` as a fallback if the backend is unreachable.
- CORS is open (`*`) for easy deployment; lock it down in `app.py` for production.
