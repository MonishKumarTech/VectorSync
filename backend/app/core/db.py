import os
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not configured in .env")

# 10-Year resilient connection pool (min 2, max 10 connections)
pool = ConnectionPool(
    conninfo=DATABASE_URL,
    min_size=2,
    max_size=10,
    open=True,
    kwargs={"autocommit": True}
)

def get_db():
    with pool.connection() as conn:
        yield conn