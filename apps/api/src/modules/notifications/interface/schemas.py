from pydantic import BaseModel, Field, model_validator


class NotificationPreferenceRequest(BaseModel):
    channel: str = Field(pattern="^(email|whatsapp|telegram)$")
    destination: str = Field(
        default="",
        max_length=255,
        description="Ignorado para channel=email (usa sempre o e-mail da conta).",
    )
    enabled: bool = True

    @model_validator(mode="after")
    def _require_destination_for_non_email_channels(self) -> "NotificationPreferenceRequest":
        if self.channel != "email" and not self.destination.strip():
            raise ValueError("destination é obrigatório para canais diferentes de email")
        return self


class NotificationPreferenceResponse(BaseModel):
    channel: str
    destination: str
    enabled: bool
    pending_verification: bool


class VerifyChannelRequest(BaseModel):
    channel: str = Field(pattern="^(whatsapp|telegram)$")
    code: str = Field(min_length=6, max_length=6)
