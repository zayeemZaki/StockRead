"""
Application-wide configuration constants
Centralized configuration to avoid magic numbers and improve maintainability
"""
import os
from typing import Final

# API Timeouts (in seconds)
AI_API_TIMEOUT: Final[int] = int(os.getenv("AI_API_TIMEOUT", "60"))
NEWS_API_TIMEOUT: Final[int] = 30
MARKET_DATA_TIMEOUT: Final[int] = 15

# Cache TTL (in seconds)
CACHE_TTL_STOCK_PRICE: Final[int] = 300  # 5 minutes
CACHE_TTL_NEWS: Final[int] = 3600  # 1 hour
CACHE_TTL_MARKET_DATA: Final[int] = 300  # 5 minutes

# Retry Configuration
MAX_RETRIES: Final[int] = 3
RETRY_BACKOFF_MS: Final[int] = 500
NEWS_FETCH_DELAY_MS: Final[int] = 500

# News Validation
MIN_TITLE_LENGTH: Final[int] = 10
MAX_SPECIAL_CHAR_RATIO: Final[float] = 0.3
NEWS_PER_FETCH: Final[int] = 100

# VIX Sentiment Thresholds
VIX_VERY_CALM: Final[int] = 12
VIX_CALM: Final[int] = 20
VIX_ELEVATED: Final[int] = 30
VIX_HIGH_VOLATILITY: Final[int] = 40

# Market Sentiment Labels
SENTIMENT_VERY_CALM: Final[str] = "Very Calm"
SENTIMENT_CALM: Final[str] = "Calm"
SENTIMENT_ELEVATED: Final[str] = "Elevated"
SENTIMENT_HIGH_VOLATILITY: Final[str] = "High Volatility"
SENTIMENT_EXTREME_FEAR: Final[str] = "Extreme Fear"
SENTIMENT_UNKNOWN: Final[str] = "Unknown"

# AI Analysis Valid Values
VALID_USER_THESIS: Final[tuple] = ('Bullish', 'Bearish', 'Neutral')
VALID_RISK_LEVELS: Final[tuple] = ('Low', 'Medium', 'High', 'Extreme')
DEFAULT_USER_THESIS: Final[str] = 'Neutral'
DEFAULT_RISK_LEVEL: Final[str] = 'Medium'
DEFAULT_SENTIMENT_SCORE: Final[int] = 50

# URL Tracking Parameters to Remove
TRACKING_PARAMS: Final[tuple] = (
    'ved', 'usg', 'utm_source', 'utm_medium', 'utm_campaign',
    'utm_term', 'utm_content', 'gclid', 'fbclid', '_ga'
)

# News Validation - Spam Keywords
SPAM_KEYWORDS: Final[tuple] = (
    'click here', 'buy now', 'limited time', 'act now',
    'free money', 'get rich'
)

# Suspicious URL Shorteners
SUSPICIOUS_DOMAINS: Final[tuple] = (
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl'
)

# Bot User Configuration
BOT_USER_ID: Final[str] = os.getenv("BOT_USER_ID", "2de4618e-25af-4ebc-a572-f92b7954fb0e")

