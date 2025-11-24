"""AI service for stock analysis using Google's Gemini model."""
import logging
import json
import os
import re
from typing import Dict, Any, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv
from pydantic import BaseModel, Field, validator, ValidationError

load_dotenv()

logger = logging.getLogger(__name__)


from core.security import sanitize_log_message


class AIAnalysisResult(BaseModel):
    """Pydantic model for validating AI analysis output."""
    user_thesis: str = Field(..., description="User sentiment: Bullish, Bearish, or Neutral")
    summary: str = Field(..., description="2-3 sentence analysis summary")
    sentiment_score: int = Field(..., ge=0, le=100, description="Objective market score 0-100")
    risk_level: str = Field(..., description="Risk level: Low, Medium, High, or Extreme")
    tags: List[str] = Field(default_factory=list, description="Analysis tags")
    
    @validator('user_thesis')
    def validate_user_thesis(cls, v):
        """Validate user_thesis is one of the expected values."""
        valid_values = ['Bullish', 'Bearish', 'Neutral']
        v_normalized = v.strip().capitalize()
        if v_normalized not in valid_values:
            logger.warning(f"Invalid user_thesis value: {v}, defaulting to Neutral")
            return 'Neutral'
        return v_normalized
    
    @validator('risk_level')
    def validate_risk_level(cls, v):
        """Validate risk_level is one of the expected values."""
        valid_values = ['Low', 'Medium', 'High', 'Extreme']
        v_normalized = v.strip().capitalize()
        if v_normalized not in valid_values:
            logger.warning(f"Invalid risk_level value: {v}, defaulting to Medium")
            return 'Medium'
        return v_normalized
    
    @validator('sentiment_score')
    def validate_sentiment_score(cls, v):
        """Ensure sentiment_score is within valid range."""
        if isinstance(v, float):
            v = int(round(v))
        if not isinstance(v, int):
            try:
                v = int(float(v))
            except (ValueError, TypeError):
                logger.warning(f"Invalid sentiment_score type: {type(v)}, defaulting to 50")
                return 50
        return max(0, min(100, v))  # Clamp to 0-100
    
    @validator('tags')
    def validate_tags(cls, v):
        """Ensure tags is a list."""
        if not isinstance(v, list):
            if isinstance(v, str):
                # Try to parse comma-separated string
                v = [tag.strip() for tag in v.split(',')]
            else:
                logger.warning(f"Invalid tags type: {type(v)}, defaulting to empty list")
                return []
        return [str(tag) for tag in v if tag]  # Convert all to strings and filter empty
    
    class Config:
        extra = 'ignore'  # Ignore extra fields from LLM


class AIService:
    """Handles AI-powered stock analysis using Gemini."""
    
    def __init__(self):
        """Initialize AI service with Google Gemini API."""
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables. Required for AI analysis.")
        
        # Store masked version for logging (never log actual key)
        self._api_key_masked = f"{api_key[:8]}***MASKED***" if len(api_key) > 8 else "***MASKED***"
        
        try:
            genai.configure(api_key=api_key)
        except Exception as e:
            # Sanitize error message before logging
            error_msg = sanitize_log_message(str(e))
            logger.error(f"Failed to configure Gemini API: {error_msg}")
            raise ValueError(f"Failed to configure Gemini API: {error_msg}")
        
        self.model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            generation_config={"response_mime_type": "application/json"}
        )
        logger.info("AI service initialized with Gemini 2.5 Flash")

    def analyze_signal(
        self, 
        ticker: str, 
        market_data: Dict[str, Any], 
        news: List[Dict[str, str]],
        technicals: Optional[Dict[str, Any]], 
        macro_context: Optional[Dict[str, Any]] = None,
        user_post_text: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Synthesize multiple data sources into objective investment signal.
        User's thesis is analyzed separately to avoid bias.
        
        Args:
            ticker: Stock ticker symbol
            market_data: Dictionary with price and fundamental data
            news: List of news articles
            technicals: Dictionary with technical indicators
            macro_context: Dictionary with VIX and market sentiment (Milestone 19)
            user_post_text: User's thesis/post text (analyzed separately)
            
        Returns:
            Dictionary with analysis results including sentiment score and risk level
        """
        news_summary = "No recent news."
        if news and len(news) > 0:
            news_summary = "\n".join([
                f"- [{n.get('source', 'Unknown')}] {n.get('title', '')}" 
                for n in news[:3]
            ])

        user_thesis_text = user_post_text if user_post_text else "No user thesis provided."
        
        # Technical Analysis (Enhanced)
        tech_trend = technicals.get('trend', 'Unknown') if technicals else 'Unknown'
        tech_rsi = (
            f"{technicals.get('rsi', 'N/A')} ({technicals.get('rsi_signal', 'N/A')})" 
            if technicals else 'N/A'
        )
        macd_trend = technicals.get('macd_trend', 'N/A') if technicals else 'N/A'
        bb_position = technicals.get('bb_position', 'N/A') if technicals else 'N/A'
        
        # Price & Fundamentals
        price = market_data.get('price', 'N/A')
        mcap = market_data.get('market_cap', 'N/A')
        pe = market_data.get('pe_ratio', 'N/A')
        forward_pe = market_data.get('forwardPE', 'N/A')
        peg = market_data.get('peg_ratio', 'N/A')
        pb = market_data.get('priceToBook', 'N/A')
        
        # Profitability & Growth (STEP 1)
        roe = market_data.get('returnOnEquity', None)
        profit_margin = market_data.get('profitMargins', None)
        revenue_growth = market_data.get('revenueGrowth', None)
        earnings_growth = market_data.get('earningsGrowth', None)
        
        # Financial Health (STEP 1)
        debt_to_equity = market_data.get('debtToEquity', None)
        current_ratio = market_data.get('currentRatio', None)
        
        # 52-Week Range (STEP 4)
        week_52_high = market_data.get('fiftyTwoWeekHigh', None)
        week_52_low = market_data.get('fiftyTwoWeekLow', None)
        distance_from_high = None
        distance_from_low = None
        if week_52_high and isinstance(price, (int, float)):
            distance_from_high = ((week_52_high - price) / week_52_high) * 100
        if week_52_low and isinstance(price, (int, float)):
            distance_from_low = ((price - week_52_low) / week_52_low) * 100
        
        # Dividend (STEP 5)
        div_yield = market_data.get('dividendYield', None)
        payout_ratio = market_data.get('payoutRatio', None)
        
        # Sector Context (STEP 3)
        sector = market_data.get('sector', 'Unknown')
        industry = market_data.get('industry', 'Unknown')
        
        # Institutional Data
        target_mean = market_data.get('targetMean', None)
        recommendation = market_data.get('recommendationKey', None)
        short_float = market_data.get('shortPercentOfFloat', None)
        insider_ownership = market_data.get('heldPercentInsiders', None)
        
        # Macro Context
        vix_status = "Unknown"
        vix_value = "N/A"
        if macro_context:
            vix_value = macro_context.get('vix', 'N/A')
            vix_status = macro_context.get('market_sentiment', 'Unknown')

        prompt = f"""
        You are the Chief Investment Officer AI for 'Stock Read'.
        Your job is to provide an OBJECTIVE market analysis for {ticker}, then compare it to the user's thesis.
        
        ═══════════════════════════════════════════════════════════════════════════
        SECTION 1: THE EVIDENCE (100% OBJECTIVE - NO USER BIAS)
        ═══════════════════════════════════════════════════════════════════════════
        
        MACRO CONTEXT:
        - Market Mood: {vix_status} (VIX: {vix_value})
        
        SECTOR & INDUSTRY:
        - Sector: {sector}
        - Industry: {industry}
        
        VALUATION & FUNDAMENTALS:
        - Current Price: ${price}
        - Market Cap: {mcap}
        - Trailing P/E: {pe}
        - Forward P/E: {forward_pe}
        - PEG Ratio: {peg}
        - Price/Book: {pb}
        
        PROFITABILITY & GROWTH:
        - Return on Equity: {(roe * 100) if roe else 'N/A'}%
        - Profit Margin: {(profit_margin * 100) if profit_margin else 'N/A'}%
        - Revenue Growth: {(revenue_growth * 100) if revenue_growth else 'N/A'}%
        - Earnings Growth: {(earnings_growth * 100) if earnings_growth else 'N/A'}%
        
        FINANCIAL HEALTH:
        - Debt/Equity: {debt_to_equity if debt_to_equity else 'N/A'}
        - Current Ratio: {current_ratio if current_ratio else 'N/A'}
        
        DIVIDEND (if applicable):
        - Dividend Yield: {(div_yield * 100) if div_yield else 'N/A'}%
        - Payout Ratio: {(payout_ratio * 100) if payout_ratio else 'N/A'}%
        
        52-WEEK RANGE ANALYSIS:
        - 52W High: ${week_52_high if week_52_high else 'N/A'}
        - 52W Low: ${week_52_low if week_52_low else 'N/A'}
        - Distance from High: {round(distance_from_high, 1) if distance_from_high else 'N/A'}%
        - Distance from Low: +{round(distance_from_low, 1) if distance_from_low else 'N/A'}%
        
        INSTITUTIONAL DATA (Wall Street Intelligence):
        - Analyst Target: ${target_mean if target_mean else 'N/A'}
        - Analyst Consensus: {recommendation if recommendation else 'N/A'}
        - Short Float: {(short_float * 100) if short_float else 'N/A'}%
        - Insider Ownership: {(insider_ownership * 100) if insider_ownership else 'N/A'}%
        
        TECHNICAL ANALYSIS (Enhanced):
        - Trend: {tech_trend}
        - RSI: {tech_rsi}
        - MACD Signal: {macd_trend}
        - Bollinger Band Position: {bb_position}
        
        NEWS HEADLINES:
        {news_summary}
        
        ═══════════════════════════════════════════════════════════════════════════
        OBJECTIVE MARKET SCORE CALCULATION (DO NOT LET USER INFLUENCE THIS)
        ═══════════════════════════════════════════════════════════════════════════
        
        Weight the evidence as follows:
        - Fundamentals & Profitability: 15% (P/E, ROE, margins, growth rates)
        - Technicals: 25% (trend, RSI, MACD, Bollinger Bands)
        - News Sentiment: 20% (headline sentiment)
        - Institutional/Consensus: 40% (analyst target, ratings, institutional holdings) - PRIMARY DRIVER
        
        Apply these OBJECTIVE RULES:
        
        1. TARGET PRICE UPSIDE RULE (PRIMARY SCORE DRIVER):
           - 15%+ below target → Score 70-85 (Strong Buy)
           - 10-15% below target → Score 65-75 (Buy)
           - 5-10% below target → Score 55-65 (Hold/Accumulate)
           - At or above target → Score 40-55 (Hold/Trim)
           - Target price upside OVERRIDES valuation concerns when consensus is Buy/Strong Buy
        
        2. VALUATION CONTEXT RULES:
           a) MAGNIFICENT 7 PREMIUM (NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA):
              - P/E 25-50 is NORMAL if consensus is Buy/Strong Buy
              - Call it "Premium Valuation" NOT "Overvaluation"
              - PEG < 2.0 validates premium multiples
           
           b) GROWTH STOCKS (Revenue Growth > 20%):
              - Forward P/E more important than trailing P/E
              - PEG Ratio < 1.5 = Attractive, even if P/E seems high
              - Strong earnings growth (>25%) justifies P/E up to 40
           
           c) VALUE STOCKS (P/E < 15, Dividend Yield > 3%):
              - Focus on ROE, profit margins, debt levels
              - Current Ratio > 1.5 = Strong balance sheet
              - Dividend yield + payout ratio sustainability matters
           
           d) SECTOR-RELATIVE VALUATION:
              - Tech: P/E 20-35 is normal
              - Healthcare/Pharma: P/E 15-25 is normal
              - Utilities/REITs: Focus on dividend yield (3-5%)
              - Financials: Use P/B ratio, target < 1.5
        
        3. PROFITABILITY QUALITY RULES:
           - ROE > 15% = Excellent (add 5-10 points)
           - ROE 10-15% = Good (neutral)
           - ROE < 10% = Weak (subtract 5 points)
           - Profit Margin > 20% = High quality business
           - Debt/Equity > 2.0 = Financial risk (subtract 5 points unless in Financials sector)
        
        4. 52-WEEK RANGE MOMENTUM RULES:
           - Within 5% of 52W High + RSI < 70 = Bullish Breakout (add 10 points)
           - Within 5% of 52W High + RSI > 75 = Overbought Risk (subtract 5 points)
           - Within 10% of 52W Low + Positive Consensus = Deep Value Buy (add 15 points)
           - Within 10% of 52W Low + Negative Consensus = Falling Knife (subtract 10 points)
        
        5. TECHNICAL CONFLUENCE RULES:
           - UPTREND + MACD Bullish + RSI 40-60 = Strong Technical Setup (add 10 points)
           - DOWNTREND + MACD Bearish + RSI < 40 = Avoid (subtract 15 points)
           - Bollinger Band Lower + RSI < 30 = Oversold Bounce Setup (add 10 points if fundamentals solid)
           - Bollinger Band Upper + RSI > 70 = Overbought (subtract 5 points)
        
        6. VIX & MACRO RULES:
           - VIX > 30 (Extreme Fear): Reduce bullish scores by 10-15 points
             Exception: Defensive sectors (Utilities, Healthcare, Consumer Staples) immune
           - VIX < 15 (Complacency): Add 5 points to quality stocks
        
        7. INSTITUTIONAL CONFIDENCE RULES:
           - Insider Ownership > 15% = Strong confidence (add 5 points)
           - Short Float > 20% = High volatility risk (flag in risk assessment)
           - Short Float > 30% + Positive news = Potential squeeze (add 10 points to risk but note opportunity)
        
        8. DIVIDEND QUALITY RULES (for Income Stocks):
           - Yield 3-5% + Payout Ratio < 70% = Sustainable (add 5 points)
           - Yield > 6% + Payout Ratio > 80% = Dividend risk (subtract 5 points)
           - No dividend for growth stocks = Neutral (don't penalize)
        
        Calculate your OBJECTIVE Market Score (0-100) based on these weighted factors and rules.
        
        ═══════════════════════════════════════════════════════════════════════════
        💭 SECTION 2: USER THESIS COMPARISON (SUBJECTIVE ANALYSIS)
        ═══════════════════════════════════════════════════════════════════════════
        
        User's Thesis:
        "{user_thesis_text}"
        
        Now compare:
        1. What sentiment is the user expressing? (Bullish/Bearish/Neutral)
        2. Does it AGREE or DISAGREE with your Objective Market Score?
        3. If they disagree, explain WHY the market data suggests otherwise
        4. If they agree, validate their reasoning with specific evidence
        
        ═══════════════════════════════════════════════════════════════════════════
        📤 OUTPUT FORMAT
        ═══════════════════════════════════════════════════════════════════════════
        
        {{
            "user_thesis": "Bullish" | "Bearish" | "Neutral",
            "summary": "2-3 sentences maximum. Start with OBJECTIVE score and PRIMARY DRIVER (target upside, technical setup, or profitability). Include key factors: ROE/margins, 52W position, MACD/BB signals, sector context. Compare to user thesis. Use 'Premium Valuation' for quality growth stocks, not 'Overvaluation'.",
            "sentiment_score": <YOUR OBJECTIVE MARKET SCORE 0-100>,
            "risk_level": "Low" | "Medium" | "High" | "Extreme",
            "tags": ["Tag1", "Tag2", "Tag3"]
        }}
        
        CRITICAL OUTPUT RULES:
        - "sentiment_score" = Objective Market Score (0-100), user opinion does NOT influence this
        - PRIMARY DRIVERS for score (in order):
          1. Target Price Upside vs Current Price
          2. Technical Confluence (Trend + MACD + RSI + Bollinger Bands)
          3. Profitability Quality (ROE, margins, growth rates)
          4. 52-Week Range Position + Momentum
        - "summary" structure: "[Score] driven by [primary factor]. [Key supporting data]. [User comparison]."
        - Risk assessment: VIX + Short Float + Debt/Equity + Technical Breakdown + Negative Consensus
        - Growth stocks: Use Forward P/E and PEG, mention "Premium Valuation" if justified
        - Value stocks: Focus on yield, ROE, and balance sheet strength
        - Tags: Include sector, signal type, and key characteristic (e.g., "Technology", "Strong Buy", "High Growth")
        """

        max_retries = 2
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(prompt)
                raw_text = response.text
                
                # Attempt to parse JSON with fallback strategies
                parsed_result = self._parse_llm_response(raw_text, ticker)
                
                if parsed_result:
                    # Validate with Pydantic schema
                    validated_result = self._validate_analysis_result(parsed_result, ticker)
                    if validated_result:
                        logger.info(f"Successfully analyzed {ticker}")
                        return validated_result
                
                # If we get here, parsing/validation failed
                if attempt < max_retries - 1:
                    logger.warning(f"Retry {attempt + 1}/{max_retries} for {ticker} after parse failure")
                    continue
                else:
                    logger.error(f"AI analysis failed for {ticker} after {max_retries} attempts: Invalid response format")
                    return None
                    
            except Exception as e:
                error_msg = sanitize_log_message(str(e))
                if attempt < max_retries - 1:
                    logger.warning(f"Retry {attempt + 1}/{max_retries} for {ticker} after error: {error_msg}")
                    continue
                else:
                    logger.error(f"AI analysis failed for {ticker} after {max_retries} attempts: {error_msg}")
                    return None
        
        return None
    
    def _parse_llm_response(self, raw_text: str, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Parse LLM response with multiple fallback strategies.
        
        Args:
            raw_text: Raw text response from LLM
            ticker: Ticker symbol for logging
            
        Returns:
            Parsed dictionary or None if all strategies fail
        """
        if not raw_text or not raw_text.strip():
            logger.error(f"Empty response from LLM for {ticker}")
            return None
        
        # Strategy 1: Direct JSON parse
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            pass
        
        # Strategy 2: Extract JSON from markdown code blocks
        try:
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL | re.IGNORECASE)
            if json_match:
                return json.loads(json_match.group(1))
        except (json.JSONDecodeError, AttributeError):
            pass
        
        # Strategy 3: Find JSON object in text (look for { ... })
        try:
            # Find the first { and last } that might contain JSON
            start_idx = raw_text.find('{')
            end_idx = raw_text.rfind('}')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = raw_text[start_idx:end_idx + 1]
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        # Strategy 4: Try to fix common JSON issues
        try:
            # Remove trailing commas, fix quotes, etc.
            cleaned = raw_text.strip()
            # Remove markdown formatting
            cleaned = re.sub(r'```json\s*', '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'```\s*', '', cleaned)
            # Try parsing again
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass
        
        logger.error(f"Failed to parse LLM response for {ticker}. Raw text (first 500 chars): {raw_text[:500]}")
        return None
    
    def _validate_analysis_result(self, parsed_result: Dict[str, Any], ticker: str) -> Optional[Dict[str, Any]]:
        """
        Validate parsed result against Pydantic schema with fallback.
        
        Args:
            parsed_result: Parsed dictionary from LLM
            ticker: Ticker symbol for logging
            
        Returns:
            Validated dictionary or None if validation fails
        """
        try:
            # Validate with Pydantic
            validated = AIAnalysisResult(**parsed_result)
            return validated.dict()
        except ValidationError as e:
            logger.warning(f"Validation error for {ticker}: {e.errors()}")
            
            # Fallback: Try to construct valid result from partial data
            try:
                fallback_result = {
                    'user_thesis': parsed_result.get('user_thesis', 'Neutral'),
                    'summary': parsed_result.get('summary', 'Analysis unavailable'),
                    'sentiment_score': int(parsed_result.get('sentiment_score', 50)),
                    'risk_level': parsed_result.get('risk_level', 'Medium'),
                    'tags': parsed_result.get('tags', [])
                }
                
                # Validate fallback
                validated_fallback = AIAnalysisResult(**fallback_result)
                logger.info(f"Used fallback validation for {ticker}")
                return validated_fallback.dict()
            except (ValidationError, ValueError, TypeError) as fallback_error:
                logger.error(f"Fallback validation also failed for {ticker}: {fallback_error}")
                return None

    def analyze_with_gemini(self, prompt: str) -> Optional[str]:
        """Generic prompt-based analysis used by batch insight population.

        Args:
            prompt: The full instruction string expecting JSON output.
        Returns:
            Raw text response from Gemini (expected to be JSON) or None on failure.
        """
        try:
            response = self.model.generate_content(prompt)
            logger.info("Batch prompt analyzed successfully")
            return response.text
        except Exception as e:
            error_msg = sanitize_log_message(str(e))
            logger.error(f"Batch analysis failed: {error_msg}")
            return None


def main():
    """Test the AI service."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("AI Service test - Please run main.py for full system test")


if __name__ == "__main__":
    main()
