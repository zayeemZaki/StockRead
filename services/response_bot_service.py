"""Response Bot Service for analyzing user posts."""

import time
import logging
import redis
import json
import os
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
        
        # Initialize AI service with graceful degradation
        try:
            self.ai_bot = AIService()
            self.ai_available = True
            logger.info("AI service initialized successfully")
        except Exception as e:
            logger.warning(f"AI service initialization failed: {e}. AI analysis will be disabled.")
            self.ai_bot = None
            self.ai_available = False
        
        # Initialize Redis with graceful degradation
        try:
            from core.redis_utils import get_redis_url
            redis_url = get_redis_url()
            if not redis_url:
                raise ValueError("REDIS_URL not configured or invalid")
            self.redis = redis.from_url(redis_url)
            self.redis.ping()  # Test connection
            self.redis_available = True
            logger.info("Response Bot Service initialized with Redis")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. AI analysis will use database polling fallback.")
            self.redis = None
            self.redis_available = False
    
    def process_single_post(self, post_id: int, ticker: str, user_content: str):
        """Process a single post with AI analysis."""
        try:
            logger.info(f"Processing post #{post_id} for {ticker}")
            
            # Fetch post to get user_id for reputation
            post_response = self.db.supabase.table("posts").select("user_id").eq("id", post_id).single().execute()
            user_id = post_response.data.get('user_id') if post_response.data else None
            
            # Get macro context
            macro_context = self.data_engine.get_macro_context()
            
            # Get market data
            market_data = self.data_engine.get_price_context(ticker)
            
            if not market_data:
                logger.warning(f"Invalid ticker {ticker}, marking as error")
                self.db.supabase.table("posts").update({"ai_score": -1, "ai_summary": "Invalid Ticker"}).eq("id", post_id).execute()
                return False

            technicals = self.data_engine.get_technical_analysis(ticker)
            news = self.data_engine.get_latest_news(ticker)
            
            # Check if AI service is available
            if not self.ai_available or not self.ai_bot:
                logger.warning(f"AI service not available. Skipping AI analysis for post #{post_id}")
                # Still save market data even without AI analysis
                update_data = {
                    "raw_market_data": market_data,
                    "analyst_rating": market_data.get('recommendationKey'),
                    "target_price": float(market_data.get('targetMean')) if market_data.get('targetMean') else None,
                    "short_float": float(market_data.get('shortPercentOfFloat')) if market_data.get('shortPercentOfFloat') else None,
                    "insider_held": float(market_data.get('heldPercentInsiders')) if market_data.get('heldPercentInsiders') else None,
                    "ai_score": None,
                    "ai_summary": "AI analysis unavailable - GOOGLE_API_KEY not configured"
                }
                try:
                    self.db.supabase.table("posts").update(update_data).eq("id", post_id).execute()
                    logger.info(f"Saved market data: post_id={post_id}, ai_analysis=skipped")
                    return True
                except Exception as db_error:
                    logger.error(f"Database update failed: {db_error}")
                    return False
            
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
                    "ai_summary": f"AI Analysis:\n{insight['summary']}",
                    "raw_market_data": market_data,
                    "analyst_rating": market_data.get('recommendationKey'),
                    "target_price": float(market_data.get('targetMean')) if market_data.get('targetMean') else None,
                    "short_float": float(market_data.get('shortPercentOfFloat')) if market_data.get('shortPercentOfFloat') else None,
                    "insider_held": float(market_data.get('heldPercentInsiders')) if market_data.get('heldPercentInsiders') else None
                }
                
                try:
                    self.db.supabase.table("posts").update(update_data).eq("id", post_id).execute()
                    logger.info(f"Post analysis complete: post_id={post_id}, ticker={ticker}")
                    
                    # Update ticker_insights
                    self._update_ticker_insights(ticker, insight, market_data, macro_context)
                    
                    # Award reputation points if user was correct
                    if user_id:
                        user_sentiment = insight.get('user_thesis', 'Neutral')
                        ai_score = insight['sentiment_score']
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
                                # Fallback if RPC doesn't exist
                                profile_resp = self.db.supabase.table("profiles").select("reputation_score").eq("id", user_id).single().execute()
                                current_rep = profile_resp.data.get('reputation_score', 0) if profile_resp.data else 0
                                new_rep = current_rep + reputation_points
                                
                                self.db.supabase.table("profiles").update({
                                    "reputation_score": new_rep
                                }).eq("id", user_id).execute()
                    
                    return True
                except Exception as db_error:
                    logger.error(f"Database update failed: {db_error}")
                    return False
            else:
                logger.warning(f"AI analysis returned no insight for post #{post_id}")
                return False
        except Exception as e:
            logger.error(f"Error processing post #{post_id}: {e}", exc_info=True)
            return False
    
    def _update_ticker_insights(self, ticker: str, insight: dict, market_data: dict, macro_context: dict):
        """Update ticker_insights table with analysis results."""
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
                'analyst_rating': market_data.get('recommendationKey'),
                'target_price': safe_float(market_data.get('targetMean')),
                'short_float': safe_float(market_data.get('shortPercentOfFloat')),
                'insider_held': safe_float(market_data.get('heldPercentInsiders')),
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

    def process_unprocessed_posts_from_db(self):
        """
        Fallback: Process posts directly from database that don't have AI data yet.
        Uses exponential backoff for error recovery and adaptive polling intervals.
        """
        logger.info("Processing unprocessed posts from database (fallback mode)...")
        
        # Exponential backoff configuration
        base_delay = 5  # Base delay in seconds
        max_delay = 300  # Maximum delay (5 minutes)
        backoff_multiplier = 2
        consecutive_errors = 0
        no_posts_count = 0
        
        # Adaptive polling intervals
        idle_poll_interval = 60  # When no posts found
        active_poll_interval = 10  # When posts are being processed
        current_poll_interval = idle_poll_interval
        
        while True:
            try:
                # Find posts without AI data (ai_score is null or 0, or raw_market_data is null)
                # Query posts where ai_score is null OR ai_score is 0 OR raw_market_data is null
                response = self.db.supabase.table("posts")\
                    .select("id, ticker, content, ai_score, raw_market_data, user_id")\
                    .is_("ai_score", "null")\
                    .order("created_at", desc=False)\
                    .limit(10)\
                    .execute()
                
                # Also get posts with ai_score = 0
                response2 = self.db.supabase.table("posts")\
                    .select("id, ticker, content, ai_score, raw_market_data, user_id")\
                    .eq("ai_score", 0)\
                    .order("created_at", desc=False)\
                    .limit(10)\
                    .execute()
                
                # Combine results and deduplicate
                all_posts = (response.data or []) + (response2.data or [])
                seen_ids = set()
                posts = []
                for post in all_posts:
                    if post['id'] not in seen_ids:
                        seen_ids.add(post['id'])
                        posts.append(post)
                
                # Reset error counter on successful query
                consecutive_errors = 0
                
                if not posts:
                    no_posts_count += 1
                    # Adaptive polling: increase interval if no posts found for a while
                    if no_posts_count > 10:
                        current_poll_interval = min(idle_poll_interval * 2, 120)  # Max 2 minutes when idle
                    else:
                        current_poll_interval = idle_poll_interval
                    
                    logger.debug(f"No unprocessed posts found (count: {no_posts_count}). Waiting {current_poll_interval}s...")
                    time.sleep(current_poll_interval)
                    continue
                
                # Reset no posts counter when posts are found
                no_posts_count = 0
                current_poll_interval = active_poll_interval
                
                logger.info(f"Found {len(posts)} unprocessed posts. Processing...")
                
                processed_count = 0
                failed_count = 0
                
                for post in posts:
                    post_id = post['id']
                    ticker = post['ticker']
                    user_content = post['content']
                    
                    # Skip if already processed
                    if post.get('ai_score') and post.get('ai_score') > 0 and post.get('raw_market_data'):
                        continue
                    
                    try:
                        logger.info(f"Processing post #{post_id} for {ticker} (from database)")
                        success = self.process_single_post(post_id, ticker, user_content)
                        
                        if success:
                            processed_count += 1
                        else:
                            failed_count += 1
                            # Use exponential backoff for individual post failures
                            delay = min(base_delay * (backoff_multiplier ** min(failed_count, 3)), max_delay)
                            logger.warning(f"Post #{post_id} processing failed. Waiting {delay}s before next post...")
                            time.sleep(delay)
                            continue
                        
                        # Adaptive delay between posts based on success rate
                        if processed_count > 0 and failed_count == 0:
                            # Fast processing when things are working
                            time.sleep(1)
                        else:
                            # Slower when there are failures
                            time.sleep(2)
                            
                    except Exception as post_error:
                        failed_count += 1
                        error_type = type(post_error).__name__
                        logger.error(f"Error processing post #{post_id}: {error_type}: {str(post_error)[:100]}")
                        
                        # Determine backoff based on error type
                        if '429' in str(post_error) or 'quota' in str(post_error).lower():
                            # Rate limit: longer backoff
                            delay = min(60 * (backoff_multiplier ** min(failed_count, 2)), max_delay)
                        elif 'timeout' in str(post_error).lower() or 'connection' in str(post_error).lower():
                            # Network issues: moderate backoff
                            delay = min(base_delay * (backoff_multiplier ** min(failed_count, 2)), 120)
                        else:
                            # Other errors: shorter backoff
                            delay = min(base_delay * (backoff_multiplier ** min(failed_count, 1)), 30)
                        
                        logger.warning(f"Waiting {delay}s before retrying (error: {error_type})...")
                        time.sleep(delay)
                
                # Log batch summary
                if processed_count > 0:
                    logger.info(f"Batch complete: {processed_count} processed, {failed_count} failed")
                
                # Adaptive wait before next batch based on activity
                if processed_count > 0:
                    # If we processed posts, check again soon
                    time.sleep(active_poll_interval)
                else:
                    # If no posts processed, wait longer
                    time.sleep(idle_poll_interval)
                
            except Exception as e:
                consecutive_errors += 1
                error_type = type(e).__name__
                error_msg = str(e)
                
                # Determine backoff based on error type
                if '429' in error_msg or 'quota' in error_msg.lower():
                    # Rate limit: exponential backoff up to 5 minutes
                    delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 4)), max_delay)
                    logger.error(f"Rate limit error in database polling (attempt {consecutive_errors}): {error_type}")
                elif 'timeout' in error_msg.lower() or 'connection' in error_msg.lower():
                    # Network issues: moderate exponential backoff
                    delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 3)), 180)
                    logger.error(f"Connection error in database polling (attempt {consecutive_errors}): {error_type}")
                elif 'database' in error_msg.lower() or 'supabase' in error_msg.lower():
                    # Database errors: longer backoff
                    delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 3)), 120)
                    logger.error(f"Database error in polling (attempt {consecutive_errors}): {error_type}")
                else:
                    # Other errors: standard exponential backoff
                    delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 3)), 60)
                    logger.error(f"Error in database polling (attempt {consecutive_errors}): {error_type}: {error_msg[:100]}")
                
                logger.warning(f"Using exponential backoff: waiting {delay}s before retry...")
                time.sleep(delay)
                
                # Reset after successful recovery (handled in try block)

    def process_user_posts(self):
        """Process user posts from Redis queue with instant reaction."""
        if not self.redis_available or not self.redis:
            logger.warning("Redis not available - Falling back to database polling mode")
            self.process_unprocessed_posts_from_db()
            return
        
        logger.info("Response Bot listening for analysis jobs on Redis queue...")
        
        # Get macro context once (shared across jobs)
        macro_context = self.data_engine.get_macro_context()
        
        # Exponential backoff configuration
        base_delay = 2
        max_delay = 60
        backoff_multiplier = 2
        consecutive_errors = 0
        
        while True:
            try:
                # Blocking Redis listen with 30-second timeout
                task = self.redis.blpop("analysis_jobs", timeout=30)
                
                # Reset error counter on successful operation
                consecutive_errors = 0
                
                if task:
                    # Parse the job
                    job_data = json.loads(task[1])
                    post_id = job_data['postId']
                    ticker = job_data['ticker']
                    
                    logger.info(f"Processing analysis job for post #{post_id} ({ticker})")
                    
                    # Fetch the specific post from database
                    response = self.db.supabase.table("posts").select("*").eq("id", post_id).single().execute()
                    post = response.data
                    
                    if not post:
                        logger.warning(f"Post #{post_id} not found, skipping")
                        continue
                    
                    user_content = post['content']
                    
                    # Use the refactored method
                    self.process_single_post(post_id, ticker, user_content)
                    
                    logger.info(f"Completed analysis for post #{post_id}")
                
            except redis.ConnectionError as e:
                consecutive_errors += 1
                delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 4)), max_delay)
                logger.error(f"Redis connection error (attempt {consecutive_errors}): {str(e)[:100]}")
                logger.warning(f"Using exponential backoff: waiting {delay}s before retry...")
                time.sleep(delay)
                
                # Try to reconnect
                try:
                    from core.redis_utils import get_redis_url
                    redis_url = get_redis_url()
                    if redis_url:
                        self.redis = redis.from_url(redis_url)
                        self.redis.ping()
                        logger.info("Redis connection restored")
                        consecutive_errors = 0
                except Exception as reconnect_error:
                    logger.warning(f"Redis reconnection failed: {str(reconnect_error)[:100]}")
                    
            except json.JSONDecodeError as e:
                consecutive_errors += 1
                delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 2)), 10)
                logger.error(f"JSON decode error in job data (attempt {consecutive_errors}): {str(e)[:100]}")
                logger.warning(f"Waiting {delay}s before continuing...")
                time.sleep(delay)
                
            except Exception as e:
                consecutive_errors += 1
                error_type = type(e).__name__
                error_msg = str(e)
                
                # Determine backoff based on error type
                if '429' in error_msg or 'quota' in error_msg.lower():
                    delay = min(30 * (backoff_multiplier ** min(consecutive_errors, 2)), max_delay)
                elif 'timeout' in error_msg.lower():
                    delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 2)), 30)
                else:
                    delay = min(base_delay * (backoff_multiplier ** min(consecutive_errors, 1)), 10)
                
                logger.error(f"Error processing job (attempt {consecutive_errors}): {error_type}: {error_msg[:100]}")
                logger.warning(f"Using exponential backoff: waiting {delay}s before retry...")
                time.sleep(delay)
    
    def run(self):
        """Run the response bot service continuously."""
        logger.info("Response Bot Service started")
        
        # If Redis not available, use database polling fallback
        if not self.redis_available:
            logger.warning("=" * 80)
            logger.warning("Redis unavailable - using database polling fallback")
            logger.warning("AI analysis will process posts from database every 60 seconds")
            logger.warning("For instant processing, configure REDIS_URL environment variable")
            logger.warning("=" * 80)
        
        while True:
            try:
                self.process_user_posts()
            except KeyboardInterrupt:
                logger.info("Response Bot Service stopped by user")
                break
            except Exception as e:
                logger.error(f"Response Bot Service error: {e}", exc_info=True)
                # Retry after 60 seconds
                logger.info("Retrying in 60 seconds...")
                time.sleep(60)
                # Re-initialize Redis connection in case it was temporary
                try:
                    from core.redis_utils import get_redis_url
                    redis_url = get_redis_url()
                    if redis_url:
                        self.redis = redis.from_url(redis_url)
                        self.redis.ping()
                        self.redis_available = True
                        logger.info("Redis connection restored - switching to instant processing mode")
                except Exception as redis_err:
                    logger.warning(f"Redis reconnection failed: {redis_err}")
                    self.redis_available = False

