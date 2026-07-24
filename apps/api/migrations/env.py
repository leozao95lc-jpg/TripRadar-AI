from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Importar os models de cada módulo registra as tabelas em Base.metadata.
# Ao adicionar um novo módulo com tabelas próprias, basta importar seu `models`
# aqui — nenhuma outra mudança de configuração é necessária.
from modules.alerts.infrastructure import models as alerts_models  # noqa: F401
from modules.identity.infrastructure import models as identity_models  # noqa: F401
from modules.notifications.infrastructure import models as notifications_models  # noqa: F401
from modules.price_monitoring.infrastructure import models as price_monitoring_models  # noqa: F401
from shared.config import settings
from shared.database import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
