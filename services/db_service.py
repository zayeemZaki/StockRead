"""Database service for managing Supabase operations."""
import os
import logging
from typing import Dict, Any, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class DatabaseService:
    """Handles all database interactions with Supabase."""
    
    def __init__(self):
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            raise ValueError("Missing Supabase credentials in .env file")
            
        self.supabase: Client = create_client(url, key)
        logger.info("Database service initialized successfully")

    def save_signal(self, ticker: str, insight: Dict[str, Any], market_data: Dict[str, Any]) -> Optional[Any]:
        """
        Save AI analysis to the posts table.
        
        Args:
            ticker: Stock ticker symbol
            insight: Dictionary containing AI analysis results
            market_data: Dictionary containing market data
            
        Returns:
            Supabase response or None if failed
        """
        BOT_USER_ID = "2de4618e-25af-4ebc-a572-f92b7954fb0e"
        
        content_body = f"{insight['summary']}\n\n"
        content_body += " ".join([f"#{tag}" for tag in insight['tags']])

        data = {
            "user_id": BOT_USER_ID,
            "ticker": ticker,
            "content": content_body,
            "ai_score": insight['sentiment_score'],
            "ai_risk": insight['risk_level'],
            "ai_summary": str(insight),
        }
        
        try:
            response = self.supabase.table("posts").insert(data).execute()
            logger.info(f"Successfully posted analysis for {ticker}")
            return response
        except Exception as e:
            logger.error(f"Failed to save analysis for {ticker}: {str(e)}")
            return None


def main():
    """Test the database connection."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    db = DatabaseService()
    db.save_signal(
        "TEST", 
        {
            "sentiment_score": 99, 
            "risk_level": "Low", 
            "summary": "Test DB", 
            "tags": ["Test"]
        }, 
        {"price": 100}
    )


if __name__ == "__main__":
    main()
