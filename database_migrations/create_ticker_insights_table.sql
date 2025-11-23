-- Create ticker_insights table for Global Analyst Service
-- Stores AI-driven market analysis for all S&P 500 stocks

CREATE TABLE IF NOT EXISTS ticker_insights (
    -- Primary key
    ticker TEXT PRIMARY KEY,
    
    -- AI Analysis Results
    ai_score INTEGER NOT NULL,                    -- Objective market score (0-100)
    ai_signal TEXT NOT NULL,                      -- Trading signal: 'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'
    ai_risk TEXT NOT NULL,                        -- Risk level: 'Low', 'Medium', 'High', 'Extreme'
    ai_summary TEXT NOT NULL,                     -- AI-generated market analysis summary
    
    -- Current Market Data
    current_price DOUBLE PRECISION,               -- Current stock price
    market_cap TEXT,                              -- Market capitalization (formatted string)
    pe_ratio DOUBLE PRECISION,                    -- Price-to-Earnings ratio
    
    -- God Mode - Institutional Data
    analyst_rating TEXT,                          -- Analyst consensus rating (buy/hold/sell)
    target_price DOUBLE PRECISION,                -- Analyst price target
    short_float DOUBLE PRECISION,                 -- Short interest as percentage of float
    insider_held DOUBLE PRECISION,                -- Insider ownership percentage
    
    -- Macro Context
    vix DOUBLE PRECISION,                         -- VIX volatility index at analysis time
    market_sentiment TEXT,                        -- Market mood: 'Extreme Fear', 'Neutral', 'Complacency'
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on updated_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_ticker_insights_updated_at ON ticker_insights(updated_at DESC);

-- Create index on ai_signal for filtering by signal type
CREATE INDEX IF NOT EXISTS idx_ticker_insights_signal ON ticker_insights(ai_signal);

-- Create index on ai_score for filtering by score range
CREATE INDEX IF NOT EXISTS idx_ticker_insights_score ON ticker_insights(ai_score DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE ticker_insights ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (anyone can view market insights)
CREATE POLICY "Allow public read access to ticker insights"
    ON ticker_insights
    FOR SELECT
    USING (true);

-- Create policy to allow service role to insert/update (for the global_analyst service)
CREATE POLICY "Allow service role to upsert ticker insights"
    ON ticker_insights
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Add comment to table
COMMENT ON TABLE ticker_insights IS 'Global AI-driven market analysis for S&P 500 stocks. Updated every 30 minutes by the Global Analyst service.';

-- Add comments to key columns
COMMENT ON COLUMN ticker_insights.ai_score IS 'Objective market score (0-100) based on fundamentals, technicals, news, and institutional data';
COMMENT ON COLUMN ticker_insights.ai_signal IS 'Trading signal derived from ai_score: Strong Buy (80+), Buy (60+), Hold (40+), Sell (20+), Strong Sell (<20)';
COMMENT ON COLUMN ticker_insights.ai_summary IS 'AI-generated summary explaining the market reality for this stock';
