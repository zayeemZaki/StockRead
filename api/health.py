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
        from core.redis_utils import get_redis_url
        redis_url = get_redis_url()
        if redis_url and redis:
            try:
                r = redis.from_url(redis_url, socket_connect_timeout=2, socket_keepalive=True)
                r.ping()
                health_status["services"]["redis"] = {
                    "status": "connected",
                    "configured": True
                }
            except redis.ConnectionError as conn_err:
                # Try to get more specific error information
                error_msg = str(conn_err)
                if "Connection refused" in error_msg or "ECONNREFUSED" in error_msg:
                    health_status["services"]["redis"] = {
                        "status": "disconnected",
                        "configured": True,
                        "error": "Connection refused - Redis server may be down or unreachable"
                    }
                elif "timeout" in error_msg.lower():
                    health_status["services"]["redis"] = {
                        "status": "disconnected",
                        "configured": True,
                        "error": "Connection timeout - Redis server may be slow or unreachable"
                    }
                else:
                    health_status["services"]["redis"] = {
                        "status": "disconnected",
                        "configured": True,
                        "error": f"Connection failed: {error_msg[:100]}"
                    }
            except redis.AuthenticationError as auth_err:
                health_status["services"]["redis"] = {
                    "status": "error",
                    "configured": True,
                    "error": "Authentication failed - check Redis password/credentials"
                }
            except Exception as redis_err:
                error_type = type(redis_err).__name__
                health_status["services"]["redis"] = {
                    "status": "error",
                    "configured": True,
                    "error": f"{error_type}: {str(redis_err)[:100]}"
                }
        elif os.getenv("REDIS_URL") and not redis_url:
            # URL was provided but couldn't be normalized
            health_status["services"]["redis"] = {
                "status": "error",
                "configured": True,
                "error": "Invalid Redis URL format. Could not extract valid URL from REDIS_URL environment variable."
            }
        elif os.getenv("REDIS_URL") and not redis:
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
        health_status["services"]["redis"] = {
            "status": "error",
            "configured": bool(os.getenv("REDIS_URL")),
            "error": f"{error_type}: {str(e)[:100]}"
        }
        # Redis is optional (fallback to DB polling), so don't mark as unhealthy
    
    # Check AI service configuration (without exposing key)
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            health_status["services"]["ai"] = {
                "status": "configured",
                "api_key_present": True,
                "api_key_length": len(api_key)  # Only log length, never the key itself
            }
        else:
            health_status["services"]["ai"] = {
                "status": "not_configured",
                "api_key_present": False
            }
            # AI is optional, so don't mark as unhealthy
    except Exception as e:
        # Sanitize error message to prevent key leakage
        from core.security import sanitize_log_message
        error_msg = sanitize_log_message(str(e))[:100]
        health_status["services"]["ai"] = {
            "status": "error",
            "error": error_msg
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

