# Clearpath

**Clearpath** turns one product description and one supplier list into a **single compliance report**: supplier sanctions risk (Trade.gov Consolidated Screening List + fuzzy matching + optional Gemini disambiguation), **tariff exposure** (HTS chapter via Gemini + Trade.gov Tariff Rates API), and **US regulatory** synthesis (local ChromaDB RAG over FDA/CPSC/FTC PDFs + Gemini, citations from chunk metadata). **PDF export** is server-side via ReportLab.

This repo is a **monorepo scaffold**: runnable API stubs, parallel `/report` orchestration, Next.js 14 form + CSV (Papa Parse) — each supplier needs **name and role** (what they do) for screening and supply-chain mapping — and hooks for the full stack described in the product spec.

## Layout

| Path | Role |
|------|------|
| `backend/` | FastAPI — `POST /report`, `POST /report/pdf`, `GET /health` |
| `frontend/` | Next.js 14 — tabs: Compliance report, Supply chain (after report), What-If; form with name + role per supplier; PDF download |
| `backend/scripts/ingest_regulatory.py` | One-time ingest: PDFs → chunks → `all-MiniLM-L6-v2` → local ChromaDB |
| `backend/data/regulatory_pdfs/{fda,cpsc,ftc}/` | Drop agency PDFs here, then run ingest |

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Index guidance PDFs (after adding files under data/regulatory_pdfs/)
python -m scripts.ingest_regulatory
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

1. **Sanctions**: `httpx` → [Trade.gov CSL search](https://developer.trade.gov/api-details#api=consolidated-screening-list&operation=search); iterate `results` for **flagged** (exact normalized name/alias) or **review** (rows but no exact match); **Gemini** only when CSL returns **no** rows.
2. **Tariff**: Gemini → 4-digit HTS chapter; Tariff Rates API per supplier `country_of_origin`.
3. **Regulatory**: done — `python -m scripts.ingest_regulatory`; Chroma at `data/chroma/`; `POST /report` retrieves top-8 + Gemini synthesis.
4. **PDF**: expand `report_pdf.py` to mirror the three sections and tables.
