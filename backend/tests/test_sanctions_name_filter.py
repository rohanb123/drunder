"""Sanctions CSL post-filter: drop weak fuzzy hits."""

from app.services.sanctions_name_filter import (
    filter_csl_hits_by_similarity,
    hit_name_similarity,
)


def test_burger_king_vs_budker_below_threshold():
    hit = {
        "name": "BUDKER INSTITUTE OF NUCLEAR PHYSICS OF SIBERIAN BRANCH RUSSIAN ACADEMY OF SCIENCES",
        "alt_names": ["BINP SB RAS"],
    }
    assert hit_name_similarity("burger king", hit) < 0.78
    kept, _ = filter_csl_hits_by_similarity([hit], "burger king", min_similarity=0.78)
    assert kept == []


def test_jamba_juice_vs_baum_alias_below_threshold():
    hit = {
        "name": "BAUM PVT LTD",
        "alt_names": ["JAM ROLLED ICE CREAM", "CAFE SHAZE"],
    }
    assert hit_name_similarity("jamba juice", hit) < 0.78
    kept, _ = filter_csl_hits_by_similarity([hit], "jamba juice", min_similarity=0.78)
    assert kept == []


def test_exact_alias_always_kept():
    hit = {"name": "ACME CORP", "alt_names": ["Acme Corp Subsidiary"]}
    kept, scores = filter_csl_hits_by_similarity([hit], "acme corp", min_similarity=0.99)
    assert len(kept) == 1
    assert scores[0] == 1.0


def test_strong_fuzzy_kept():
    hit = {"name": "MICROSOFT CORPORATION", "alt_names": []}
    kept, _ = filter_csl_hits_by_similarity([hit], "microsft corporation", min_similarity=0.72)
    assert len(kept) == 1
