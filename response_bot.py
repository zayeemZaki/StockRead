import time
import logging
from services.market_service import MarketDataService
from services.ai_service import AIService
from services.db_service import DatabaseService

logger = logging.getLogger(__name__)

def process_user_posts():
    db = DatabaseService()
    data_engine = MarketDataService()
    ai_bot = AIService()

    while True:
        response = db.supabase.table("posts").select("*").is_("ai_score", "null").execute()
        posts_to_analyze = response.data

        if not posts_to_analyze:
            time.sleep(5)
            continue

        logger.info(f"Found {len(posts_to_analyze)} new posts to analyze")
        
        macro_context = data_engine.get_macro_context()

        for post in posts_to_analyze:
            ticker = post['ticker']
            user_content = post['content']
            post_id = post['id']

            market_data = data_engine.get_price_context(ticker)
            
            if not market_data:
                logger.warning(f"Invalid ticker {ticker}, marking as error")
                db.supabase.table("posts").update({"ai_score": -1, "ai_summary": "Invalid Ticker"}).eq("id", post_id).execute()
                continue

            technicals = data_engine.get_technical_analysis(ticker)
            news = data_engine.get_latest_news(ticker)
            
            insight = ai_bot.analyze_signal(
                ticker, 
                market_data,
                news,
                technicals,
                macro_context,
                user_post_text=user_content
            )

            if insight:
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
                    db.supabase.table("posts").update(update_data).eq("id", post_id).execute()
                    logger.info(f"Graded post #{post_id} for {ticker}")
                except Exception as db_error:
                    logger.error(f"Database update failed: {db_error}")
                    raise
                
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
                        db.supabase.rpc('increment_reputation', {
                            'user_id': user_id,
                            'points': reputation_points
                        }).execute()
                    except Exception:
                        profile_resp = db.supabase.table("profiles").select("reputation_score").eq("id", user_id).single().execute()
                        current_rep = profile_resp.data.get('reputation_score', 0) if profile_resp.data else 0
                        new_rep = current_rep + reputation_points
                        
                        db.supabase.table("profiles").update({
                            "reputation_score": new_rep
                        }).eq("id", user_id).execute()
            
            time.sleep(2)

if __name__ == "__main__":
    process_user_posts()