from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import settings


Base = declarative_base()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
    expire_on_commit=False,
)


def get_db():
    database = SessionLocal()
    try:
        yield database
        database.commit()
    except Exception:
        database.rollback()
        raise
    finally:
        database.close()


@contextmanager
def db_session():
    database = SessionLocal()
    try:
        yield database
        database.commit()
    except Exception:
        database.rollback()
        raise
    finally:
        database.close()


def check_database_connection() -> tuple[bool, str | None]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, None
    except SQLAlchemyError as exc:
        return False, str(exc)


def initialize_database() -> tuple[bool, str | None]:
    ok, error = check_database_connection()
    if not ok:
        return False, error
    Base.metadata.create_all(bind=engine)
    return True, None
