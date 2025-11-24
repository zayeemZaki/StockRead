#!/usr/bin/env python3
"""
Global Analyst Service - User-Interest Tracking AI Analysis Engine

Analyzes stocks that users have posted about (from ticker_insights table) during market hours.

Features:
- Tracks only user-interest stocks (from ticker_insights table)
- Always includes core stocks (NVDA, TSLA, AAPL, etc.) as safety net
- Runs 3 times during market hours (10 AM, 12 PM, 2:30 PM ET)
- Skips when market is closed
- Batches 5 stocks per AI request to save quota
- 20-second delay between batches
- Refreshes ticker list daily at 10 AM
- Saves to ticker_insights table for global market view
"""

import sys
import os
import time
import re
import json
from datetime import datetime, timezone, timedelta
import pytz

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging

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


class GlobalAnalyst:
    """
    Background service that analyzes user-interest stocks with AI.
    Runs during market hours only, uses batch processing.
    Tracks only stocks that users have posted about (from ticker_insights table).
    """
    
    # Core list of top stocks to always include (safety net)
    CORE_STOCKS = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AMD', 'NFLX', 'SPY']
    
    def __init__(self):
        self.data_engine = MarketDataService()
        self.db = DatabaseService()
        
        # Initialize AI service with graceful degradation
        try:
            self.ai_service = AIService()
            self.ai_available = True
            logger.info("Global Analyst: AI service initialized successfully")
        except Exception as e:
            logger.warning(f"Global Analyst: AI service initialization failed: {e}. AI analysis will be disabled.")
            self.ai_service = None
            self.ai_available = False
        
        # Set up Eastern timezone for market hours
        self.eastern = pytz.timezone('US/Eastern')
        
        # Get user-interest tickers from database
        self.tracked_tickers = self._get_user_interest_tickers()
        
        core_stocks_count = len([t for t in self.CORE_STOCKS if t in self.tracked_tickers])
        logger.info(
            "Global Analyst initialized",
            extra={
                'tracked_tickers_count': len(self.tracked_tickers),
                'core_stocks_included': core_stocks_count,
                'total_core_stocks': len(self.CORE_STOCKS),
                'batch_size': 5,
                'analysis_frequency': '3x daily'
            }
        )
    
    def _get_user_interest_tickers(self) -> list:
        """
        Fetch unique tickers from ticker_insights table (user-interest tracking).
        Always includes core stocks as a safety net.
        
        Returns:
            List of unique ticker symbols
        """
        try:
            # Fetch all unique tickers from ticker_insights table
            response = self.db.supabase.table('ticker_insights').select('ticker').execute()
            
            # Extract unique tickers
            db_tickers = [row['ticker'] for row in response.data if row.get('ticker')]
            db_tickers = list(set(db_tickers))  # Remove duplicates
            
            # Combine with core stocks and remove duplicates
            all_tickers = list(set(db_tickers + self.CORE_STOCKS))
            
            # Sort for consistency (core stocks first, then alphabetical)
            core_in_list = [t for t in self.CORE_STOCKS if t in all_tickers]
            other_tickers = sorted([t for t in all_tickers if t not in self.CORE_STOCKS])
            sorted_tickers = core_in_list + other_tickers
            
            logger.info(
                "Fetched tickers from database",
                extra={
                    'db_tickers_count': len(db_tickers),
                    'core_stocks_count': len(self.CORE_STOCKS),
                    'total_tracked': len(sorted_tickers)
                }
            )
            return sorted_tickers
            
        except Exception as e:
            logger.warning(
                "Failed to fetch tickers from database, using core stocks only",
                extra={'error': str(e)}
            )
            return self.CORE_STOCKS.copy()
    
    def refresh_ticker_list(self):
        """Refresh the list of tracked tickers from the database."""
        self.tracked_tickers = self._get_user_interest_tickers()
        logger.info(f"Refreshed ticker list: {len(self.tracked_tickers)} stocks")
    
    def is_market_open(self) -> bool:
        """Check if US market is currently open (9:30 AM - 4:00 PM ET, Mon-Fri)"""
        now_et = datetime.now(self.eastern)
        
        # Check if weekend
        if now_et.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False
        
        # Check market hours (9:30 AM - 4:00 PM)
        market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
        
        return market_open <= now_et <= market_close
    
    def get_signal_label(self, score: int) -> str:
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
    
    def analyze_batch(self, tickers: list, macro_context=None) -> dict:
        """
        Analyze multiple stocks in a single AI request (batch processing).
        
        Args:
            tickers: List of stock symbols (up to 10)
            macro_context: Pre-fetched VIX and market sentiment
        
        Returns:
            Dictionary of {ticker: analysis_result}
        """
        logger.info(f"Batch analysis started: tickers={tickers}, count={len(tickers)}")
        
        # Fetch market data for all tickers in batch
        batch_data = {}
        for ticker in tickers:
            market_data = self.data_engine.get_price_context(ticker)
            if market_data:
                batch_data[ticker] = market_data
        
        if not batch_data:
            logger.warning("Batch analysis failed: no market data available", extra={'tickers': tickers})
            return {}
        
        # Check if AI service is available
        if not self.ai_available or not self.ai_service:
            logger.warning("AI service not available. Skipping batch analysis.")
            return {}
        
        # Create batch prompt
        prompt = self._create_batch_prompt(batch_data, macro_context)
        
        try:
            # Single AI request for all stocks
            response = self.ai_service.model.generate_content(prompt)
            
            # Parse response
            results = self._parse_batch_response(response.text, list(batch_data.keys()))
            
            # Save to database
            saved_count = 0
            for ticker, analysis in results.items():
                if self._save_ticker_insight(ticker, analysis, batch_data[ticker], macro_context):
                    saved_count += 1
            
            logger.info(
                f"Batch analysis complete: saved={saved_count}, total={len(results)}",
                extra={'saved_count': saved_count, 'total_count': len(results)}
            )
            return results
            
        except Exception as e:
            error_msg = str(e)
            if '429' in error_msg or 'quota' in error_msg.lower():
                logger.warning("Batch analysis rate limited", extra={'tickers': tickers})
            else:
                logger.error(f"Batch analysis error: {error_msg[:100]}", extra={'tickers': tickers}, exc_info=True)
            return {}
    
    def _create_batch_prompt(self, batch_data: dict, macro_context=None) -> str:
        """Create AI prompt for analyzing multiple stocks"""
        stocks_info = []
        
        for ticker, data in batch_data.items():
            stocks_info.append(f"""
{ticker}:
Price: ${data.get('price', 'N/A')}, P/E: {data.get('pe_ratio', 'N/A')}, 
Market Cap: {data.get('market_cap', 'N/A')}, Beta: {data.get('beta', 'N/A')},
Short %: {data.get('shortPercentOfFloat', 'N/A')}, Analyst: {data.get('recommendationKey', 'N/A')}""")
        
        vix_info = f"VIX: {macro_context.get('vix', 'N/A')}" if macro_context else ""
        
        return f"""Analyze these {len(batch_data)} stocks and provide objective market scores.
{vix_info}

{''.join(stocks_info)}

For EACH stock, provide:
- score: 0-100 (objective market strength)
- risk: Low/Medium/High/Extreme
- summary: 1 sentence analysis

Respond ONLY with valid JSON (no markdown):
{{"TICKER": {{"score": 75, "risk": "Medium", "summary": "Brief analysis"}}, ...}}"""
    
    def _parse_batch_response(self, response_text: str, tickers: list) -> dict:
        """Parse JSON response from batch AI analysis"""
        try:
            # Remove markdown code blocks if present
            cleaned = re.sub(r'```json\n?|\n?```', '', response_text.strip())
            
            # Find JSON object
            json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data
            
            logger.warning("Failed to parse JSON from batch response", extra={'tickers': tickers})
            return {}
            
        except Exception as e:
            logger.error(f"Batch response parse error: {str(e)[:100]}", extra={'tickers': tickers}, exc_info=True)
            return {}
    
    def _save_ticker_insight(self, ticker: str, analysis: dict, market_data: dict, macro_context=None) -> bool:
        """Save individual ticker analysis to database"""
        try:
            ai_score = int(analysis.get('score', 50))
            ai_signal = self.get_signal_label(ai_score)
            ai_risk = analysis.get('risk', 'Medium')
            ai_summary = analysis.get('summary', 'No analysis available')
            
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
                # Enhanced fundamental metrics
                'roe': safe_float(market_data.get('returnOnEquity')),
                'profit_margin': safe_float(market_data.get('profitMargins')),
                'revenue_growth': safe_float(market_data.get('revenueGrowth')),
                'earnings_growth': safe_float(market_data.get('earningsGrowth')),
                'debt_to_equity': safe_float(market_data.get('debtToEquity')),
                'current_ratio': safe_float(market_data.get('currentRatio')),
                # Dividend metrics
                'dividend_yield': safe_float(market_data.get('dividendYield')),
                'payout_ratio': safe_float(market_data.get('payoutRatio')),
                # 52-week range
                'week_52_high': safe_float(market_data.get('fiftyTwoWeekHigh')),
                'week_52_low': safe_float(market_data.get('fiftyTwoWeekLow')),
                # Sector context
                'sector': market_data.get('sector'),
                'industry': market_data.get('industry'),
                # Macro context
                'vix': safe_float(macro_context.get('vix')) if macro_context else None,
                'market_sentiment': macro_context.get('market_sentiment') if macro_context else None,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            self.db.supabase.table('ticker_insights').upsert(
                ticker_insight,
                on_conflict='ticker'
            ).execute()
            
            logger.debug(
                f"Saved ticker insight: ticker={ticker}, score={ai_score}, signal={ai_signal}, risk={ai_risk}",
                extra={'ticker': ticker, 'ai_score': ai_score, 'ai_signal': ai_signal, 'ai_risk': ai_risk}
            )
            return True
            
        except Exception as e:
            logger.error(f"Failed to save ticker insight: ticker={ticker}", extra={'ticker': ticker}, exc_info=True)
            return False
    
    def analyze_ticker(self, ticker: str, macro_context=None) -> bool:
        """
        Analyze a single ticker and save to database with retry logic.
        
        Args:
            ticker: Stock symbol
            macro_context: Pre-fetched VIX and market sentiment (optional)
        
        Returns:
            True if successful, False otherwise
        """
        max_retries = 3
        base_delay = 5
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    logger.debug(f"Retry attempt {attempt}/{max_retries}: ticker={ticker}")
                else:
                    logger.debug(f"Analyzing ticker: {ticker}")
                
                # 1. Fetch market data
                market_data = self.data_engine.get_price_context(ticker)
                
                if not market_data:
                    logger.warning(f"No market data available: ticker={ticker}", extra={'ticker': ticker})
                    return False
                
                # 2. Fetch technicals and news
                technicals = self.data_engine.get_technical_analysis(ticker)
                news = self.data_engine.get_latest_news(ticker)
                
                # Check if AI service is available
                if not self.ai_available or not self.ai_service:
                    logger.warning(f"AI service not available. Skipping analysis for {ticker}")
                    return False
                
                # 3. Run AI Analysis with retry handling
                # CRITICAL: Pass user_post_text=None for objective market analysis
                try:
                    insight = self.ai_service.analyze_signal(
                        ticker=ticker,
                        market_data=market_data,
                        news=news,
                        technicals=technicals,
                        macro_context=macro_context,
                        user_post_text=None  # No user bias - pure market analysis
                    )
                except Exception as ai_error:
                    error_msg = str(ai_error)
                    
                    # Check if it's a rate limit error (429)
                    if '429' in error_msg or 'quota' in error_msg.lower():
                        # Extract retry delay from error message if available
                        retry_match = re.search(r'retry in (\d+\.?\d*)', error_msg.lower())
                        if retry_match:
                            retry_delay = float(retry_match.group(1))
                        else:
                            # Use exponential backoff
                            retry_delay = base_delay * (2 ** attempt)
                        
                        if attempt < max_retries - 1:
                            logger.warning(f"Rate limit hit, waiting {retry_delay:.1f}s: ticker={ticker}", extra={
                                'ticker': ticker, 'retry_delay': retry_delay, 'attempt': attempt
                            })
                            time.sleep(retry_delay)
                            continue
                        else:
                            logger.error(f"Rate limit exceeded after {max_retries} attempts: ticker={ticker}", extra={
                                'ticker': ticker, 'max_retries': max_retries
                            })
                            return False
                    else:
                        # Non-rate-limit error
                        raise ai_error
                
                if not insight:
                    logger.error(f"AI analysis failed: ticker={ticker}", extra={'ticker': ticker})
                    return False
                
                # 5. Convert score to signal
                ai_score = int(round(insight['sentiment_score']))
                ai_signal = self.get_signal_label(ai_score)
                ai_risk = insight['risk_level']
                ai_summary = insight['summary']
                
                # 6. Prepare data for database
                ticker_insight = {
                    'ticker': ticker,
                    'ai_score': ai_score,
                    'ai_signal': ai_signal,
                    'ai_risk': ai_risk,
                    'ai_summary': ai_summary,
                    'current_price': safe_float(market_data.get('price')),
                    'market_cap': market_data.get('market_cap'),
                    'pe_ratio': safe_float(market_data.get('pe_ratio')),
                    # God Mode institutional data
                    'analyst_rating': market_data.get('recommendationKey'),
                    'target_price': safe_float(market_data.get('targetMean')),
                    'short_float': safe_float(market_data.get('shortPercentOfFloat')),
                    'insider_held': safe_float(market_data.get('heldPercentInsiders')),
                    # Enhanced fundamental metrics
                    'roe': safe_float(market_data.get('returnOnEquity')),
                    'profit_margin': safe_float(market_data.get('profitMargins')),
                    'revenue_growth': safe_float(market_data.get('revenueGrowth')),
                    'earnings_growth': safe_float(market_data.get('earningsGrowth')),
                    'debt_to_equity': safe_float(market_data.get('debtToEquity')),
                    'current_ratio': safe_float(market_data.get('currentRatio')),
                    # Dividend metrics
                    'dividend_yield': safe_float(market_data.get('dividendYield')),
                    'payout_ratio': safe_float(market_data.get('payoutRatio')),
                    # 52-week range
                    'week_52_high': safe_float(market_data.get('fiftyTwoWeekHigh')),
                    'week_52_low': safe_float(market_data.get('fiftyTwoWeekLow')),
                    # Sector context
                    'sector': market_data.get('sector'),
                    'industry': market_data.get('industry'),
                    # Macro context
                    'vix': safe_float(macro_context.get('vix')) if macro_context else None,
                    'market_sentiment': macro_context.get('market_sentiment') if macro_context else None,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                
                # 7. Upsert to ticker_insights table
                self.db.supabase.table('ticker_insights').upsert(
                    ticker_insight,
                    on_conflict='ticker'
                ).execute()
                
                logger.debug(f"Analysis result: ticker={ticker}, signal={ai_signal}, score={ai_score}, risk={ai_risk}")
                
                return True
                
            except Exception as e:
                error_msg = str(e)
                if attempt < max_retries - 1:
                    logger.warning(f"Error during analysis, retrying: ticker={ticker}, attempt={attempt+1}/{max_retries}", extra={
                        'ticker': ticker, 'attempt': attempt, 'error': error_msg[:100]
                    })
                    time.sleep(base_delay * (2 ** attempt))
                    continue
                else:
                    logger.error(f"Analysis failed after {max_retries} attempts: ticker={ticker}", extra={
                        'ticker': ticker, 'max_retries': max_retries, 'error': error_msg[:100]
                    }, exc_info=True)
                    return False
        
        return False
    
    def analyze_all_tickers(self, ticker_list: list = None, description: str = "stocks", batch_size: int = 5):
        """
        Analyze tickers using batch processing.
        Only runs during market hours. 20-second delay between batches.
        
        Args:
            ticker_list: List of tickers to analyze (defaults to tracked_tickers)
            description: Description for logging
            batch_size: Number of stocks per batch (default: 5)
        """
        if ticker_list is None:
            ticker_list = self.tracked_tickers
        
        # Check if market is open
        if not self.is_market_open():
            now_et = datetime.now(self.eastern)
            logger.info(f"Market closed, skipping analysis: time={now_et.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            return
        
        now_et = datetime.now(self.eastern)
        logger.info(
            f"Batch analysis started: mode={description}, tickers={len(ticker_list)}, batch_size={batch_size}",
            extra={
                'description': description,
                'ticker_count': len(ticker_list),
                'batch_size': batch_size,
                'start_time': now_et.isoformat()
            }
        )
        
        # Fetch macro context once for all stocks
        macro_context = self.data_engine.get_macro_context()
        if macro_context:
            logger.debug(
                f"Macro context fetched: vix={macro_context.get('vix')}, sentiment={macro_context.get('market_sentiment')}",
                extra=macro_context
            )
        
        # Track statistics
        total_analyzed = 0
        start_time = time.time()
        
        # Process in batches
        for i in range(0, len(ticker_list), batch_size):
            batch = ticker_list[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(ticker_list) + batch_size - 1) // batch_size
            
            logger.debug(f"Processing batch {batch_num}/{total_batches}: tickers={batch}")
            
            # Analyze batch
            results = self.analyze_batch(batch, macro_context)
            total_analyzed += len(results)
            
            # Wait 20 seconds before next batch (except last batch)
            if i + batch_size < len(ticker_list):
                time.sleep(20)
        
        # Log summary
        elapsed = time.time() - start_time
        elapsed_mins = elapsed / 60
        now_et = datetime.now(self.eastern)
        
        logger.info(
            f"Batch analysis complete: analyzed={total_analyzed}, total={len(ticker_list)}, elapsed={elapsed_mins:.1f}m",
            extra={
                'analyzed_count': total_analyzed,
                'total_count': len(ticker_list),
                'elapsed_seconds': elapsed,
                'elapsed_minutes': elapsed_mins,
                'end_time': now_et.isoformat()
            }
        )
    
    def run_continuous(self):
        """
        Run the analyst in continuous mode.
        - User-interest stocks: 3x daily (10 AM, 12 PM, 2:30 PM ET) - batch size 5
        - Refreshes ticker list at the start of each day
        - Skips when market is closed.
        """
        logger.info(
            "Global Analyst service started: mode=user_interest_tracking",
            extra={
                'tracked_tickers_count': len(self.tracked_tickers),
                'batch_size': 5,
                'analysis_frequency': '3x daily',
                'schedule': ['10:00 AM ET (refresh + analysis)', '12:00 PM ET (analysis)', '2:30 PM ET (analysis)']
            }
        )
        
        # Target times (Eastern Time)
        target_times = [(10, 0), (12, 0), (14, 30)]  # (hour, minute)
        last_run_date = None
        
        try:
            while True:
                now_et = datetime.now(self.eastern)
                current_date = now_et.date()
                
                # Check if market is open
                if not self.is_market_open():
                    # Calculate time until next market open
                    next_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
                    if now_et.hour >= 16 or now_et.weekday() >= 5:
                        # Market closed for the day or weekend
                        if now_et.weekday() >= 5:  # Weekend
                            days_to_monday = (7 - now_et.weekday()) % 7
                            if days_to_monday == 0:
                                days_to_monday = 1
                            next_open = next_open + timedelta(days=days_to_monday)
                        else:
                            next_open = next_open + timedelta(days=1)
                    
                    logger.info(f"Market closed, next run scheduled: {next_open.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                    sleep_seconds = (next_open - now_et).total_seconds()
                    time.sleep(max(60, sleep_seconds))  # Sleep at least 1 min
                    last_run_date = None  # Reset for new day
                    continue
                
                # Find next target time and hour
                next_run = None
                next_hour = None
                for hour, minute in target_times:
                    target = now_et.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    if target > now_et:
                        next_run = target
                        next_hour = hour
                        break
                
                if next_run is None:
                    # All runs done for today, wait until next market open
                    next_run = now_et.replace(hour=9, minute=30, second=0, microsecond=0) + timedelta(days=1)
                    next_hour = None
                
                # Check if we should run now (within 5 minutes of target time)
                time_diff = (now_et - next_run).total_seconds()
                if abs(time_diff) < 300 and last_run_date != current_date:  # Within 5 minutes and haven't run today
                    logger.info(f"Scheduled run time reached: {now_et.strftime('%H:%M:%S %Z')}")
                    
                    # 10 AM: Refresh ticker list and analyze all
                    if next_hour == 10:
                        logger.info("Morning analysis: refreshing ticker list and analyzing all stocks")
                        self.refresh_ticker_list()
                        self.analyze_all_tickers(self.tracked_tickers, "user-interest stocks", batch_size=5)
                    # 12 PM and 2:30 PM: Analyze current list
                    else:
                        logger.info(f"Analysis run: {now_et.strftime('%I:%M %p')} - User-Interest Stocks")
                        self.analyze_all_tickers(self.tracked_tickers, "user-interest stocks", batch_size=5)
                    
                    last_run_date = current_date
                    
                    # Wait until next target time
                    for hour, minute in target_times:
                        target = now_et.replace(hour=hour, minute=minute, second=0, microsecond=0)
                        if target > now_et:
                            next_run = target
                            break
                    else:
                        next_run = now_et.replace(hour=9, minute=30, second=0, microsecond=0) + timedelta(days=1)
                
                # Sleep until next run
                sleep_seconds = max(60, (next_run - datetime.now(self.eastern)).total_seconds())
                logger.debug(f"Next run scheduled: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')} (in {sleep_seconds/60:.1f} minutes)")
                time.sleep(min(sleep_seconds, 300))  # Check every 5 minutes max
        
        except KeyboardInterrupt:
            logger.info("Global Analyst stopped by user")
        
        except Exception as e:
            logger.critical(f"Fatal error in Global Analyst: {e}", exc_info=True)


def main():
    """
    Main entry point.
    """
    # Create the analyst
    analyst = GlobalAnalyst()
    
    # Run in continuous mode
    analyst.run_continuous()


if __name__ == "__main__":
    main()
