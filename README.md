# Clearpath

**Clearpath** turns one product description and one supplier list into a **single compliance report**: supplier sanctions risk (Trade.gov Consolidated Screening List + fuzzy matching + optional Gemini disambiguation), **tariff exposure** (HTS chapter via Gemini + Trade.gov Tariff Rates API), and **US regulatory** synthesis (local ChromaDB RAG over FDA/CPSC/FTC PDFs + Gemini, citations from chunk metadata). **PDF export** is server-side via ReportLab.

This repo is a **monorepo scaffold**: runnable API stubs, parallel `/report` orchestration, Next.js 14 form + CSV (Papa Parse), and hooks for the full stack described in the product spec.

## Layout

| Path | Role |
|------|------|
| `backend/` | FastAPI — `POST /report`, `POST /report/pdf`, `GET /health` |
| `frontend/` | Next.js 14 — one form, results view, PDF download |
| `backend/scripts/ingest_regulatory.py` | Placeholder for PyMuPDF → chunk → embed → ChromaDB |
| `backend/data/regulatory_pdfs/` | Drop guidance PDFs here before ingest |

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# When you add the RAG pipeline: pip install -r requirements-rag.txt
cp .env.example .env
# Add TRADE_GOV_API_KEY and GOOGLE_API_KEY when implementing pipelines
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`.

## Deployment notes

- **Railway**: set the service root to `backend`, use the included `Procfile`, and configure env vars from `.env.example`.
- **Vercel**: import `frontend` as the app root; set `NEXT_PUBLIC_API_URL` to your Railway API URL.

## Next implementation steps

1. **Sanctions**: `httpx` → Consolidated Screening List API; `rapidfuzz` over returned entities; Gemini only for ambiguous matches.
2. **Tariff**: Gemini → 4-digit HTS chapter; Tariff Rates API per supplier `country_of_origin`.
3. **Regulatory**: finish `ingest_regulatory.py`; `PersistentClient` under `data/chroma/`; retrieval + Gemini with **metadata-only** citations.
4. **PDF**: expand `report_pdf.py` to mirror the three sections and tables.
