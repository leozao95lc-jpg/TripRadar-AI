from pydantic import BaseModel, Field


class NotificationPreferenceRequest(BaseModel):
    channel: str = Field(pattern="^(email|whatsapp|telegram)$")
    destination: str
    enabled: bool = True


class NotificationPreferenceResponse(BaseModel):
    channel: str
    destination: str
    enabled: bool
