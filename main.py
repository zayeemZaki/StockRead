#!/usr/bin/env python3
"""
Main entry point for Stock Read services.
Starts all background services in separate threads.
"""

import sys
import os
import threading
import signal
import logging
from pathlib import Path

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from market_maker import run_market_maker
from response_bot import process_user_posts
from services.global_analyst import GlobalAnalyst
from fetch_news import update_market_news
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

services = []
stop_event = threading.Event()

def run_market_maker_service():
    """Run market maker service."""
    try:
        run_market_maker()
    except Exception as e:
        logger.error(f"Market maker service error: {e}")

def run_response_bot_service():
    """Run response bot service."""
    try:
        process_user_posts()
    except Exception as e:
        logger.error(f"Response bot service error: {e}")

def run_global_analyst_service():
    """Run global analyst service."""
    try:
        analyst = GlobalAnalyst()
        analyst.run_continuous()
    except Exception as e:
        logger.error(f"Global analyst service error: {e}")

def run_news_service():
    """Run news update service."""
    try:
        while not stop_event.is_set():
            update_market_news()
            time.sleep(3600)
    except Exception as e:
        logger.error(f"News service error: {e}")

def signal_handler(sig, frame):
    """Handle shutdown signals."""
    logger.info("Shutting down services...")
    stop_event.set()
    for service in services:
        if service.is_alive():
            service.join(timeout=5)
    sys.exit(0)

def main():
    """Start all services."""
    logger.info("Starting Stock Read services...")
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    market_maker_thread = threading.Thread(target=run_market_maker_service, daemon=True)
    response_bot_thread = threading.Thread(target=run_response_bot_service, daemon=True)
    global_analyst_thread = threading.Thread(target=run_global_analyst_service, daemon=True)
    news_thread = threading.Thread(target=run_news_service, daemon=True)
    
    services.extend([
        market_maker_thread,
        response_bot_thread,
        global_analyst_thread,
        news_thread
    ])
    
    for service in services:
        service.start()
        logger.info(f"Started {service.name}")
    
    logger.info("All services started. Press Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
            for service in services:
                if not service.is_alive():
                    logger.warning(f"Service {service.name} has stopped")
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    main()

