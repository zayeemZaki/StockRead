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
            logger.info("🔄 Refreshed trending posts materialized view")
        except Exception as e:
            logger.error(f"Failed to refresh materialized views: {e}")

    def run_maintenance_loop(self):
        """Run maintenance tasks in a continuous loop."""
        logger.info("Maintenance Service started - refreshing every 5 minutes")

        while True:
            try:
                self.refresh_materialized_views()
            except Exception as e:
                logger.error(f"Maintenance loop error: {e}")

            # Wait 5 minutes before next refresh
            time.sleep(300)