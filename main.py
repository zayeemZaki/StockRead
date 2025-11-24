#!/usr/bin/env python3
"""
Main entry point for Stock Read services.
FastAPI application with background services running in threads.
"""
import sys
import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
import uvicorn

from core.service_manager import start_all_services, stop_all_services
from api.health import router as health_router
from api.routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for FastAPI.
    Starts background services on startup and stops them on shutdown.
    """
    # Startup
    start_all_services()
    
    yield  # Application runs here
    
    # Shutdown
    stop_all_services()


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Stockit Intelligence",
    description="AI-powered stock analysis and market intelligence service",
    version="1.0.0",
    lifespan=lifespan
)

# Register routers
app.include_router(health_router)
app.include_router(api_router)


@app.get("/")
async def root():
    """Root endpoint - welcome message."""
    return {
        "message": "Welcome to Stockit Intelligence",
        "service": "Stockit Intelligence",
        "status": "active"
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
