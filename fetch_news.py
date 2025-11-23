from GoogleNews import GoogleNews
from services.db_service import DatabaseService
import logging

logger = logging.getLogger(__name__)

def update_market_news():
    db = DatabaseService()
    googlenews = GoogleNews(lang='en', region='US', period='1d')
    
    topics = ["Stock Market", "Economy", "Crypto", "Federal Reserve"]
    all_news = []

    for topic in topics:
        googlenews.search(topic)
        results = googlenews.result()
        all_news.extend(results[:3])
        googlenews.clear()

    db.supabase.table("market_news").delete().neq("id", 0).execute()

    for item in all_news:
        data = {
            "title": item['title'],
            "source": item['media'],
            "url": item['link'],
            "published_at": item['date']
        }
        try:
            db.supabase.table("market_news").insert(data).execute()
        except Exception as e:
            logger.error(f"Error inserting news: {e}")

if __name__ == "__main__":
    update_market_news()