import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.graphql.schema import graphql_router
from app.routers.internal import router as internal_router
from app.services.redis_subscriber import redis_subscriber

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ─── STARTUP ENV VALIDATION ────────────────────────────────

REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "JWT_SECRET"]

def validate_env() -> None:
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise RuntimeError(
            f"Required environment variables missing: {', '.join(missing)}"
        )


# ─── LIFESPAN ──────────────────────────────────────────────
# FastAPI startup/shutdown — @app.on_event deprecated

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    validate_env()
    logger.info("Starting Server 2 (FastAPI + GraphQL)...")

    await redis_subscriber.connect()
    redis_subscriber.start()
    logger.info("✓ Redis subscriber started — listening on 'order.events'")

    yield

    # SHUTDOWN
    logger.info("Shutting down Server 2...")
    await redis_subscriber.disconnect()
    logger.info("✓ Server 2 shutdown complete")


# ─── APP ───────────────────────────────────────────────────

app = FastAPI(
    title="DeliverEat Analytics API",
    description="Server 2 — FastAPI + Strawberry GraphQL + SQLAlchemy",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ──────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CLIENT_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─── ROUTES ────────────────────────────────────────────────

app.include_router(internal_router)
# app.include_router(graphql_router, prefix="")
app.include_router(graphql_router, prefix="/graphql")

# ─── HEALTH CHECK ──────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "server2",
    }
