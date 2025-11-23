#!/usr/bin/env python3
"""
One-time script to populate ticker_insights table with all S&P 500 stocks.
Uses batch size of 15 stocks per AI request to save quota.
Run this once to seed the database, then use global_analyst.py for scheduled updates.
"""

import sys
import os
import time
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.market_service import MarketDataService
from services.ai_service import AIService
from services.db_service import DatabaseService
from market_maker import get_sp500_tickers


def populate_all_insights():
    """
    One-time population of all S&P 500 stock insights.
    Batch size: 15 stocks per request
    Delay: 20 seconds between batches
    Total: ~497 stocks / 15 = ~34 batches = ~34 AI requests
    Time estimate: ~12 minutes (34 batches × 20 seconds)
    """
    print("\n" + "="*80)
    print("🚀 S&P 500 Initial Insights Population")
    print("="*80)
    print(f"⏰ Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📦 Batch size: 15 stocks per AI request")
    print(f"⏱️  Delay: 20 seconds between batches")
    print(f"💾 Database: ticker_insights table")
    print("="*80 + "\n")
    
    # Initialize services
    print("🔧 Initializing services...")
    market = MarketDataService()
    ai = AIService()
    db = DatabaseService()
    
    # Get all S&P 500 tickers
    print("📊 Loading S&P 500 tickers...")
    tickers = get_sp500_tickers()
    print(f"✅ Loaded {len(tickers)} tickers\n")

    # Skip the first 100 tickers alphabetically
    try:
        sorted_tickers = sorted(tickers)
        skip_count = 100
        skip_set = set(sorted_tickers[:skip_count])
        tickers = [t for t in tickers if t not in skip_set]
        # Log a brief preview of skipped tickers
        preview = ", ".join(sorted_tickers[:5])
        print(f"🚫 Skipping {skip_count} alphabetically first tickers (preview: {preview} ...)")
        print(f"➡️  Proceeding with {len(tickers)} tickers after skip.\n")
    except Exception as e:
        print(f"⚠️  Failed to apply skip logic: {e}\n")
    
    # Fetch macro context once
    print("🌍 Fetching macro market context (VIX)...")
    macro_context = market.get_macro_context()
    if macro_context:
        print(f"   📊 VIX: {macro_context['vix']} | Sentiment: {macro_context['market_sentiment']}\n")
    
    # Track statistics
    total_analyzed = 0
    total_saved = 0
    start_time = time.time()
    batch_size = 15
    
    # Process in batches of 15
    for i in range(0, len(tickers), batch_size):
        batch = tickers[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(tickers) + batch_size - 1) // batch_size
        
        print(f"\n📦 Batch {batch_num}/{total_batches}: {', '.join(batch)}")
        
        # Analyze this batch
        try:
            results = analyze_batch(batch, macro_context, market, ai, db)
            total_analyzed += len(results)
            total_saved += len(results)
            print(f"   ✅ Analyzed and saved {len(results)}/{len(batch)} stocks")
        except Exception as e:
            print(f"   ❌ Batch failed: {e}")
            continue
        
        # Wait 20 seconds before next batch (except last batch)
        if i + batch_size < len(tickers):
            print(f"   ⏳ Waiting 20 seconds before next batch...")
            time.sleep(20)
    
    # Print summary
    elapsed = time.time() - start_time
    elapsed_mins = elapsed / 60
    
    print(f"\n" + "="*80)
    print(f"✅ Population Complete!")
    print(f"   📊 Total Stocks Analyzed: {total_analyzed}/{len(tickers)}")
    print(f"   💾 Total Saved to DB: {total_saved}")
    print(f"   ⏱️  Time Elapsed: {elapsed_mins:.1f} minutes ({elapsed:.0f} seconds)")
    print(f"   ⏰ Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80 + "\n")
    
    print("🎉 Database populated successfully!")
    print("📌 Next step: Run 'py services/global_analyst.py' for scheduled updates\n")


def analyze_batch(tickers: list, macro_context: dict, market: MarketDataService, 
                  ai: AIService, db: DatabaseService) -> list:
    """
    Analyze a batch of stocks and save to database.
    
    Args:
        tickers: List of stock symbols (up to 15)
        macro_context: Market-wide context (VIX, etc.)
        market: Market data service instance
        ai: AI service instance
        db: Database service instance
    
    Returns:
        List of successfully analyzed tickers
    """
    # Fetch market data for all tickers in batch
    batch_data = []
    for ticker in tickers:
        try:
            data = market.get_price_context(ticker)
            if data:
                batch_data.append({
                    'ticker': ticker,
                    'price': data['price'],
                    'change_percent': data['change_percent'],
                    'volume': data['volume'],
                    'market_cap': data['market_cap'],
                    'pe_ratio': data['pe_ratio'],
                    'peg_ratio': data.get('peg_ratio', 'N/A'),
                    'short_ratio': data.get('short_ratio', 'N/A')
                })
        except Exception as e:
            print(f"   ⚠️  {ticker}: Failed to fetch data - {e}")
            continue
    
    if not batch_data:
        return []
    
    # Create batch prompt
    prompt = _create_batch_prompt(batch_data, macro_context)
    
    # Get AI analysis
    try:
        response = ai.analyze_with_gemini(prompt)
        if not response:
            print(f"   ❌ AI returned no response")
            return []
        
        # Parse the response
        insights = _parse_batch_response(response, batch_data)
        
        # Save to database
        saved_tickers = []
        for insight in insights:
            try:
                # Save to ticker_insights table
                db.supabase.table('ticker_insights').upsert({
                    'ticker': insight['ticker'],
                    'ai_score': insight['ai_score'],
                    'ai_signal': insight['ai_signal'],
                    'ai_risk': insight['ai_risk'],
                    'ai_summary': insight.get('analysis', ''),  # Use 'ai_summary' instead of 'analysis'
                    'updated_at': datetime.now().isoformat()
                }, on_conflict='ticker').execute()
                
                saved_tickers.append(insight['ticker'])
            except Exception as e:
                print(f"   ⚠️  {insight['ticker']}: Failed to save - {e}")
        
        return saved_tickers
        
    except Exception as e:
        print(f"   ❌ AI analysis failed: {e}")
        return []


def _create_batch_prompt(batch_data: list, macro_context: dict) -> str:
    """Create a compact prompt for batch analysis"""
    # Build compact JSON array of stocks
    stocks_json = "[\n"
    for i, stock in enumerate(batch_data):
        stocks_json += f'  {{"ticker": "{stock["ticker"]}", "price": {stock["price"]}, '
        stocks_json += f'"change": {stock["change_percent"]}%, "pe": {stock["pe_ratio"]}, '
        stocks_json += f'"mcap": "{stock["market_cap"]}"}}'
        if i < len(batch_data) - 1:
            stocks_json += ","
        stocks_json += "\n"
    stocks_json += "]"
    
    prompt = f"""Analyze these {len(batch_data)} stocks and provide investment scores. Return ONLY a JSON array.

VIX: {macro_context.get('vix', 'N/A')} | Market Sentiment: {macro_context.get('market_sentiment', 'Neutral')}

Stocks to analyze:
{stocks_json}

For EACH stock, provide:
- ai_score (0-100): Investment quality score
- ai_signal: "Strong Buy" / "Buy" / "Hold" / "Sell" / "Strong Sell"
- ai_risk: "Low" / "Medium" / "High" / "Extreme"
- analysis: Brief 2-sentence reasoning

Return ONLY this JSON array (no markdown, no code blocks):
[
  {{"ticker": "AAPL", "ai_score": 75, "ai_signal": "Buy", "ai_risk": "Medium", "analysis": "Strong fundamentals..."}},
  ...
]"""
    
    return prompt


def _parse_batch_response(response: str, batch_data: list) -> list:
    """Parse AI response and extract insights for each ticker"""
    import json
    import re
    
    # Try to extract JSON array from response
    # Remove markdown code blocks if present
    clean_response = re.sub(r'```json\s*', '', response)
    clean_response = re.sub(r'```\s*', '', clean_response)
    clean_response = clean_response.strip()
    
    try:
        insights = json.loads(clean_response)
        
        # Validate we got a list
        if not isinstance(insights, list):
            print(f"   ⚠️  Expected JSON array, got {type(insights)}")
            return []
        
        # Validate each insight has required fields
        valid_insights = []
        for insight in insights:
            if all(key in insight for key in ['ticker', 'ai_score', 'ai_signal', 'ai_risk']):
                valid_insights.append(insight)
        
        return valid_insights
        
    except json.JSONDecodeError as e:
        print(f"   ⚠️  Failed to parse JSON: {e}")
        print(f"   Response preview: {clean_response[:200]}...")
        return []


if __name__ == "__main__":
    try:
        populate_all_insights()
    except KeyboardInterrupt:
        print("\n\n🛑 Population stopped by user")
        print("👋 You can resume later - existing data is saved\n")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        print("\nPopulation stopped due to error.\n")
