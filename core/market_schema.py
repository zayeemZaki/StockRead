"""Pydantic schemas for validating market data from external APIs."""
from pydantic import BaseModel, Field, validator
from typing import Optional, Union
import re


def sanitize_string(value: Optional[str], max_length: int = 500) -> Optional[str]:
    """Sanitize string values to prevent injection."""
    if value is None:
        return None
    if not isinstance(value, str):
        return str(value)[:max_length]
    # Remove control characters and limit length
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    return sanitized[:max_length] if len(sanitized) <= max_length else sanitized[:max_length]


def validate_price(value: Optional[Union[float, int, str]]) -> Optional[float]:
    """Validate and coerce price values."""
    if value is None:
        return None
    try:
        price = float(value)
        # Sanity check: prices should be positive and reasonable
        if price < 0:
            return None
        if price > 1_000_000:  # Unlikely but possible (e.g., BRK.A)
            return None
        return round(price, 2)
    except (ValueError, TypeError):
        return None


def validate_ratio(value: Optional[Union[float, int, str]]) -> Optional[float]:
    """Validate and coerce ratio values (P/E, P/B, etc.)."""
    if value is None or value == 'N/A':
        return None
    try:
        ratio = float(value)
        # Ratios can be negative (losses) but should be reasonable
        if abs(ratio) > 10000:  # Unrealistic ratio
            return None
        return round(ratio, 4)
    except (ValueError, TypeError):
        return None


def validate_percentage(value: Optional[Union[float, int, str]]) -> Optional[float]:
    """Validate and coerce percentage values (0-100 or 0-1 scale)."""
    if value is None or value == 'N/A':
        return None
    try:
        pct = float(value)
        # Handle both 0-1 and 0-100 scales
        if pct > 1:
            pct = pct / 100
        # Sanity check
        if abs(pct) > 10:  # More than 1000% is suspicious
            return None
        return round(pct, 6)
    except (ValueError, TypeError):
        return None


def validate_recommendation(value: Optional[str]) -> Optional[str]:
    """Validate analyst recommendation values."""
    if value is None:
        return None
    valid_recommendations = ['buy', 'strong buy', 'hold', 'sell', 'strong sell', 'underperform', 'outperform']
    value_lower = str(value).lower().strip()
    if value_lower in valid_recommendations:
        return value_lower
    return None


class MarketDataSchema(BaseModel):
    """Schema for validating market data from yfinance and other APIs."""
    
    # Price data
    price: Optional[float] = Field(None, ge=0, le=1_000_000, description="Current stock price")
    change_percent: Optional[float] = Field(None, ge=-100, le=1000, description="Price change percentage")
    volume: Optional[int] = Field(None, ge=0, description="Trading volume")
    market_cap: Optional[str] = Field(None, max_length=50, description="Market capitalization string")
    
    # Valuation ratios
    pe_ratio: Optional[float] = Field(None, description="Price-to-earnings ratio")
    peg_ratio: Optional[float] = Field(None, description="PEG ratio")
    short_ratio: Optional[float] = Field(None, ge=0, description="Short ratio")
    forwardPE: Optional[float] = Field(None, description="Forward P/E ratio")
    priceToBook: Optional[float] = Field(None, description="Price-to-book ratio")
    enterpriseToRevenue: Optional[float] = Field(None, description="Enterprise to revenue")
    enterpriseToEbitda: Optional[float] = Field(None, description="Enterprise to EBITDA")
    beta: Optional[float] = Field(None, ge=0, description="Beta - stock volatility relative to market (1 = market average, >1 = more volatile, <1 = less volatile)")
    
    # Analyst data
    recommendationKey: Optional[str] = Field(None, max_length=20, description="Analyst recommendation")
    targetMean: Optional[float] = Field(None, ge=0, description="Average analyst target price")
    targetHigh: Optional[float] = Field(None, ge=0, description="High analyst target price")
    targetLow: Optional[float] = Field(None, ge=0, description="Low analyst target price")
    numberOfAnalystOpinions: Optional[int] = Field(None, ge=0, description="Number of analyst opinions")
    
    # Ownership data
    shortPercentOfFloat: Optional[float] = Field(None, ge=0, le=1, description="Short interest as percentage of float")
    heldPercentInsiders: Optional[float] = Field(None, ge=0, le=1, description="Insider ownership percentage")
    heldPercentInstitutions: Optional[float] = Field(None, ge=0, le=1, description="Institutional ownership percentage")
    
    # Profitability metrics
    returnOnEquity: Optional[float] = Field(None, description="Return on equity")
    returnOnAssets: Optional[float] = Field(None, description="Return on assets")
    profitMargins: Optional[float] = Field(None, ge=-1, le=1, description="Profit margin")
    operatingMargins: Optional[float] = Field(None, ge=-1, le=1, description="Operating margin")
    
    # Financial health
    debtToEquity: Optional[float] = Field(None, ge=0, description="Debt-to-equity ratio")
    currentRatio: Optional[float] = Field(None, ge=0, description="Current ratio")
    quickRatio: Optional[float] = Field(None, ge=0, description="Quick ratio")
    
    # Growth metrics
    revenueGrowth: Optional[float] = Field(None, description="Revenue growth rate")
    earningsGrowth: Optional[float] = Field(None, description="Earnings growth rate")
    
    # Dividend info
    dividendYield: Optional[float] = Field(None, ge=0, le=1, description="Dividend yield")
    payoutRatio: Optional[float] = Field(None, ge=0, le=1, description="Payout ratio")
    fiveYearAvgDividendYield: Optional[float] = Field(None, ge=0, le=1, description="5-year average dividend yield")
    
    # 52-week range
    fiftyTwoWeekHigh: Optional[float] = Field(None, ge=0, description="52-week high price")
    fiftyTwoWeekLow: Optional[float] = Field(None, ge=0, description="52-week low price")
    
    # Sector context
    sector: Optional[str] = Field(None, max_length=100, description="Sector")
    industry: Optional[str] = Field(None, max_length=200, description="Industry")
    
    @validator('price', pre=True)
    def validate_price(cls, v):
        return validate_price(v)
    
    @validator('pe_ratio', 'peg_ratio', 'forwardPE', 'priceToBook', 'enterpriseToRevenue', 'enterpriseToEbitda', 'beta', pre=True)
    def validate_ratios(cls, v):
        return validate_ratio(v)
    
    @validator('change_percent', 'returnOnEquity', 'returnOnAssets', 'profitMargins', 'operatingMargins', 
               'revenueGrowth', 'earningsGrowth', pre=True)
    def validate_percentages(cls, v):
        return validate_percentage(v)
    
    @validator('shortPercentOfFloat', 'heldPercentInsiders', 'heldPercentInstitutions', 
               'dividendYield', 'payoutRatio', 'fiveYearAvgDividendYield', pre=True)
    def validate_0_to_1_percentages(cls, v):
        return validate_percentage(v)
    
    @validator('recommendationKey', pre=True)
    def validate_recommendation(cls, v):
        return validate_recommendation(v)
    
    @validator('sector', 'industry', 'market_cap', pre=True)
    def sanitize_strings(cls, v):
        return sanitize_string(v, max_length=200)
    
    @validator('targetMean', 'targetHigh', 'targetLow', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow', pre=True)
    def validate_target_prices(cls, v):
        return validate_price(v)
    
    class Config:
        extra = 'ignore'  # Ignore extra fields from API
        validate_assignment = True

