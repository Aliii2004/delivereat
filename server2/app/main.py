import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.services.redis_subscriber import redis_subscriber
from app.routers import internal, graphql_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Server 2 starting up...")
    
    # Initialize database
    await init_db()
    logger.info("✓ Database initialized")
    
    # Connect to Redis
    await redis_subscriber.connect(settings.REDIS_URL)
    
    # Start Redis subscriber
    redis_subscriber.start()
    
    yield
    
    # Shutdown
    logger.info("🛑 Server 2 shutting down...")
    await redis_subscriber.disconnect()
    logger.info("✓ Shutdown complete")

app = FastAPI(
    title="DeliverEat Analytics API",
    description="GraphQL Analytics & WebHooks for DeliverEat",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(internal.router, prefix="/api")
app.include_router(graphql_router.router, prefix="/graphql")

# Health check
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "server2",
        "environment": settings.ENV
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )