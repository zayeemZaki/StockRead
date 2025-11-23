"""Response Bot Service for analyzing user posts."""

import time
import logging
from datetime import datetime, timezone
from services.market_service import MarketDataService
from services.ai_service import AIService
from services.db_service import DatabaseService

logger = logging.getLogger(__name__)


def safe_float(value):
    """
    Safely convert a value to float.
    
    Args:
        value: Input value to convert (string, number, or None)
    
    Returns:
        float or None: Converted float value, or None if conversion fails
    
    Handles:
        - None values
        - 'N/A', '-', empty strings
        - Invalid numeric strings
        - Already numeric values
    """
    if value is None:
        return None
    
    # Handle string cases
    if isinstance(value, str):
        value = value.strip()
        if value in ('N/A', '-', '', 'None'):
            return None
    
    # Try to convert to float
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def get_signal_label(score: int) -> str:
    """
    Convert AI score to trading signal.
    
    Args:
        score: AI sentiment score (0-100)
    
    Returns:
        Signal label: 'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'
    """
    if score >= 80:
        return 'Strong Buy'
    elif score >= 60:
        return 'Buy'
    elif score >= 40:
        return 'Hold'
    elif score >= 20:
        return 'Sell'
    else:
        return 'Strong Sell'


class ResponseBotService:
    """Service for analyzing user posts and providing AI insights."""
    
    def __init__(self):
        self.db = DatabaseService()
        self.data_engine = MarketDataService()
        self.ai_bot = AIService()
        logger.info("Response Bot Service initialized")
    
    def process_user_posts(self):
        """Continuously process user posts that need AI analysis."""
        while True:
            response = self.db.supabase.table("posts").select("*").is_("ai_score", "null").execute()
            posts_to_analyze = response.data

            if not posts_to_analyze:
                time.sleep(5)
                continue

            logger.info(f"Found {len(posts_to_analyze)} new posts to analyze")
            
            macro_context = self.data_engine.get_macro_context()

            for post in posts_to_analyze:
                ticker = post['ticker']
                user_content = post['content']
                post_id = post['id']

                market_data = self.data_engine.get_price_context(ticker)
                
                if not market_data:
                    logger.warning(f"Invalid ticker {ticker}, marking as error")
                    self.db.supabase.table("posts").update({"ai_score": -1, "ai_summary": "Invalid Ticker"}).eq("id", post_id).execute()
                    continue

                technicals = self.data_engine.get_technical_analysis(ticker)
                news = self.data_engine.get_latest_news(ticker)
                
                insight = self.ai_bot.analyze_signal(
                    ticker, 
                    market_data,
                    news,
                    technicals,
                    macro_context,
                    user_post_text=user_content
                )

                if insight:
                    # Update the post with AI analysis
                    update_data = {
                        "ai_score": int(round(insight['sentiment_score'])),
                        "ai_risk": insight['risk_level'],
                        "user_sentiment_label": insight.get('user_thesis', 'Neutral'),
                        "ai_summary": f"🤖 AI FACT CHECK:\n{insight['summary']}",
                        "raw_market_data": market_data,
                        "analyst_rating": market_data.get('recommendationKey'),
                        "target_price": float(market_data.get('targetMean')) if market_data.get('targetMean') else None,
                        "short_float": float(market_data.get('shortPercentOfFloat')) if market_data.get('shortPercentOfFloat') else None,
                        "insider_held": float(market_data.get('heldPercentInsiders')) if market_data.get('heldPercentInsiders') else None
                    }
                    
                    try:
                        self.db.supabase.table("posts").update(update_data).eq("id", post_id).execute()
                        logger.info(f"Graded post #{post_id} for {ticker}")
                    except Exception as db_error:
                        logger.error(f"Database update failed: {db_error}")
                        raise
                    
                    # User-Driven Ticker Registration: Upsert to ticker_insights table
                    try:
                        ai_score = int(round(insight['sentiment_score']))
                        ai_signal = get_signal_label(ai_score)
                        ai_risk = insight['risk_level']
                        ai_summary = insight['summary']
                        
                        ticker_insight = {
                            'ticker': ticker,
                            'ai_score': ai_score,
                            'ai_signal': ai_signal,
                            'ai_risk': ai_risk,
                            'ai_summary': ai_summary,
                            'current_price': safe_float(market_data.get('price')),
                            'market_cap': market_data.get('market_cap'),
                            'pe_ratio': safe_float(market_data.get('pe_ratio')),
                            # God Mode institutional data (if available)
                            'analyst_rating': market_data.get('recommendationKey'),
                            'target_price': safe_float(market_data.get('targetMean')),
                            'short_float': safe_float(market_data.get('shortPercentOfFloat')),
                            'insider_held': safe_float(market_data.get('heldPercentInsiders')),
                            # Macro context
                            'vix': safe_float(macro_context.get('vix')) if macro_context else None,
                            'market_sentiment': macro_context.get('market_sentiment') if macro_context else None,
                            'updated_at': datetime.now(timezone.utc).isoformat()
                        }
                        
                        self.db.supabase.table('ticker_insights').upsert(
                            ticker_insight,
                            on_conflict='ticker'
                        ).execute()
                        
                        logger.info(f"Updated global insights for {ticker}")
                    except Exception as insight_error:
                        logger.error(f"Failed to update ticker_insights for {ticker}: {insight_error}")
                        # Don't raise - continue processing other posts
                    
                    user_sentiment = insight.get('user_thesis', 'Neutral')
                    ai_score = insight['sentiment_score']
                    user_id = post['user_id']
                    reputation_points = 0
                    
                    if user_sentiment == 'Bullish' and ai_score > 60:
                        reputation_points = 10
                    elif user_sentiment == 'Bearish' and ai_score < 40:
                        reputation_points = 10
                    
                    if reputation_points > 0:
                        try:
                            self.db.supabase.rpc('increment_reputation', {
                                'user_id': user_id,
                                'points': reputation_points
                            }).execute()
                        except Exception:
                            profile_resp = self.db.supabase.table("profiles").select("reputation_score").eq("id", user_id).single().execute()
                            current_rep = profile_resp.data.get('reputation_score', 0) if profile_resp.data else 0
                            new_rep = current_rep + reputation_points
                            
                            self.db.supabase.table("profiles").update({
                                "reputation_score": new_rep
                            }).eq("id", user_id).execute()
                
                time.sleep(2)
    
    def run(self):
        """Run the response bot service continuously."""
        logger.info("Response Bot Service started")
        try:
            self.process_user_posts()
        except KeyboardInterrupt:
            logger.info("Response Bot Service stopped by user")
        except Exception as e:
            logger.error(f"Response Bot Service error: {e}", exc_info=True)

