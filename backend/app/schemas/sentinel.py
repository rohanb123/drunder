"""API models for Supply Chain Sentinel (profiles + what-if simulation)."""

from __future__ import annotations

from typing import Any

from pydantic import AliasChoices, BaseModel, Field


class SupplierRow(BaseModel):
    id: str
    name: str
    country: str


class HtsRow(BaseModel):
    code: str
    description: str | None = None


class CategoryRow(BaseModel):
    name: str


class SupplyProfile(BaseModel):
    id: str
    name: str
    updatedAt: int = Field(..., description="Unix ms")
    suppliers: list[SupplierRow] = Field(default_factory=list)
    htsCodes: list[HtsRow] = Field(default_factory=list)
    categories: list[CategoryRow] = Field(default_factory=list)


class ProfileSummary(BaseModel):
    id: str
    name: str
    updatedAt: int


class CreateProfileBody(BaseModel):
    name: str = Field(..., min_length=1)


class AddSupplierBody(BaseModel):
    name: str = Field(..., min_length=1)
    country: str = Field(..., min_length=1)


class AddHtsBody(BaseModel):
    code: str = Field(..., min_length=1)
    description: str | None = None


class AddCategoryBody(BaseModel):
    name: str = Field(..., min_length=1)


class ProfileContextBody(BaseModel):
    profileName: str
    suppliers: list[dict[str, Any]]
    htsCodes: list[dict[str, Any]]
    categories: list[dict[str, Any]]


class SimulateSyncBody(BaseModel):
    """Either send `profile` (inline baseline) or `profileId` (Chroma-stored profile)."""

    profile_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("profileId", "profile_id"),
    )
    event: str = Field(..., min_length=1)
    profile: ProfileContextBody | None = None


class SimulateStreamBody(BaseModel):
    event: str = Field(..., min_length=1)
    profile: ProfileContextBody
