"""Entrada do worker: `python -m app.worker`."""
import logging

from redis import Redis
from rq import Queue, Worker

from . import jobs, storage
from .config import get_settings


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    log = logging.getLogger("clipstudio.worker")
    conn = Redis.from_url(get_settings().redis_url)
    log.info("Temporários removidos: %d", storage.cleanup_tmp())
    log.info("Jobs interrompidos tratados: %d", jobs.recover_interrupted())
    Worker([Queue(jobs.QUEUE, connection=conn)], connection=conn).work(with_scheduler=True)


if __name__ == "__main__":
    main()
