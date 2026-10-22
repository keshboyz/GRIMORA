
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.engine import URL, make_url


load_dotenv()


def get_database_url():
    # Render production database connection
    render_database_url = os.getenv("DATABASE_URL")

    if render_database_url:
        database_url = make_url(render_database_url)

        # Ensure SQLAlchemy uses psycopg2
        if database_url.drivername in ("postgres", "postgresql"):
            database_url = database_url.set(
                drivername="postgresql+psycopg2"
            )

        return database_url

    # Local development database connection
    return URL.create(
        drivername="postgresql+psycopg2",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME"),
    )


DATABASE_URL = get_database_url()


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def test_database_connection():
    try:
        with engine.connect() as connection:
            database_name = connection.execute(
                text("SELECT current_database();")
            ).scalar()

            return {
                "connected": True,
                "database": database_name,
            }

    except Exception:
        return {
            "connected": False,
            "error": "Database connection failed.",
        }
