"""Trade.gov Consolidated Screening List (CSL) search — raw HTTP client."""

from typing import Any

import httpx

DEFAULT_CSL_SEARCH_URL = "https://data.trade.gov/consolidated_screening_list/v1/search"


async def search_consolidated_screening_list(
    client: httpx.AsyncClient,
    *,
    subscription_key: str,
    name: str,
    search_url: str = DEFAULT_CSL_SEARCH_URL,
    size: int = 50,
    fuzzy_name: bool = True,
) -> list[dict[str, Any]]:
    """
    Call the public CSL search endpoint; return the raw `results` array (may be empty).

    Authenticate with the `subscription-key` header (ITA Developer Portal primary key).
    """
    headers = {"subscription-key": subscription_key}
    params = {
        "name": name.strip(),
        "size": str(min(max(size, 1), 100)),
        "fuzzy_name": "true" if fuzzy_name else "false",
    }
    resp = await client.get(search_url, params=params, headers=headers, timeout=45.0)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict) and "results" in data:
        raw = data["results"]
        return raw if isinstance(raw, list) else []
    return []
