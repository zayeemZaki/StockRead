"""Health check endpoints."""
import os
import time
import logging
from fastapi import APIRouter
from core.service_manager import background_threads

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/healthz")
async def healthz():
    """
    Enhanced health check endpoint for Render/Kubernetes.
    Checks all critical services and dependencies.
    """
    try:
        import redis
    except ImportError:
        redis = None
    
    from services.db_service import DatabaseService
    
    health_status = {
        "status": "ok",
        "healthy": True,
        "timestamp": time.time(),
        "services": {}
    }
    
    # Check Redis connection
    try:
        redis_url = os.getenv("REDIS_URL")
        if redis_url and redis:
            r = redis.from_url(redis_url, socket_connect_timeout=2)
            r.ping()
            health_status["services"]["redis"] = {
                "status": "connected",
                "configured": True
            }
        elif redis_url:
            health_status["services"]["redis"] = {
                "status": "not_available",
                "configured": True,
                "error": "redis module not installed"
            }
        else:
            health_status["services"]["redis"] = {
                "status": "not_configured",
                "configured": False
            }
    except Exception as e:
        error_type = type(e).__name__
        if redis and isinstance(e, redis.ConnectionError):
            health_status["services"]["redis"] = {
                "status": "disconnected",
                "configured": True,
                "error": "Connection failed"
            }
        else:
            health_status["services"]["redis"] = {
                "status": "error",
                "configured": bool(os.getenv("REDIS_URL")),
                "error": f"{error_type}: {str(e)[:100]}"
            }
        # Redis is optional (fallback to DB polling), so don't mark as unhealthy
    
    # Check AI service configuration
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            health_status["services"]["ai"] = {
                "status": "configured",
                "api_key_present": True
            }
        else:
            health_status["services"]["ai"] = {
                "status": "not_configured",
                "api_key_present": False
            }
            # AI is optional, so don't mark as unhealthy
    except Exception as e:
        health_status["services"]["ai"] = {
            "status": "error",
            "error": str(e)[:100]
        }
    
    # Check database connection
    try:
        db = DatabaseService()
        # Simple query to test connection (with timeout)
        db.supabase.table("posts").select("id").limit(1).execute()
        health_status["services"]["database"] = {
            "status": "connected",
            "configured": True
        }
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "disconnected",
            "configured": True,
            "error": str(e)[:100]
        }
        health_status["healthy"] = False
        health_status["status"] = "degraded"
    
    # Check background service threads
    try:
        thread_status = {}
        for service_name, thread in background_threads:
            thread_status[service_name] = {
                "alive": thread.is_alive(),
                "daemon": thread.daemon
            }
            if not thread.is_alive():
                health_status["status"] = "degraded"
                # Don't mark as unhealthy - services might restart
        
        health_status["services"]["background_threads"] = thread_status
    except Exception as e:
        health_status["services"]["background_threads"] = {
            "status": "error",
            "error": str(e)[:100]
        }
    
    # Determine overall health
    if not health_status["healthy"]:
        health_status["status"] = "unhealthy"
    
    return health_status

