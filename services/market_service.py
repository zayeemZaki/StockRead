"""Market data service for fetching stock information from multiple sources."""
import logging
import time
import redis
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import ValidationError

import yfinance as yf
import requests
import pandas as pd
from GoogleNews import GoogleNews

from core.market_schema import MarketDataSchema

try:
    import pandas_ta as ta
    HAS_PANDAS_TA = True
except ImportError:
    HAS_PANDAS_TA = False

logger = logging.getLogger(__name__)


class MarketDataService:
    """Handles fetching and processing market data from various sources."""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Initialize Redis with graceful degradation
        try:
            from core.redis_utils import get_redis_url
            redis_url = get_redis_url()
            if redis_url:
                self.redis = redis.from_url(redis_url)
            else:
                raise ValueError("REDIS_URL not configured or invalid")
            self.redis.ping()  # Test connection
            self.redis_available = True
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Caching disabled.")
            self.redis = None
            self.redis_available = False
        
        logger.info("Market data service initialized")

    def get_macro_context(self) -> Optional[Dict[str, Any]]:
        """
        Fetch macro market context (VIX for market sentiment).
        
        Returns:
            Dictionary with VIX value and market sentiment
        """
        try:
            vix = yf.Ticker("^VIX")
            vix_price = vix.fast_info.last_price
            
            # Determine market sentiment based on VIX levels
            if vix_price < 12:
                sentiment = "Very Calm"
            elif vix_price < 20:
                sentiment = "Calm"
            elif vix_price < 30:
                sentiment = "Elevated"
            elif vix_price < 40:
                sentiment = "High Volatility"
            else:
                sentiment = "Extreme Fear"
            
            return {
                "vix": round(vix_price, 2),
                "market_sentiment": sentiment
            }
        except Exception as e:
            logger.error(f"Failed to fetch VIX data: {str(e)}")
            return {"vix": "N/A", "market_sentiment": "Unknown"}

    def get_price_context(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Fetch current price and fundamental data.
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Dictionary with price, volume, and fundamental metrics
        """
        cache_key = f"stock:price:{ticker.upper()}"
        
        # Step A: Read Cache
        if self.redis_available:
            try:
                cached_data = self.redis.get(cache_key)
                if cached_data:
                    logger.debug(f"Cache hit: ticker={ticker}, type=price_data")
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"Redis cache read error: {e}")
        
        # Step B: API Fetch
        try:
            stock = yf.Ticker(ticker)
            
            price = stock.fast_info.last_price
            prev_close = stock.fast_info.previous_close
            volume = stock.fast_info.last_volume
            
            info = stock.info
            
            change_percent = 0.0
            if prev_close:
                change_percent = ((price - prev_close) / prev_close) * 100

            mcap = info.get('marketCap', 0)
            if mcap > 1_000_000_000_000:
                mcap_str = f"${round(mcap/1_000_000_000_000, 2)}T"
            elif mcap > 1_000_000_000:
                mcap_str = f"${round(mcap/1_000_000_000, 2)}B"
            else:
                mcap_str = f"${round(mcap/1_000_000, 2)}M"

            # Build raw data dictionary
            # Try multiple field names for recommendation (yfinance may use different keys)
            recommendation = (
                info.get('recommendationKey') or 
                info.get('recommend') or 
                info.get('recommendation') or
                None
            )
            if recommendation:
                logger.debug(f"Found recommendation for {ticker}: {recommendation}")
            else:
                logger.debug(f"No recommendation found for {ticker}. Available keys: {[k for k in info.keys() if 'recommend' in k.lower() or 'analyst' in k.lower()]}")
            
            raw_data = {
                "price": price,
                "change_percent": change_percent,
                "volume": int(volume) if volume else None,
                "market_cap": mcap_str,
                "pe_ratio": info.get('trailingPE', 'N/A'),
                "peg_ratio": info.get('pegRatio', 'N/A'),
                "short_ratio": info.get('shortRatio', 'N/A'),
                # Institutional & Analyst Data (God Mode)
                "recommendationKey": recommendation,  # buy, hold, sell
                "targetMean": info.get('targetMeanPrice'),  # Analyst average target price
                "targetHigh": info.get('targetHighPrice'),  # Analyst high target
                "targetLow": info.get('targetLowPrice'),  # Analyst low target
                "numberOfAnalystOpinions": info.get('numberOfAnalystOpinions'),
                "shortPercentOfFloat": info.get('shortPercentOfFloat'),  # Short interest
                "heldPercentInsiders": info.get('heldPercentInsiders'),  # Insider ownership
                "heldPercentInstitutions": info.get('heldPercentInstitutions'),  # Institutional ownership
                # Profitability Metrics (STEP 1)
                "returnOnEquity": info.get('returnOnEquity'),  # ROE - profitability measure
                "returnOnAssets": info.get('returnOnAssets'),  # ROA - asset efficiency
                "profitMargins": info.get('profitMargins'),  # Net profit margin
                "operatingMargins": info.get('operatingMargins'),  # Operating efficiency
                # Financial Health (STEP 1)
                "debtToEquity": info.get('debtToEquity'),  # Leverage ratio
                "currentRatio": info.get('currentRatio'),  # Liquidity measure
                "quickRatio": info.get('quickRatio'),  # Liquidity without inventory
                # Growth Metrics (STEP 1)
                "revenueGrowth": info.get('revenueGrowth'),  # YoY revenue growth
                "earningsGrowth": info.get('earningsGrowth'),  # YoY earnings growth
                # Dividend Info (STEP 5)
                "dividendYield": info.get('dividendYield'),  # Dividend yield %
                "payoutRatio": info.get('payoutRatio'),  # Dividend payout ratio
                "fiveYearAvgDividendYield": info.get('fiveYearAvgDividendYield'),
                # 52-Week Range (STEP 4)
                "fiftyTwoWeekHigh": info.get('fiftyTwoWeekHigh'),
                "fiftyTwoWeekLow": info.get('fiftyTwoWeekLow'),
                # Sector Context (STEP 3)
                "sector": info.get('sector'),
                "industry": info.get('industry'),
                # Valuation
                "forwardPE": info.get('forwardPE'),  # Forward P/E
                "priceToBook": info.get('priceToBook'),  # P/B ratio
                "enterpriseToRevenue": info.get('enterpriseToRevenue'),
                "enterpriseToEbitda": info.get('enterpriseToEbitda'),
                # Beta - measures stock volatility relative to market (1 = market average, >1 = more volatile, <1 = less volatile)
                "beta": info.get('beta')
            }
            
            # Validate and sanitize data using Pydantic schema
            try:
                validated_data = MarketDataSchema(**raw_data)
                data = validated_data.dict(exclude_none=False)
            except ValidationError as e:
                logger.warning(f"Market data validation failed for {ticker}: {e.errors()}")
                # Fallback: use raw data but log validation issues
                data = raw_data
                # Try to fix critical fields manually
                if 'price' in raw_data and raw_data['price']:
                    try:
                        data['price'] = round(float(raw_data['price']), 2)
                    except (ValueError, TypeError):
                        logger.error(f"Invalid price data for {ticker}: {raw_data.get('price')}")
                        return None
            
            # Step C: Write Cache
            if self.redis_available:
                try:
                    self.redis.setex(cache_key, 60, json.dumps(data))  # 60 second TTL
                    logger.debug(f"Cached price data: ticker={ticker}")
                except Exception as e:
                    logger.warning(f"Redis cache write error: {e}")
            
            return data
            
        except Exception as e:
            logger.error(f"Failed to fetch market data for {ticker}: {str(e)}")
            return None

    def get_latest_posts(self, ticker: str, limit: int = 5) -> List[Dict[str, str]]:
        """
        Fetch latest social sentiment from StockTwits.
        
        Args:
            ticker: Stock ticker symbol
            limit: Maximum number of posts to fetch
            
        Returns:
            List of post dictionaries with text, user, and timestamp
        """
        url = f"https://api.stocktwits.com/api/2/streams/symbol/{ticker}.json"
        try:
            response = requests.get(url, headers=self.headers)
            
            if response.status_code == 200:
                data = response.json()
                messages = data.get('messages', [])
                
                clean_posts = []
                for msg in messages[:limit]:
                    body = msg['body']
                    
                    if len(body) < 15 or " " not in body: 
                        continue
                    
                    if body.count('$') > 3:
                        continue                    
                    
                    clean_posts.append({
                        "text": body,
                        "user": msg['user']['username'],
                        "time": msg['created_at']
                    })

                return clean_posts
            
            elif response.status_code == 429:
                logger.warning(f"Rate limited by StockTwits for {ticker}")
                return []
            else:
                logger.warning(f"StockTwits API returned {response.status_code} for {ticker}")
                return []
                
        except Exception as e:
            logger.error(f"Failed to fetch StockTwits data for {ticker}: {str(e)}")
            return []
        
    def get_technical_analysis(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Calculate technical indicators (RSI, SMA).
        
        Args:
            ticker: Stock ticker symbol
            
        Returns:
            Dictionary with RSI, trend, and SMA values
        """
        if not HAS_PANDAS_TA:
            logger.warning("pandas-ta not available, technical analysis disabled")
            return None
        
        cache_key = f"stock:tech:{ticker.upper()}"
        
        # Step A: Read Cache
        if self.redis_available:
            try:
                cached_data = self.redis.get(cache_key)
                if cached_data:
                    logger.debug(f"Cache hit: ticker={ticker}, type=technical_data")
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"Redis cache read error: {e}")
        
        # Step B: API Fetch
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period="1y")
            
            if df.empty:
                return None

            df.ta.rsi(length=14, append=True)
            df.ta.sma(length=20, append=True)
            df.ta.sma(length=50, append=True)
            # STEP 2: Add MACD and Bollinger Bands
            df.ta.macd(append=True)  # MACD for trend strength
            df.ta.bbands(length=20, std=2, append=True)  # Bollinger Bands for volatility
            
            latest = df.iloc[-1]
            
            rsi = round(latest['RSI_14'], 2)
            price = latest['Close']
            sma_20 = latest['SMA_20']
            sma_50 = latest['SMA_50']
            
            # STEP 2: Extract MACD values
            macd = latest.get('MACD_12_26_9', None)
            macd_signal = latest.get('MACDs_12_26_9', None)
            macd_histogram = latest.get('MACDh_12_26_9', None)
            
            # STEP 2: Extract Bollinger Bands
            bb_upper = latest.get('BBU_20_2.0', None)
            bb_middle = latest.get('BBM_20_2.0', None)
            bb_lower = latest.get('BBL_20_2.0', None)
            
            # Enhanced trend analysis with MACD
            trend = "NEUTRAL"
            if price > sma_20 and sma_20 > sma_50:
                if macd is not None and macd_signal is not None and macd > macd_signal:
                    trend = "STRONG UPTREND"
                else:
                    trend = "UPTREND"
            elif price < sma_20 and sma_20 < sma_50:
                if macd is not None and macd_signal is not None and macd < macd_signal:
                    trend = "STRONG DOWNTREND"
                else:
                    trend = "DOWNTREND"
            elif price > sma_50:
                trend = "RECOVERING"

            rsi_signal = "Neutral"
            if rsi > 70: 
                rsi_signal = "OVERBOUGHT"
            elif rsi < 30: 
                rsi_signal = "OVERSOLD"
            
            # STEP 2: Bollinger Band position (volatility context)
            bb_position = "MIDDLE"
            if bb_upper and bb_lower:
                if price >= bb_upper:
                    bb_position = "UPPER (High Volatility)"
                elif price <= bb_lower:
                    bb_position = "LOWER (High Volatility)"
                elif bb_middle and price > bb_middle:
                    bb_position = "ABOVE MIDDLE"
                elif bb_middle and price < bb_middle:
                    bb_position = "BELOW MIDDLE"
            
            # STEP 2: MACD signal
            macd_trend = "NEUTRAL"
            if macd is not None and macd_signal is not None:
                if macd > macd_signal and macd_histogram and macd_histogram > 0:
                    macd_trend = "BULLISH"
                elif macd < macd_signal and macd_histogram and macd_histogram < 0:
                    macd_trend = "BEARISH"
            
            data = {
                "current_price": round(price, 2),
                "rsi": rsi,
                "rsi_signal": rsi_signal,
                "trend": trend,
                "sma_20": round(sma_20, 2),
                "sma_50": round(sma_50, 2),
                # STEP 2: MACD data
                "macd": round(macd, 4) if macd is not None else None,
                "macd_signal": round(macd_signal, 4) if macd_signal is not None else None,
                "macd_histogram": round(macd_histogram, 4) if macd_histogram is not None else None,
                "macd_trend": macd_trend,
                # STEP 2: Bollinger Bands
                "bb_upper": round(bb_upper, 2) if bb_upper is not None else None,
                "bb_lower": round(bb_lower, 2) if bb_lower is not None else None,
                "bb_position": bb_position
            }
            
            # Step C: Write Cache
            if self.redis_available:
                try:
                    self.redis.setex(cache_key, 300, json.dumps(data))  # 300 second (5 minute) TTL
                    logger.debug(f"Cached technical data: ticker={ticker}")
                except Exception as e:
                    logger.warning(f"Redis cache write error: {e}")
            
            return data

        except Exception as e:
            logger.error(f"Failed to fetch technical analysis for {ticker}: {str(e)}")
            return None
        
    def get_latest_news(self, ticker: str, limit: int = 3) -> List[Dict[str, str]]:
        """
        Fetch latest news headlines from Google News.
        
        Args:
            ticker: Stock ticker symbol
            limit: Maximum number of articles
            
        Returns:
            List of news dictionaries with source, title, link, and date
        """
        try:
            googlenews = GoogleNews(lang='en', region='US', period='7d')
            googlenews.search(f"{ticker} stock")
            
            results = googlenews.result()
            
            news_items = []
            for item in results[:limit]:
                news_items.append({
                    "source": item['media'],
                    "title": item['title'],
                    "link": item['link'],
                    "date": item['date']
                })
            
            googlenews.clear()
            
            return news_items

        except Exception as e:
            logger.error(f"Failed to fetch news for {ticker}: {str(e)}")
            return []


def main():
    """Test the market data service."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("Starting Market Data Service Test")
    
    service = MarketDataService()
    test_tickers = ["AAPL", "TSLA", "NVDA"]

    for ticker in test_tickers:
        logger.info(f"Analyzing {ticker}")
        
        market = service.get_price_context(ticker)
        if market:
            logger.info(f"Price: ${market['price']} ({market['change_percent']}%)")
            logger.info(f"Market Cap: {market.get('market_cap')}, P/E: {market.get('pe_ratio')}")
            logger.info(f"Analyst Rating: {market.get('recommendationKey')}, Target: ${market.get('targetMean')}")
            logger.info(f"Short Float: {market.get('shortPercentOfFloat')}, Insider Hold: {market.get('heldPercentInsiders')}")
        
        techs = service.get_technical_analysis(ticker)
        if techs:
            logger.info(f"Trend: {techs['trend']}, RSI: {techs['rsi']} ({techs['rsi_signal']})")

        news = service.get_latest_news(ticker)
        if news:
            logger.info(f"Top News: {news[0]['title']} (Source: {news[0]['source']})")

        posts = service.get_latest_posts(ticker, limit=3)
        logger.info(f"Social posts: {len(posts)} found")
        
        time.sleep(1)


if __name__ == "__main__":
    main()
