"""Gemini Flash: synthesize RegulatorySection from retrieved chunks only."""

from __future__ import annotations

import json
import re
from typing import Any

from app.schemas.report import RegulatoryBullet, RegulatoryCitation, RegulatorySection
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


_STOP = frozenset(
    "that this with from must have been were will your each other only such than when what "
    "which while about after also some their there these those they them then than into "
    "over more most much many make like just even well very".split()
)


def _content_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()) if w not in _STOP}


def _bullet_grounded_in_excerpts(bullet: str, chunks: list[RetrievedChunk], *, min_overlap: int = 4) -> bool:
    """Drop model boilerplate: keep bullets that share substantive terms with at least one excerpt."""
    b = _content_words(bullet)
    if len(b) < 3:
        return False
    for c in chunks:
        if len(b & _content_words(c.text)) >= min_overlap:
            return True
    return False


def _filter_grounded_bullets(items: list[RegulatoryBullet], chunks: list[RetrievedChunk]) -> list[RegulatoryBullet]:
    return [b for b in items if _bullet_grounded_in_excerpts(b.text, chunks)]


_EXCERPT_ATTRIBUTION = re.compile(r"\s*\(Excerpt\s*\d+\s*,\s*[^)]+\)\s*$", re.IGNORECASE)
_EXCERPT_NUM = re.compile(r"\(\s*Excerpt\s+(\d+)\s*,", re.IGNORECASE)


def _strip_excerpt_attribution(s: str) -> str:
    return _EXCERPT_ATTRIBUTION.sub("", s).strip()


def _chunk_ids_from_excerpt_tag(text: str, chunks: list[RetrievedChunk]) -> list[str]:
    """Map legacy `(Excerpt N, doc_id)` suffix to chunk id when model omits citation_chunk_ids."""
    m = _EXCERPT_NUM.search(text)
    if not m:
        return []
    try:
        idx = int(m.group(1))
    except ValueError:
        return []
    if 1 <= idx <= len(chunks):
        cid = chunks[idx - 1].id
        return [cid] if cid else []
    return []


def _truncate_concise_bullet(s: str, max_len: int = 160) -> str:
    s = s.strip()
    if len(s) <= max_len:
        return s
    cut = s[: max_len - 1].rsplit(" ", 1)[0].strip()
    return f"{cut}…" if cut else s[:max_len]


def _reader_facing_citation_title(c: RetrievedChunk) -> str:
    """Human-readable source line: agency, document name, page(s)—no internal chunk jargon."""
    md = c.metadata
    agency = (md.get("source_agency") or "GENERAL").strip()
    name = (
        (md.get("document_name") or md.get("title") or md.get("document_id") or "Guidance document").strip()
    )
    p0 = str(md.get("page_start") or "").strip()
    p1 = str(md.get("page_end") or "").strip()
    if p0 and p1 and p0 != p1:
        page_part = f", pp. {p0}–{p1}"
    elif p0:
        page_part = f", p. {p0}"
    else:
        page_part = ""
    return f"{agency} — {name}{page_part}"


def _chunks_by_id(chunks: list[RetrievedChunk]) -> dict[str, RetrievedChunk]:
    return {c.id: c for c in chunks}


def _apply_reader_citation_labels(
    citations: list[RegulatoryCitation],
    chunks: list[RetrievedChunk],
) -> list[RegulatoryCitation]:
    """Replace titles with agency + document + pages from metadata; keep CFR from model when set."""
    by_id = _chunks_by_id(chunks)
    out: list[RegulatoryCitation] = []
    for cit in citations:
        ch = by_id.get(cit.chunk_id or "") if cit.chunk_id else None
        if ch is None:
            out.append(cit)
            continue
        md = ch.metadata
        cfr_model = cit.cfr_citation
        cfr_meta = (md.get("cfr_citation") or "").strip() or None
        out.append(
            RegulatoryCitation(
                title=_reader_facing_citation_title(ch)[:500],
                source=(md.get("source_agency") or cit.source or "GENERAL")[:32],
                cfr_citation=cfr_model or cfr_meta,
                document_id=md.get("document_id") or cit.document_id,
                chunk_id=cit.chunk_id,
            )
        )
    return out


def citations_from_chunks(chunks: list[RetrievedChunk]) -> list[RegulatoryCitation]:
    """Metadata-only citations when LLM is unavailable."""
    out: list[RegulatoryCitation] = []
    for c in chunks:
        md = c.metadata
        cfr = (md.get("cfr_citation") or "").strip() or None
        out.append(
            RegulatoryCitation(
                title=_reader_facing_citation_title(c)[:500],
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
            summary="No regulatory guidance is available for this product yet. Add guidance documents to your library, then try again.",
            applicable_regulations=[],
            testing_requirements=[],
            estimated_compliance_cost_usd=None,
            penalty_exposure_note=None,
            citations=[],
        )

    from app.services.gemini_generate import generate_text

    body = format_chunks_for_prompt(chunks)
    n = len(chunks)
    prompt = f"""You are a U.S. product compliance analyst. Use **only** the excerpt text below.

Product:
{product_description.strip()}

Excerpts (1–{n}; internal chunk_id is for your JSON only—readers will not see it):
{body}

Rules:
1. **summary**: At most **3 short sentences**, plain English. Name the product type. Say what the excerpts actually cover (which agencies/topics). Do not over-claim FDA food rules unless excerpts are about food/contact.
2. **applicable_regulations**: Array of objects. Each object: **text** = one concrete point, **very concise** (aim ≤ 120 characters; no filler). **citation_chunk_ids** = array of exact **chunk_id** strings from the excerpts that support that point (at least one id per bullet when possible). Use [] if unsupported.
3. **testing_requirements**: Same object shape; only if excerpts explicitly mention testing/studies/data. Else [].
4. **penalty_exposure_note**: At most **one short sentence**, or null.
5. No meta-instructions in the output. No word "chunk" in user-facing strings.
6. **citations**: Include one object per excerpt you relied on (up to {n}). Use exact **chunk_id** from the excerpt header. **title** will be replaced server-side for readers—set **title** to the excerpt **document_id** for your own reference only. **source** = source_agency. **cfr_citation** = null or copied from excerpt metadata.

JSON only (no markdown):
{{
  "summary": "string",
  "applicable_regulations": [{{"text": "concise line", "citation_chunk_ids": ["exact-chunk-id"]}}],
  "testing_requirements": [{{"text": "concise line", "citation_chunk_ids": ["exact-chunk-id"]}}],
  "estimated_compliance_cost_usd": null,
  "penalty_exposure_note": "string or null",
  "citations": [
    {{
      "title": "document_id",
      "source": "FDA or CPSC or FTC or GENERAL",
      "cfr_citation": null,
      "document_id": "from excerpt",
      "chunk_id": "exact chunk_id from excerpt"
    }}
  ]
}}

Every chunk_id in citations must match an excerpt chunk_id above.
"""

    text = generate_text(
        api_key=api_key,
        model=model,
        prompt=prompt,
        temperature=0.1,
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
        return _fallback_section(product_description, chunks)
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return _fallback_section(product_description, chunks)

    if not isinstance(obj, dict):
        return _fallback_section(product_description, chunks)

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
    else:
        citations = _apply_reader_citation_labels(citations, chunks)

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
    if pen_s and len(pen_s) > 320:
        pen_s = pen_s[:317].rsplit(" ", 1)[0] + "…"

    valid_ids = {c.id for c in chunks}
    regs_raw = _filter_grounded_bullets(_parse_bullet_items(obj.get("applicable_regulations"), valid_ids), chunks)
    tests_raw = _filter_grounded_bullets(_parse_bullet_items(obj.get("testing_requirements"), valid_ids), chunks)

    def _finalize_bullets(raw: list[RegulatoryBullet]) -> list[RegulatoryBullet]:
        out: list[RegulatoryBullet] = []
        for b in raw:
            ids = list(b.citation_chunk_ids)
            if not ids:
                ids = _chunk_ids_from_excerpt_tag(b.text, chunks)
            ids = [x for x in ids if x in valid_ids]
            out.append(
                RegulatoryBullet(
                    text=_truncate_concise_bullet(_strip_excerpt_attribution(b.text)),
                    citation_chunk_ids=ids,
                )
            )
        return out

    regs = _finalize_bullets(regs_raw)
    tests = _finalize_bullets(tests_raw)

    return RegulatorySection(
        summary=str(obj.get("summary") or "See applicable regulations and citations below.")[:4000],
        applicable_regulations=regs,
        testing_requirements=tests,
        estimated_compliance_cost_usd=cost_f,
        penalty_exposure_note=pen_s,
        citations=citations,
    )


def _nullable_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _parse_bullet_items(v: Any, valid_chunk_ids: set[str]) -> list[RegulatoryBullet]:
    """Accept legacy string list or list of {{text, citation_chunk_ids}} objects."""
    if not isinstance(v, list):
        return []
    out: list[RegulatoryBullet] = []
    for item in v:
        if isinstance(item, str):
            t = item.strip()
            if t:
                out.append(RegulatoryBullet(text=t, citation_chunk_ids=[]))
            continue
        if not isinstance(item, dict):
            continue
        t = str(item.get("text") or item.get("bullet") or "").strip()
        if not t:
            continue
        raw_ids = item.get("citation_chunk_ids") or item.get("chunk_ids") or []
        ids: list[str] = []
        if isinstance(raw_ids, list):
            for x in raw_ids:
                cid = str(x).strip()
                if cid and cid in valid_chunk_ids:
                    ids.append(cid)
        out.append(RegulatoryBullet(text=t, citation_chunk_ids=ids))
    return out


def _fallback_section(product_description: str, chunks: list[RetrievedChunk]) -> RegulatorySection:
    return RegulatorySection(
        summary=(
            "We couldn't generate a written summary for this product. "
            "Use the source references below for the retrieved guidance."
        ),
        applicable_regulations=[],
        testing_requirements=[],
        estimated_compliance_cost_usd=None,
        penalty_exposure_note=None,
        citations=citations_from_chunks(chunks),
    )
