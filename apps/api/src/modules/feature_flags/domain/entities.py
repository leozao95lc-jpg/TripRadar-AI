from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class FeatureFlag:
    """Flag booleana com rollout gradual opcional. `rollout_percentage` só importa
    quando `enabled=True`: 100 = todo mundo, 0 = ninguém (equivalente a desabilitada,
    mas mantém o histórico/registro do flag), valores intermediários = rollout
    determinístico por usuário (mesmo usuário sempre cai do mesmo lado, sem
    "piscar" entre requisições — ver `IsFeatureEnabled`)."""

    key: str
    enabled: bool = False
    rollout_percentage: int = 100
    description: str = ""
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
