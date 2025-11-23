"""News Service for fetching and updating market news."""

from GoogleNews import GoogleNews
from services.db_service import DatabaseService
import logging

logger = logging.getLogger(__name__)


class NewsService:
    """Service for fetching and updating market news."""
    
    def __init__(self):
        self.db = DatabaseService()
        logger.info("News Service initialized")
    
    def update_market_news(self):
        """Fetch and update market news from Google News."""
        googlenews = GoogleNews(lang='en', region='US', period='1d')
        
        topics = ["Stock Market", "Economy", "Crypto", "Federal Reserve"]
        all_news = []

        for topic in topics:
            googlenews.search(topic)
            results = googlenews.result()
            all_news.extend(results[:3])
            googlenews.clear()

        self.db.supabase.table("market_news").delete().neq("id", 0).execute()

        for item in all_news:
            data = {
                "title": item['title'],
                "source": item['media'],
                "url": item['link'],
                "published_at": item['date']
            }
            try:
                self.db.supabase.table("market_news").insert(data).execute()
            except Exception as e:
                logger.error(f"Error inserting news: {e}")

