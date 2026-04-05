from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    browser_use_api_key: str = ""
    trade_gov_api_key: str = ""
    # Full URL for CSL search (ITA Data Services; default is production).
    trade_gov_csl_search_url: str = "https://data.trade.gov/consolidated_screening_list/v1/search"
    # Drop weak CSL fuzzy hits: keep exact matches always; else require similarity >= this (0–1).
    sanctions_name_similarity_threshold: float = 0.78
    google_api_key: str = ""
    # Cheapest GA Flash-class tier per Google: gemini-2.5-flash-lite (budget / high-volume).
    # Override with gemini-2.5-flash in .env for stronger reasoning at higher $/token.
    gemini_sanctions_model: str = "gemini-2.5-flash-lite"
    gemini_regulatory_model: str = "gemini-2.5-flash-lite"
    # Sentinel what-if simulation (markdown + JSON); stronger model recommended.
    gemini_simulation_model: str = "gemini-2.5-flash"
    # Chroma persistence for supply-chain profiles (separate from regulatory RAG collection).
    sentinel_chroma_path: str = "sentinel_chroma"
    # Regulatory RAG (paths relative to backend/ unless absolute)
    regulatory_chroma_path: str = "chroma_db"
    regulatory_pdfs_path: str = "data/regulatory_pdfs"
    regulatory_collection_name: str = "clearpath_regulatory"
    regulatory_embedding_model: str = "all-MiniLM-L6-v2"
    # Comma-separated origins, e.g. http://localhost:3000 for Next.js dev
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
