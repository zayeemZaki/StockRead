"""Service management for background services."""
import threading
import logging
import time
from typing import Dict, Any, List, Tuple, Callable

from services.market_maker_service import MarketMakerService
from services.response_bot_service import ResponseBotService
from services.global_analyst import GlobalAnalyst
from services.news_service import NewsService
from services.maintenance_service import MaintenanceService

logger = logging.getLogger(__name__)

# Global references to services and threads
background_threads: List[Tuple[str, threading.Thread]] = []
service_instances: Dict[str, Any] = {}
service_status: Dict[str, Dict[str, Any]] = {}
stop_event = threading.Event()


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


def start_all_services():
    """Start all background services with improved error handling."""
    logger.info("🚀 Starting Stock Read services...")
    
    def start_service(service_name: str, service_class, target_method: Callable):
        """Start a background service with error handling."""
        try:
            logger.info(f"Initializing {service_name}...")
            service_instance = service_class()
            service_instances[service_name] = service_instance
            
            service_thread = threading.Thread(
                target=target_method,
                args=(service_instance,),
                name=service_name,
                daemon=True
            )
            service_thread.start()
            background_threads.append((service_name, service_thread))
            service_status[service_name] = {
                'initialized': True,
                'thread_alive': service_thread.is_alive(),
                'error': None
            }
            logger.info(f"✅ {service_name} started successfully")
            return True
        except Exception as e:
            service_status[service_name] = {
                'initialized': False,
                'thread_alive': False,
                'error': str(e)
            }
            logger.error(f"❌ {service_name} failed to start: {e}", exc_info=True)
            return False
    
    # Define service startup configuration
    services_config = [
        ('MarketMaker', MarketMakerService, lambda s: s.run()),
        ('ResponseBot', ResponseBotService, lambda s: s.run()),
        ('GlobalAnalyst', GlobalAnalyst, lambda s: s.run_continuous()),
        ('NewsService', NewsService, lambda s: run_news_service(s)),
        ('MaintenanceService', MaintenanceService, lambda s: s.run_maintenance_loop()),
    ]
    
    started_count = 0
    failed_count = 0
    
    for service_name, service_class, target_method in services_config:
        if start_service(service_name, service_class, target_method):
            started_count += 1
        else:
            failed_count += 1
    
    # Log comprehensive startup status
    logger.info("=" * 80)
    logger.info(f"Service Startup Summary:")
    logger.info(f"  ✅ Started: {started_count}/{len(services_config)}")
    logger.info(f"  ❌ Failed: {failed_count}/{len(services_config)}")
    logger.info("=" * 80)
    
    # Log detailed status for each service
    for service_name, status in service_status.items():
        status_str = "✅ RUNNING" if status['initialized'] and status['thread_alive'] else "❌ FAILED"
        logger.info(f"  {status_str} - {service_name}: {status}")
    
    if started_count > 0:
        logger.info("✅ Stock Read services started (some services may be running in degraded mode)")
    else:
        logger.warning("⚠️  No background services started - API endpoints will still work but background processing disabled")


def stop_all_services():
    """Stop all background services gracefully."""
    logger.info("🛑 Shutting down services...")
    stop_event.set()
    
    # Log thread status before shutdown
    logger.info("=" * 80)
    logger.info("Service Shutdown Status (before shutdown):")
    for service_name, thread in background_threads:
        logger.info(f"  {service_name}: {'ALIVE' if thread.is_alive() else 'STOPPED'}")
    logger.info("=" * 80)
    
    # Wait for threads to finish (with timeout)
    shutdown_timeout = 10  # Increased timeout for graceful shutdown
    for service_name, thread in background_threads:
        if thread.is_alive():
            logger.info(f"Waiting for {service_name} to stop (timeout: {shutdown_timeout}s)...")
            thread.join(timeout=shutdown_timeout)
            if thread.is_alive():
                logger.warning(f"⚠️  {service_name} did not stop gracefully within {shutdown_timeout}s")
                service_status[service_name]['shutdown_status'] = 'timeout'
            else:
                logger.info(f"✅ {service_name} stopped gracefully")
                service_status[service_name]['shutdown_status'] = 'success'
        else:
            logger.info(f"ℹ️  {service_name} was already stopped")
            service_status[service_name]['shutdown_status'] = 'already_stopped'
    
    # Log final shutdown status
    logger.info("=" * 80)
    logger.info("Final Service Shutdown Status:")
    for service_name, status in service_status.items():
        shutdown_status = status.get('shutdown_status', 'unknown')
        logger.info(f"  {service_name}: {shutdown_status}")
    logger.info("=" * 80)
    
    logger.info("👋 All services shutdown complete")


def get_service_instance(service_name: str):
    """Get a service instance by name."""
    return service_instances.get(service_name)


def get_service_status():
    """Get current status of all services."""
    # Get current thread status
    current_status = {}
    for service_name, thread in background_threads:
        current_status[service_name] = {
            **service_status.get(service_name, {}),
            "thread_alive": thread.is_alive(),
            "thread_daemon": thread.daemon,
            "thread_name": thread.name
        }
    
    # Add services that failed to initialize
    for service_name, status in service_status.items():
        if service_name not in current_status:
            current_status[service_name] = status
    
    return current_status

