from datetime import datetime

from pydantic import BaseModel, Field


class FeatureFlagResponse(BaseModel):
    key: str
    enabled: bool
    rollout_percentage: int
    description: str
    updated_at: datetime


class SetFeatureFlagRequest(BaseModel):
    enabled: bool
    rollout_percentage: int = Field(default=100, ge=0, le=100)
    description: str | None = None
