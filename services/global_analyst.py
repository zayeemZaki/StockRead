#!/usr/bin/env python3
"""
Global Analyst Service - Top 200 Stocks AI Analysis Engine

Analyzes the most popular/liquid stocks during market hours using batch processing.

Features:
- Analyzes top 200 most liquid stocks (by market cap/volume)
- Runs 3 times during market hours (9:30 AM - 4:00 PM ET)
- Skips when market is closed
- Batches 10 stocks per AI request to save quota (20 requests total)
- 20-second delay between batches
- Saves to ticker_insights table for global market view
"""

import sys
import os
import time
import re
import json
import pickle
from pathlib import Path
from datetime import datetime, timezone, timedelta
import pytz
import yfinance as yf

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.market_service import MarketDataService
from services.ai_service import AIService
from services.db_service import DatabaseService
from market_maker import get_sp500_tickers


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
    Background service that analyzes top 200 stocks with AI.
    Runs during market hours only, uses batch processing.
    """
    
    def __init__(self):
        self.data_engine = MarketDataService()
        self.ai_service = AIService()
        self.db = DatabaseService()
        
        # Set up Eastern timezone for market hours
        self.eastern = pytz.timezone('US/Eastern')
        
        # Get all S&P 500 tickers
        all_tickers = get_sp500_tickers()
        
        # Load or generate stock lists (cached for 7 days)
        cache_file = Path(__file__).parent / '.top_stocks_cache.pkl'
        self.top_100, self.next_200, self.remaining_200 = self._load_or_generate_stock_lists(all_tickers, cache_file)
        
        print(f"\n✅ Global Analyst initialized")
        print(f"   🏆 Top 100 stocks: {len(self.top_100)} (batch size: 5, analyzed 3x daily)")
        print(f"   📊 Next 200 stocks: {len(self.next_200)} (batch size: 10, analyzed 3x daily)")
        print(f"   📈 Remaining 200 stocks: {len(self.remaining_200)} (batch size: 15, analyzed 1x daily at 10 AM)")
    
    def _load_or_generate_stock_lists(self, all_tickers: list, cache_file: Path) -> tuple:
        """
        Load cached stock lists or generate new ones.
        Cache is valid for 7 days.
        
        Returns:
            Tuple of (top_100_tickers, next_200_tickers, remaining_200_tickers)
        """
        # Check if cache exists and is recent (< 7 days old)
        if cache_file.exists():
            cache_age = datetime.now().timestamp() - cache_file.stat().st_mtime
            if cache_age < 7 * 24 * 60 * 60:  # 7 days in seconds
                try:
                    with open(cache_file, 'rb') as f:
                        cached_data = pickle.load(f)
                    print(f"\n✅ Loaded cached stock lists (cache age: {cache_age/86400:.1f} days)")
                    return cached_data['top_100'], cached_data['next_200'], cached_data['remaining_200']
                except Exception as e:
                    print(f"⚠️  Cache read failed: {e}, regenerating...")
        
        # Generate new lists
        print(f"\n📊 Generating stock lists by market cap (this may take 10-20 minutes)...")
        top_100, next_200, remaining_200 = self._get_stocks_by_market_cap(all_tickers)
        
        # Cache the results
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump({
                    'top_100': top_100,
                    'next_200': next_200,
                    'remaining_200': remaining_200,
                    'generated_at': datetime.now().isoformat()
                }, f)
            print(f"\n💾 Cached stock lists to {cache_file}")
        except Exception as e:
            print(f"⚠️  Cache write failed: {e}")
        
        return top_100, next_200, remaining_200
    
    def _get_stocks_by_market_cap(self, tickers: list) -> tuple:
        """
        Fetch market cap for all tickers and split into three tiers.
        
        Returns:
            Tuple of (top_100_tickers, next_200_tickers, remaining_200_tickers)
        """
        stocks_with_mcap = []
        
        for i, ticker in enumerate(tickers, 1):
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                mcap = info.get('marketCap', 0)
                
                if mcap and mcap > 0:
                    stocks_with_mcap.append({
                        'ticker': ticker,
                        'market_cap': mcap
                    })
                    
                    # Show progress every 50 stocks
                    if i % 50 == 0:
                        print(f"   📈 Processed {i}/{len(tickers)} tickers...")
                
                # Small delay to avoid rate limits
                if i % 100 == 0:
                    time.sleep(2)
                    
            except Exception as e:
                print(f"   ⚠️  {ticker}: {e}")
                continue
        
        # Sort by market cap descending
        stocks_with_mcap.sort(key=lambda x: x['market_cap'], reverse=True)
        
        # Split into three tiers
        top_100 = [s['ticker'] for s in stocks_with_mcap[:100]]
        next_200 = [s['ticker'] for s in stocks_with_mcap[100:300]]
        remaining_200 = [s['ticker'] for s in stocks_with_mcap[300:500]]
        
        print(f"\n✅ Stock lists generated")
        print(f"   🏆 Top 100 - Largest: {top_100[0]} | Smallest: {top_100[-1]}")
        print(f"   📊 Next 200 - Range: {next_200[0]} to {next_200[-1]}")
        print(f"   📈 Remaining {len(remaining_200)} stocks")
        
        return top_100, next_200, remaining_200
    
    def get_top_stocks(self, tickers: list, limit: int = 200) -> list:
        """Get top N stocks by market cap"""
        print(f"\n📊 Selecting top {limit} stocks by market cap...")
        
        # Fetch market cap for all tickers
        stocks_with_mcap = []
        
        for i, ticker in enumerate(tickers, 1):
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                mcap = info.get('marketCap', 0)
                
                if mcap and mcap > 0:
                    stocks_with_mcap.append({
                        'ticker': ticker,
                        'market_cap': mcap
                    })
                    
                    # Show progress every 50 stocks
                    if i % 50 == 0:
                        print(f"   📈 Processed {i}/{len(tickers)} tickers...")
                
                # Small delay to avoid rate limits
                if i % 100 == 0:
                    time.sleep(2)
                    
            except Exception as e:
                print(f"   ⚠️  {ticker}: {e}")
                continue
        
        # Sort by market cap descending
        stocks_with_mcap.sort(key=lambda x: x['market_cap'], reverse=True)
        
        # Return top N tickers
        top_tickers = [s['ticker'] for s in stocks_with_mcap[:limit]]
        
        print(f"\n✅ Selected top {len(top_tickers)} stocks by market cap")
        if top_tickers:
            print(f"   🏆 Largest: {top_tickers[0]}")
            print(f"   📉 Smallest in top {limit}: {top_tickers[-1]}")
        
        return top_tickers
    
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
        print(f"   📦 Batch analyzing {len(tickers)} stocks: {', '.join(tickers)}...")
        
        # Fetch market data for all tickers in batch
        batch_data = {}
        for ticker in tickers:
            market_data = self.data_engine.get_price_context(ticker)
            if market_data:
                batch_data[ticker] = market_data
        
        if not batch_data:
            print(f"   ❌ No market data for batch")
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
            
            print(f"   ✅ Saved {saved_count}/{len(results)} stocks")
            return results
            
        except Exception as e:
            error_msg = str(e)
            if '429' in error_msg or 'quota' in error_msg.lower():
                print(f"   ⏳ Rate limit hit - skipping batch")
            else:
                print(f"   ❌ Batch error: {error_msg[:60]}")
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
            
            print(f"   ⚠️  Could not parse JSON from response")
            return {}
            
        except Exception as e:
            print(f"   ❌ Parse error: {str(e)[:50]}")
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
                'vix': safe_float(macro_context.get('vix')) if macro_context else None,
                'market_sentiment': macro_context.get('market_sentiment') if macro_context else None,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            self.db.supabase.table('ticker_insights').upsert(
                ticker_insight,
                on_conflict='ticker'
            ).execute()
            
            signal_emoji = {
                'Strong Buy': '🟢🟢', 'Buy': '🟢', 'Hold': '⚪',
                'Sell': '🔴', 'Strong Sell': '🔴🔴'
            }.get(ai_signal, '⚪')
            
            print(f"      {ticker}: {signal_emoji} {ai_score}/100 | {ai_risk}")
            return True
            
        except Exception as e:
            print(f"      {ticker}: ❌ Save error")
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
                    print(f"   🔄 Retry {attempt}/{max_retries} for {ticker}...", end=" ")
                else:
                    print(f"   📊 Analyzing {ticker}...", end=" ")
                
                # 1. Fetch market data
                market_data = self.data_engine.get_price_context(ticker)
                
                if not market_data:
                    print(f"❌ No market data")
                    return False
                
                # 2. Fetch technicals and news
                technicals = self.data_engine.get_technical_analysis(ticker)
                news = self.data_engine.get_latest_news(ticker)
                
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
                            print(f"⏳ Rate limit, waiting {retry_delay:.1f}s...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            print(f"❌ Rate limit - skipping")
                            return False
                    else:
                        # Non-rate-limit error
                        raise ai_error
                
                if not insight:
                    print(f"❌ AI analysis failed")
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
                
                # 8. Print result
                signal_emoji = {
                    'Strong Buy': '🟢🟢',
                    'Buy': '🟢',
                    'Hold': '⚪',
                    'Sell': '🔴',
                    'Strong Sell': '🔴🔴'
                }.get(ai_signal, '⚪')
                
                print(f"{signal_emoji} {ai_signal} ({ai_score}/100) | {ai_risk} Risk")
                
                return True
                
            except Exception as e:
                error_msg = str(e)
                if attempt < max_retries - 1:
                    print(f"❌ Error, retrying...")
                    time.sleep(base_delay * (2 ** attempt))
                    continue
                else:
                    print(f"❌ Error: {error_msg[:50]}")
                    return False
        
        return False
    
    def analyze_all_tickers(self, ticker_list: list = None, description: str = "stocks", batch_size: int = 10):
        """
        Analyze tickers using batch processing.
        Only runs during market hours. 20-second delay between batches.
        
        Args:
            ticker_list: List of tickers to analyze (defaults to top_100)
            description: Description for logging
            batch_size: Number of stocks per batch (5 for top 100, 10 for next 200, 15 for remaining 200)
        """
        if ticker_list is None:
            ticker_list = self.top_100
        
        # Check if market is open
        if not self.is_market_open():
            now_et = datetime.now(self.eastern)
            print(f"\n🛑 Market is closed ({now_et.strftime('%Y-%m-%d %H:%M:%S %Z')})")
            print("   Skipping analysis until market opens (9:30 AM - 4:00 PM ET, Mon-Fri)\n")
            return
        
        print(f"\n{'='*80}")
        print(f"🤖 Global Analyst - Batch Analysis Mode ({description})")
        now_et = datetime.now(self.eastern)
        print(f"⏰ Started: {now_et.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        print(f"📊 Analyzing {len(ticker_list)} stocks in batches of {batch_size}")
        print(f"⏱️  20-second delay between batches")
        print(f"{'='*80}\n")
        
        # Fetch macro context once for all stocks
        print("🌍 Fetching macro market context (VIX)...")
        macro_context = self.data_engine.get_macro_context()
        if macro_context:
            print(f"   📊 VIX: {macro_context['vix']} | Sentiment: {macro_context['market_sentiment']}\n")
        
        # Track statistics
        total_analyzed = 0
        start_time = time.time()
        
        # Process in batches
        for i in range(0, len(ticker_list), batch_size):
            batch = ticker_list[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(ticker_list) + batch_size - 1) // batch_size
            
            print(f"📦 Batch {batch_num}/{total_batches}")
            
            # Analyze batch
            results = self.analyze_batch(batch, macro_context)
            total_analyzed += len(results)
            
            # Wait 20 seconds before next batch (except last batch)
            if i + batch_size < len(ticker_list):
                print(f"   ⏳ Waiting 20 seconds before next batch...\n")
                time.sleep(20)
        
        # Print summary
        elapsed = time.time() - start_time
        elapsed_mins = elapsed / 60
        
        print(f"\n{'='*80}")
        print(f"✅ Batch Analysis Complete!")
        print(f"   📊 Total Stocks Analyzed: {total_analyzed}/{len(ticker_list)}")
        print(f"   ⏱️  Time Elapsed: {elapsed_mins:.1f} minutes ({elapsed:.0f} seconds)")
        now_et = datetime.now(self.eastern)
        print(f"   ⏰ Finished: {now_et.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        print(f"{'='*80}\n")
    
    def run_continuous(self):
        """
        Run the analyst in continuous mode.
        - Top 100 stocks: 3x daily (10 AM, 12 PM, 2:30 PM ET) - batch size 5
        - Next 200 stocks: 3x daily (10 AM, 12 PM, 2:30 PM ET) - batch size 10
        - Remaining 200 stocks: 1x daily (10 AM ET only) - batch size 15
        Skips when market is closed.
        """
        print("\n🚀 Global Analyst Service Started")
        print(f"🏆 Top 100 stocks: {len(self.top_100)} (batch: 5, analyzed 3x daily)")
        print(f"📊 Next 200 stocks: {len(self.next_200)} (batch: 10, analyzed 3x daily)")
        print(f"📈 Remaining 200 stocks: {len(self.remaining_200)} (batch: 15, analyzed 1x daily)")
        print(f"⏰ Schedule:")
        print(f"   - 10:00 AM ET: All 500 stocks (top 100 + next 200 + remaining 200)")
        print(f"   - 12:00 PM ET: Top 300 only (top 100 + next 200)")
        print(f"   - 2:30 PM ET: Top 300 only (top 100 + next 200)")
        print(f"⏱️  Batch delay: 20 seconds")
        print(f"💾 Database: ticker_insights table")
        print("\nPress Ctrl+C to stop...\n")
        
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
                    
                    print(f"💤 Market closed. Next run at {next_open.strftime('%Y-%m-%d %H:%M:%S %Z')}")
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
                    print(f"\n⏰ Scheduled run time reached ({now_et.strftime('%H:%M:%S %Z')})")
                    
                    # 10 AM: Analyze all 500 stocks
                    if next_hour == 10:
                        print("\n🌅 Morning Analysis - Full Coverage (500 stocks)")
                        self.analyze_all_tickers(self.top_100, "top 100", batch_size=5)
                        print("\n" + "="*80 + "\n")
                        self.analyze_all_tickers(self.next_200, "next 200", batch_size=10)
                        print("\n" + "="*80 + "\n")
                        self.analyze_all_tickers(self.remaining_200, f"remaining 200", batch_size=15)
                    # 12 PM and 2:30 PM: Top 300 only
                    else:
                        print(f"\n📊 {now_et.strftime('%I:%M %p')} Analysis - Top 300 Stocks")
                        self.analyze_all_tickers(self.top_100, "top 100", batch_size=5)
                        print("\n" + "="*80 + "\n")
                        self.analyze_all_tickers(self.next_200, "next 200", batch_size=10)
                    
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
                print(f"💤 Next run at {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')} (in {sleep_seconds/60:.1f} minutes)")
                time.sleep(min(sleep_seconds, 300))  # Check every 5 minutes max
        
        except KeyboardInterrupt:
            print("\n\n🛑 Global Analyst stopped by user")
            print("👋 Goodbye!\n")
        
        except Exception as e:
            print(f"\n❌ Fatal error: {e}")
            import traceback
            traceback.print_exc()
            print("\nGlobal Analyst stopped due to error.\n")


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
