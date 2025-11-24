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
    """Start all background services with error handling and status tracking."""
    logger.info("Starting background services")
    
    def start_service(service_name: str, service_class, target_method: Callable):
        """Start a background service with error handling."""
        try:
            logger.info(f"Initializing service: {service_name}")
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
            logger.info(f"Service started: {service_name} (thread_alive={service_thread.is_alive()})")
            return True
        except Exception as e:
            service_status[service_name] = {
                'initialized': False,
                'thread_alive': False,
                'error': str(e)
            }
            logger.error(f"Service initialization failed: {service_name}", exc_info=True, extra={
                'service_name': service_name,
                'error': str(e)
            })
            return False
    
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
    
    logger.info(
        f"Service startup complete: started={started_count}, failed={failed_count}, total={len(services_config)}",
        extra={
            'started_count': started_count,
            'failed_count': failed_count,
            'total_services': len(services_config)
        }
    )
    
    for service_name, status in service_status.items():
        status_level = 'running' if status['initialized'] and status['thread_alive'] else 'failed'
        logger.debug(f"Service status: {service_name}={status_level}", extra={
            'service_name': service_name,
            'status': status
        })
    
    if started_count > 0:
        logger.info("Background services operational (degraded mode possible)")
    else:
        logger.warning("No background services started - API endpoints available but background processing disabled")


def stop_all_services():
    """Stop all background services gracefully."""
    logger.info("Initiating service shutdown")
    stop_event.set()
    
    shutdown_timeout = 10
    shutdown_results = {}
    
    for service_name, thread in background_threads:
        if thread.is_alive():
            logger.debug(f"Waiting for service shutdown: {service_name} (timeout={shutdown_timeout}s)")
            thread.join(timeout=shutdown_timeout)
            if thread.is_alive():
                logger.warning(f"Service shutdown timeout: {service_name}", extra={
                    'service_name': service_name,
                    'timeout': shutdown_timeout
                })
                service_status[service_name]['shutdown_status'] = 'timeout'
                shutdown_results[service_name] = 'timeout'
            else:
                logger.debug(f"Service stopped: {service_name}")
                service_status[service_name]['shutdown_status'] = 'success'
                shutdown_results[service_name] = 'success'
        else:
            logger.debug(f"Service already stopped: {service_name}")
            service_status[service_name]['shutdown_status'] = 'already_stopped'
            shutdown_results[service_name] = 'already_stopped'
    
    logger.info(
        f"Service shutdown complete: {len(shutdown_results)} services",
        extra={'shutdown_results': shutdown_results}
    )


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

