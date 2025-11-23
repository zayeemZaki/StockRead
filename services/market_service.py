"""Market data service for fetching stock information from multiple sources."""
import logging
import time
from typing import Dict, Any, List, Optional
from datetime import datetime

import yfinance as yf
import requests
import pandas as pd
from GoogleNews import GoogleNews

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

            return {
                "price": round(price, 2),
                "change_percent": round(change_percent, 2),
                "volume": int(volume),
                "market_cap": mcap_str,
                "pe_ratio": info.get('trailingPE', 'N/A'),
                "peg_ratio": info.get('pegRatio', 'N/A'),
                "short_ratio": info.get('shortRatio', 'N/A')
            }
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
            
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period="1y")
            
            if df.empty:
                return None

            df.ta.rsi(length=14, append=True)
            df.ta.sma(length=20, append=True)
            df.ta.sma(length=50, append=True)
            
            latest = df.iloc[-1]
            
            rsi = round(latest['RSI_14'], 2)
            price = latest['Close']
            sma_20 = latest['SMA_20']
            sma_50 = latest['SMA_50']
            
            trend = "NEUTRAL"
            if price > sma_20 and sma_20 > sma_50:
                trend = "UPTREND (Strong)"
            elif price < sma_20 and sma_20 < sma_50:
                trend = "DOWNTREND (Weak)"
            elif price > sma_50:
                trend = "RECOVERING"

            rsi_signal = "Neutral"
            if rsi > 70: 
                rsi_signal = "OVERBOUGHT (Risk of Pullback)"
            elif rsi < 30: 
                rsi_signal = "OVERSOLD (Potential Bounce)"
            
            return {
                "current_price": round(price, 2),
                "rsi": rsi,
                "rsi_signal": rsi_signal,
                "trend": trend,
                "sma_20": round(sma_20, 2),
                "sma_50": round(sma_50, 2)
            }

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
