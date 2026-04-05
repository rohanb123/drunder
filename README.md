# ClearPath

ClearPath is a **compliance and supply chain intelligence** stack: turn a **product description** and **supplier list** (each with **name** and **role**) into a **unified JSON report** and **PDF**, with optional **inferred supply chain stages**, **live refinement** of stage mappings, and an optional **cloud browser agent** for dashboard workflows.

Monorepo: **FastAPI** backend + **Next.js 14** frontend.

---

## Features

### Unified compliance report (`POST /report`)

- **Sanctions screening** — [Trade.gov Consolidated Screening List](https://developer.trade.gov/api-details#api=consolidated-screening-list&operation=search) via `httpx`; exact name/alias match → **flagged**; possible matches without exact hit → **review**; optional **Gemini** assist when the list returns no usable rows (requires `GOOGLE_API_KEY` + `TRADE_GOV_API_KEY` for full path).
- **US regulatory synthesis** — Local **ChromaDB** RAG over ingested FDA/CPSC/FTC PDFs; **sentence-transformers** embeddings; **Gemini** summarizes with citations (chunk metadata → PDF links via `GET /regulatory/pdfs`).
- **Supply chain mapping** — **Gemini** infers ordered stages and maps each screened supplier to a stage with **ok** / **broken** / **missing** status (requires `GOOGLE_API_KEY`). Runs after screening so sanctions status is authoritative.

### PDF export (`POST /report/pdf`)

- Same inputs as `/report`; **ReportLab** builds **ClearPath-report.pdf** (screening summary, regulatory section, supply chain). Optional `what_if` payload can append a scenario appendix (API shape retained for integrations).

### Supply chain refine (`POST /report/supply-chain/update-stage`)

- After initial mapping, users can **edit suppliers on one stage** in the UI.
- Backend **re-screens** those rows through the same sanctions path, then (if `GOOGLE_API_KEY` is set) **one Gemini call** remaps suppliers across the **existing** timeline (**stage names and count stay fixed**). Without Gemini, the merged snapshot after screening is returned.

### Web app (Next.js)

- **Compliance Report** — Product + suppliers (CSV upload supported), generate report, view results, download PDF.
- **Supply Chain** — Unlocks after a report exists; interactive **timeline**, stage detail, **refine mapped suppliers**, **Take action** flows where configured.
- **Dashboard Agent** — Streams **Browser Use Cloud** sessions over SSE (`POST /browser-agent/run`); requires `BROWSER_USE_API_KEY`.

### Sentinel API (`/sentinel/...`)

- **Chroma-backed supply profiles** (CRUD suppliers, HTS, categories) and **Gemini simulation** endpoints (sync + stream). Used by integrations or tooling; not all flows are exposed in the main Sentinel tabs.

### Optional CLI (`browser/`)

- Standalone script using **Browser Use SDK** + `.env` — see `browser/.env.example` and `browser/main.py`.

---

## Repository layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI app (`app.main`), orchestration, sanctions, regulatory RAG, supply chain, PDF, routers |
| `backend/scripts/ingest_regulatory.py` | One-time / periodic ingest: PDFs → chunks → embeddings → Chroma |
| `backend/data/regulatory_pdfs/{fda,cpsc,ftc}/` | Place agency PDFs before ingest |
| `frontend/` | Next.js 14 UI (`app/`, `components/sentinel/`, …) |
| `browser/` | Optional Python CLI for Browser Use tasks |
| `backend/Procfile` | Process entry for PaaS (e.g. Railway) |

---

## Prerequisites

- **Python** 3.11+ recommended (3.12/3.14 often work; match your team standard).
- **Node.js** 18+ for the frontend.
- **API keys** (as needed):
  - `TRADE_GOV_API_KEY` — sanctions list search
  - `GOOGLE_API_KEY` — Gemini (sanctions fallback, regulatory, supply chain inference & refine)
  - `BROWSER_USE_API_KEY` — dashboard browser agent only
- **Regulatory RAG** — run ingest after adding PDFs; Chroma DB path configurable (see `.env.example`).

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: at minimum TRADE_GOV_API_KEY and GOOGLE_API_KEY for full reports + supply chain
```

Ingest regulatory PDFs (after adding files under `data/regulatory_pdfs/`):

```bash
python -m scripts.ingest_regulatory
```

Run API:

```bash
uvicorn app.main:app --reload --port 8000
```

- OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health: `GET /health`

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Optional: `browser/` CLI

```bash
cd browser
pip install -r requirements.txt   # or use backend .venv and pip install -r ../browser/requirements.txt
cp .env.example .env
# Set BROWSER_USE_API_KEY (and GEMINI_API_KEY if your script needs it)
python main.py --help
```

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. Important keys:

| Variable | Role |
|----------|------|
| `TRADE_GOV_API_KEY` | CSL search (sanctions) |
| `GOOGLE_API_KEY` | Gemini (regulatory, supply chain, optional sanctions assist) |
| `BROWSER_USE_API_KEY` | `/browser-agent/run` and `browser/` CLI |
| `CORS_ORIGINS` | Comma-separated allowed origins (e.g. `http://localhost:3000`) |
| `REGULATORY_*` | Chroma path, PDF root, collection name (defaults in `.env.example`) |
| `SENTINEL_CHROMA_PATH` | Sentinel profile storage (relative to `backend/`) |

Frontend: `NEXT_PUBLIC_API_URL` — base URL of the API (no trailing slash).

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `POST` | `/report` | Unified JSON report |
| `POST` | `/report/pdf` | PDF download |
| `POST` | `/report/supply-chain/update-stage` | Refine one stage (screen + optional Gemini, fixed timeline) |
| `GET` | `/regulatory/pdfs?path=…` | Inline PDF for citation links |
| `POST` | `/browser-agent/run` | SSE stream for Browser Use agent |
| `GET`/`POST` | `/sentinel/...` | Profiles + simulation (see OpenAPI) |

---

## Testing

```bash
cd backend
source .venv/activate
pytest
```

---

## Deployment

- **Backend (e.g. Railway)** — Set project root to `backend`, use `Procfile`, configure env vars from `.env.example`, ensure persistent volume or object storage if you rely on Chroma paths.
- **Frontend (e.g. Vercel)** — Root directory `frontend`; set `NEXT_PUBLIC_API_URL` to the public API URL; ensure `CORS_ORIGINS` on the API includes the deployed frontend origin.

---

## License

See [LICENSE](./LICENSE) in the repository root.
