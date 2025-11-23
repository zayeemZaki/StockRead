"""AI service for stock analysis using Google's Gemini model."""
import logging
import json
import os
from typing import Dict, Any, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

API_KEY = os.environ.get("GOOGLE_API_KEY")
if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables")

genai.configure(api_key=API_KEY)


class AIService:
    """Handles AI-powered stock analysis using Gemini."""
    
    def __init__(self):
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
        
        tech_trend = technicals.get('trend', 'Unknown') if technicals else 'Unknown'
        tech_rsi = (
            f"{technicals.get('rsi', 'N/A')} ({technicals.get('rsi_signal', 'N/A')})" 
            if technicals else 'N/A'
        )
        
        price = market_data.get('price', 'N/A')
        mcap = market_data.get('market_cap', 'N/A')
        pe = market_data.get('pe_ratio', 'N/A')
        short_ratio = market_data.get('short_ratio', 'N/A')
        
        # Milestone 19: Institutional Data
        target_mean = market_data.get('targetMean', None)
        recommendation = market_data.get('recommendationKey', None)
        short_float = market_data.get('shortPercentOfFloat', None)
        insider_ownership = market_data.get('heldPercentInsiders', None)
        
        # Milestone 19: Macro Context
        vix_status = "Unknown"
        vix_value = "N/A"
        if macro_context:
            vix_value = macro_context.get('vix', 'N/A')
            vix_status = macro_context.get('market_sentiment', 'Unknown')

        prompt = f"""
        You are the Chief Investment Officer AI for 'Stock Read'.
        Your job is to provide an OBJECTIVE market analysis for {ticker}, then compare it to the user's thesis.
        
        ═══════════════════════════════════════════════════════════════════════════
        📊 SECTION 1: THE EVIDENCE (100% OBJECTIVE - NO USER BIAS)
        ═══════════════════════════════════════════════════════════════════════════
        
        🌍 MACRO CONTEXT:
        - Market Mood: {vix_status} (VIX: {vix_value})
        
        📈 FUNDAMENTALS & PRICE:
        - Current Price: ${price}
        - Market Cap: {mcap}
        - P/E Ratio: {pe}
        - Short Ratio: {short_ratio}
        
        🏛️ INSTITUTIONAL DATA (Wall Street Intelligence):
        - Analyst Target: ${target_mean if target_mean else 'N/A'}
        - Analyst Consensus: {recommendation if recommendation else 'N/A'}
        - Short Float: {(short_float * 100) if short_float else 'N/A'}%
        - Insider Ownership: {(insider_ownership * 100) if insider_ownership else 'N/A'}%
        
        📉 TECHNICAL ANALYSIS:
        - Trend: {tech_trend}
        - RSI: {tech_rsi}
        
        📰 NEWS HEADLINES:
        {news_summary}
        
        ═══════════════════════════════════════════════════════════════════════════
        🎯 OBJECTIVE MARKET SCORE CALCULATION (DO NOT LET USER INFLUENCE THIS)
        ═══════════════════════════════════════════════════════════════════════════
        
        Weight the evidence as follows:
        - Fundamentals: 25% (P/E ratio, market cap, institutional data)
        - Technicals: 25% (trend, RSI)
        - News: 30% (sentiment from headlines)
        - Institutional: 20% (analyst target vs price, short float, insider ownership)
        
        Apply these OBJECTIVE RULES:
        1. VIX RULE: If VIX > 30 (Extreme Fear), reduce bullish scores by 10-15 points
           (Exception: Defensive sectors like utilities, healthcare get immunity)
        2. VALUATION RULE: If price is 20%+ below analyst target, add 5-10 bullish points
        3. SHORT SQUEEZE RULE: If short float > 20%, flag potential volatility
        4. INSIDER CONFIDENCE RULE: If insider ownership > 15%, add 5 bullish points
        
        Calculate your OBJECTIVE Market Score (0-100) based ONLY on the evidence above.
        
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
            "summary": "2-3 sentences. Start with the OBJECTIVE market reality (score + key factors). Then compare to user's thesis. Mention specific God Mode factors (analyst target gap, short squeeze risk, insider confidence, VIX impact).",
            "sentiment_score": <YOUR OBJECTIVE MARKET SCORE 0-100>,
            "risk_level": "Low" | "Medium" | "High" | "Extreme",
            "tags": ["Tag1", "Tag2", "Tag3"]
        }}
        
        CRITICAL RULES:
        - "sentiment_score" = Your OBJECTIVE Market Score (ignore user's opinion)
        - "user_thesis" = What the user thinks (extracted from their text)
        - "summary" = First state objective reality, then compare to user's view
        - Risk factors: High VIX + High Short Float + Overvalued = Extreme Risk
        """

        try:
            response = self.model.generate_content(prompt)
            result = json.loads(response.text)
            logger.info(f"Successfully analyzed {ticker}")
            return result
        except Exception as e:
            logger.error(f"AI analysis failed for {ticker}: {str(e)}")
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
            logger.error(f"Batch analysis failed: {e}")
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
