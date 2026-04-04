from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    trade_gov_api_key: str = ""
    # Full URL for CSL search (ITA Data Services; default is production).
    trade_gov_csl_search_url: str = "https://data.trade.gov/consolidated_screening_list/v1/search"
    google_api_key: str = ""
    # Use a model your AI Studio project has quota for (2.0-flash often shows limit:0 on free tier).
    gemini_sanctions_model: str = "gemini-2.5-flash-lite"
    gemini_regulatory_model: str = "gemini-2.5-flash-lite"
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
