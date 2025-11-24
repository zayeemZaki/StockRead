"""API routes for core platform functionality."""
import time
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from core.service_manager import get_service_instance, get_service_status
from services.response_bot_service import ResponseBotService

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic models for API requests
class IngestRequest(BaseModel):
    """Request model for ingesting a post for analysis."""
    post_id: int
    ticker: str
    content: str


class AnalyzeRequest(BaseModel):
    """Request model for analyzing a ticker."""
    ticker: str
    user_post_text: Optional[str] = None


class SummarizeRequest(BaseModel):
    """Request model for summarizing insights."""
    ticker: Optional[str] = None
    post_ids: Optional[List[int]] = None


@router.post("/ingest")
async def ingest_post(request: IngestRequest):
    """
    Ingest a post for AI analysis.
    This endpoint triggers the analysis pipeline for a specific post.
    """
    try:
        # Get ResponseBot service instance
        response_bot = get_service_instance('ResponseBot')
        if not response_bot:
            # Create temporary instance if service not running
            try:
                response_bot = ResponseBotService()
            except Exception as e:
                raise HTTPException(
                    status_code=503,
                    detail=f"ResponseBot service unavailable: {str(e)}"
                )
        
        # Process the post
        result = response_bot.process_single_post(
            post_id=request.post_id,
            ticker=request.ticker.upper(),
            user_content=request.content
        )
        
        if result:
            return {
                "success": True,
                "message": f"Post #{request.post_id} processed successfully",
                "post_id": request.post_id,
                "ticker": request.ticker.upper()
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process post #{request.post_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting post: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/analyze")
async def analyze_ticker(request: AnalyzeRequest):
    """
    Analyze a ticker symbol with AI.
    Returns comprehensive market analysis including sentiment score, risk level, and summary.
    """
    try:
        from services.market_service import MarketDataService
        from services.ai_service import AIService
        
        # Initialize services
        market_service = MarketDataService()
        
        try:
            ai_service = AIService()
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"AI service unavailable: {str(e)}"
            )
        
        # Fetch market data
        market_data = market_service.get_price_context(request.ticker.upper())
        if not market_data:
            raise HTTPException(
                status_code=404,
                detail=f"Ticker {request.ticker.upper()} not found or invalid"
            )
        
        # Get additional context
        macro_context = market_service.get_macro_context()
        technicals = market_service.get_technical_analysis(request.ticker.upper())
        news = market_service.get_latest_news(request.ticker.upper())
        
        # Run AI analysis
        insight = ai_service.analyze_signal(
            ticker=request.ticker.upper(),
            market_data=market_data,
            news=news,
            technicals=technicals,
            macro_context=macro_context,
            user_post_text=request.user_post_text
        )
        
        if not insight:
            raise HTTPException(
                status_code=500,
                detail="AI analysis failed - no insight returned"
            )
        
        return {
            "success": True,
            "ticker": request.ticker.upper(),
            "analysis": insight,
            "market_data": {
                "price": market_data.get('price'),
                "market_cap": market_data.get('market_cap'),
                "pe_ratio": market_data.get('pe_ratio'),
                "analyst_rating": market_data.get('recommendationKey'),
                "target_price": market_data.get('targetMean')
            },
            "timestamp": time.time()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing ticker: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/summarize")
async def summarize_insights(request: SummarizeRequest):
    """
    Summarize insights for a ticker or set of posts.
    Returns aggregated analysis and key takeaways.
    """
    try:
        from services.db_service import DatabaseService
        
        db = DatabaseService()
        summary = {
            "success": True,
            "timestamp": time.time()
        }
        
        if request.ticker:
            # Summarize by ticker
            ticker = request.ticker.upper()
            
            # Get ticker insights
            insights_response = db.supabase.table("ticker_insights")\
                .select("*")\
                .eq("ticker", ticker)\
                .single()\
                .execute()
            
            if insights_response.data:
                summary["ticker"] = ticker
                summary["insights"] = insights_response.data
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"No insights found for ticker {ticker}"
                )
        
        elif request.post_ids:
            # Summarize by post IDs
            posts_response = db.supabase.table("posts")\
                .select("id, ticker, ai_score, ai_risk, ai_summary, created_at")\
                .in_("id", request.post_ids)\
                .execute()
            
            if posts_response.data:
                summary["posts"] = posts_response.data
                summary["count"] = len(posts_response.data)
                
                # Calculate aggregate metrics
                scores = [p.get('ai_score') for p in posts_response.data if p.get('ai_score')]
                if scores:
                    summary["aggregate"] = {
                        "avg_score": sum(scores) / len(scores),
                        "min_score": min(scores),
                        "max_score": max(scores),
                        "total_posts": len(posts_response.data)
                    }
            else:
                raise HTTPException(
                    status_code=404,
                    detail="No posts found for provided IDs"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'ticker' or 'post_ids' must be provided"
            )
        
        return summary
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error summarizing insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/services")
async def get_services_status():
    """
    Get status of all background services.
    Returns detailed information about service initialization and thread status.
    """
    current_status = get_service_status()
    
    return {
        "services": current_status,
        "total_services": len(current_status),
        "running_services": sum(1 for s in current_status.values() if s.get('thread_alive', False)),
        "failed_services": sum(1 for s in current_status.values() if not s.get('initialized', False)),
        "timestamp": time.time()
    }

