#!/usr/bin/env python3
"""
Main entry point for Stock Read services.
FastAPI application with background services running in threads.
"""

import sys
import os
import threading
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
import uvicorn

from services.market_maker_service import MarketMakerService
from services.response_bot_service import ResponseBotService
from services.global_analyst import GlobalAnalyst
from services.news_service import NewsService
from services.maintenance_service import MaintenanceService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global references to services and threads
background_threads = []
stop_event = threading.Event()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for FastAPI.
    Starts background services on startup and stops them on shutdown.
    """
    # Startup: Start all background services
    logger.info("🚀 Starting Stock Read services...")
    
    # Market Maker Service
    try:
        market_maker = MarketMakerService()
        market_maker_thread = threading.Thread(
            target=market_maker.run,
            name="MarketMaker",
            daemon=True
        )
        market_maker_thread.start()
        background_threads.append(('MarketMaker', market_maker_thread))
        logger.info("✅ Market Maker service started")
    except Exception as e:
        logger.error(f"❌ Market Maker service error: {e}")
    
    # Response Bot Service
    try:
        response_bot = ResponseBotService()
        response_bot_thread = threading.Thread(
            target=response_bot.run,
            name="ResponseBot",
            daemon=True
        )
        response_bot_thread.start()
        background_threads.append(('ResponseBot', response_bot_thread))
        logger.info("✅ Response Bot service started")
    except Exception as e:
        logger.error(f"❌ Response Bot service error: {e}")
    
    # Global Analyst Service
    try:
        analyst = GlobalAnalyst()
        global_analyst_thread = threading.Thread(
            target=analyst.run_continuous,
            name="GlobalAnalyst",
            daemon=True
        )
        global_analyst_thread.start()
        background_threads.append(('GlobalAnalyst', global_analyst_thread))
        logger.info("✅ Global Analyst service started")
    except Exception as e:
        logger.error(f"❌ Global Analyst service error: {e}")
    
    # News Service
    try:
        news_service = NewsService()
        news_thread = threading.Thread(
            target=run_news_service,
            args=(news_service,),
            name="NewsService",
            daemon=True
        )
        news_thread.start()
        background_threads.append(('NewsService', news_thread))
        logger.info("✅ News service started")
    except Exception as e:
        logger.error(f"❌ News service error: {e}")
    
    # Maintenance Service
    try:
        maintenance_service = MaintenanceService()
        maintenance_thread = threading.Thread(
            target=maintenance_service.run_maintenance_loop,
            name="MaintenanceService",
            daemon=True
        )
        maintenance_thread.start()
        background_threads.append(('MaintenanceService', maintenance_thread))
        logger.info("✅ Maintenance service started")
    except Exception as e:
        logger.error(f"❌ Maintenance service error: {e}")
    
    logger.info(f"✅ All services started ({len(background_threads)} services running)")
    
    yield  # Application runs here
    
    # Shutdown: Stop all background services gracefully
    logger.info("🛑 Shutting down services...")
    stop_event.set()
    
    # Wait for threads to finish (with timeout)
    for service_name, thread in background_threads:
        if thread.is_alive():
            logger.info(f"Waiting for {service_name} to stop...")
            thread.join(timeout=5)
            if thread.is_alive():
                logger.warning(f"{service_name} did not stop gracefully")
            else:
                logger.info(f"✅ {service_name} stopped")
    
    logger.info("👋 All services stopped")


def run_news_service(news_service: NewsService):
    """Run news update service in a loop."""
    try:
        while not stop_event.is_set():
            news_service.update_market_news()
            # Sleep in 1-second intervals to check stop_event frequently
            for _ in range(3600):  # 3600 seconds = 1 hour
                if stop_event.is_set():
                    break
                time.sleep(1)
    except Exception as e:
        logger.error(f"News service error: {e}")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Stockit Intelligence",
    description="AI-powered stock analysis and market intelligence service",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/")
async def root():
    """Root endpoint - welcome message."""
    return {
        "message": "Welcome to Stockit Intelligence",
        "service": "Stockit Intelligence",
        "status": "active"
    }


@app.get("/healthz")
async def healthz():
    """Health check endpoint for Render/Kubernetes."""
    return {"status": "ok", "healthy": True}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
