"""Gemini Flash: synthesize RegulatorySection from retrieved chunks only."""

from __future__ import annotations

import json
from typing import Any

from app.schemas.report import RegulatoryCitation, RegulatorySection
from app.services.regulatory_chroma import RetrievedChunk


def format_chunks_for_prompt(chunks: list[RetrievedChunk]) -> str:
    blocks: list[str] = []
    for i, c in enumerate(chunks, 1):
        md = c.metadata
        blocks.append(
            "\n".join(
                [
                    f"### Excerpt {i}",
                    f"chunk_id: {c.id}",
                    f"source_agency: {md.get('source_agency', '')}",
                    f"document_id: {md.get('document_id', '')}",
                    f"title: {md.get('title', '')}",
                    f"cfr_citation: {md.get('cfr_citation', '')}",
                    f"page_start: {md.get('page_start', '')}",
                    f"source_file: {md.get('source_file', '')}",
                    "text:",
                    c.text,
                ]
            )
        )
    return "\n\n".join(blocks)


def citations_from_chunks(chunks: list[RetrievedChunk]) -> list[RegulatoryCitation]:
    """Metadata-only citations when LLM is unavailable."""
    out: list[RegulatoryCitation] = []
    for c in chunks:
        md = c.metadata
        cfr = (md.get("cfr_citation") or "").strip() or None
        out.append(
            RegulatoryCitation(
                title=(md.get("title") or md.get("document_id") or "Guidance excerpt")[:500],
                source=(md.get("source_agency") or "GENERAL")[:32],
                cfr_citation=cfr,
                document_id=md.get("document_id") or None,
                chunk_id=c.id,
            )
        )
    return out


def synthesize_regulatory_section(
    product_description: str,
    chunks: list[RetrievedChunk],
    *,
    api_key: str,
    model: str = "gemini-2.5-flash-lite",
) -> RegulatorySection:
    """
    Ask Gemini for structured compliance output. Citations in the JSON must reference
    chunk_id / document_id / cfr_citation values that appear in the excerpts below.
    """
    if not chunks:
        return RegulatorySection(
            summary="No regulatory guidance is indexed yet. Run the ingestion script after adding FDA, CPSC, and FTC PDFs.",
            applicable_regulations=[],
            testing_requirements=[],
            estimated_compliance_cost_usd=None,
            penalty_exposure_note=None,
            citations=[],
        )

    from app.services.gemini_generate import generate_text

    body = format_chunks_for_prompt(chunks)
    prompt = f"""You are a U.S. product compliance assistant for children's products and consumer goods.

Product description:
{product_description.strip()}

Below are excerpts from FDA, CPSC, and FTC guidance PDFs (with metadata). Use **only** this material for factual claims. Do not invent CFR citations: if you cite a regulation, the citation string must match a non-empty cfr_citation from the excerpts, or describe the requirement in plain language without a fake CFR.

Excerpts:
{body}

Respond with **JSON only** (no markdown), in exactly this shape:
{{
  "summary": "2-4 sentences tying the product to the excerpts",
  "applicable_regulations": ["short bullet strings"],
  "testing_requirements": ["short bullet strings"],
  "estimated_compliance_cost_usd": <number or null>,
  "penalty_exposure_note": "short note on enforcement risk based on excerpts, or null",
  "citations": [
    {{
      "title": "from excerpt title metadata",
      "source": "FDA or CPSC or FTC or GENERAL",
      "cfr_citation": "from excerpt or null",
      "document_id": "from excerpt",
      "chunk_id": "must match one of the excerpt chunk_id values exactly"
    }}
  ]
}}

Include at least 1 citation object per excerpt you relied on (up to {len(chunks)}). Every chunk_id in citations must appear in the excerpts above.
"""

    text = generate_text(
        api_key=api_key,
        model=model,
        prompt=prompt,
        temperature=0.2,
        max_output_tokens=2048,
    )
    return _parse_regulatory_json(text, chunks, product_description)


def _parse_regulatory_json(
    text: str,
    chunks: list[RetrievedChunk],
    product_description: str,
) -> RegulatorySection:
    start = text.find("{")
    if start < 0:
        return _fallback_section(product_description, chunks, "Model returned non-JSON output.")
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return _fallback_section(product_description, chunks, "Model returned invalid JSON.")

    if not isinstance(obj, dict):
        return _fallback_section(product_description, chunks, "Model JSON was not an object.")

    citations: list[RegulatoryCitation] = []
    for item in obj.get("citations") or []:
        if not isinstance(item, dict):
            continue
        citations.append(
            RegulatoryCitation(
                title=str(item.get("title") or "Citation")[:500],
                source=str(item.get("source") or "GENERAL")[:32],
                cfr_citation=_nullable_str(item.get("cfr_citation")),
                document_id=_nullable_str(item.get("document_id")),
                chunk_id=_nullable_str(item.get("chunk_id")),
            )
        )
    if not citations:
        citations = citations_from_chunks(chunks)

    cost = obj.get("estimated_compliance_cost_usd")
    cost_f: float | None = None
    if isinstance(cost, (int, float)):
        cost_f = float(cost)
    elif isinstance(cost, str):
        try:
            cost_f = float(cost.replace(",", ""))
        except ValueError:
            cost_f = None

    pen = obj.get("penalty_exposure_note")
    pen_s = str(pen).strip() if pen else None

    return RegulatorySection(
        summary=str(obj.get("summary") or "See applicable regulations and citations below.")[:4000],
        applicable_regulations=_str_list(obj.get("applicable_regulations")),
        testing_requirements=_str_list(obj.get("testing_requirements")),
        estimated_compliance_cost_usd=cost_f,
        penalty_exposure_note=pen_s,
        citations=citations,
    )


def _nullable_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _str_list(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    return [str(x).strip() for x in v if str(x).strip()]


def _fallback_section(product_description: str, chunks: list[RetrievedChunk], reason: str) -> RegulatorySection:
    return RegulatorySection(
        summary=f"{reason} Product context: {product_description[:300]}… Retrieved {len(chunks)} excerpt(s); see citations from source metadata.",
        applicable_regulations=[],
        testing_requirements=[],
        estimated_compliance_cost_usd=None,
        penalty_exposure_note=None,
        citations=citations_from_chunks(chunks),
    )
