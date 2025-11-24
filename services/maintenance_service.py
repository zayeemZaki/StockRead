"""Maintenance Service for periodic database maintenance tasks."""

import time
import logging
from services.db_service import DatabaseService

logger = logging.getLogger(__name__)


class MaintenanceService:
    """Service for running periodic maintenance tasks on the database."""

    def __init__(self):
        self.db = DatabaseService()
        logger.info("Maintenance Service initialized")

    def refresh_materialized_views(self):
        """Refresh materialized views for optimal query performance."""
        try:
            # Use RPC function for refreshing trending posts view
            self.db.supabase.rpc('refresh_trending')
            logger.info("Refreshed materialized view: trending_posts")
        except Exception as e:
            logger.error(f"Failed to refresh materialized views: {e}")

    def run_maintenance_loop(self):
        """Run maintenance tasks in a continuous loop with robust error handling."""
        logger.info("Maintenance Service started - refreshing every 5 minutes")
        
        consecutive_failures = 0
        max_failures = 5
        base_delay = 60  # Start with 1 minute delay on errors
        
        while True:
            try:
                self.refresh_materialized_views()
                # Reset failure counter on success
                consecutive_failures = 0
            except Exception as e:
                consecutive_failures += 1
                error_type = type(e).__name__
                error_msg = str(e)
                
                # Log error with context
                logger.error(
                    f"Maintenance loop error (failure {consecutive_failures}/{max_failures}): "
                    f"{error_type}: {error_msg[:200]}",
                    exc_info=consecutive_failures >= 3  # Full traceback after 3 failures
                )
                
                # Circuit breaker: if too many consecutive failures, wait longer
                if consecutive_failures >= max_failures:
                    delay = base_delay * (2 ** min(consecutive_failures - max_failures, 3))
                    logger.warning(
                        f"Too many consecutive failures ({consecutive_failures}). "
                        f"Waiting {delay}s before retry (circuit breaker active)"
                    )
                    time.sleep(delay)
                    # Reset counter after long wait to allow recovery
                    consecutive_failures = 0
                    continue
                
                # Exponential backoff for recoverable errors
                delay = base_delay * (2 ** min(consecutive_failures - 1, 2))
                logger.warning(f"Waiting {delay}s before retry...")
                time.sleep(delay)
                continue

            # Wait 5 minutes before next refresh (only on success)
            time.sleep(300)