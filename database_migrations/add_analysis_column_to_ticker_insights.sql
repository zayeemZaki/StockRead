-- Migration to add 'analysis' column to ticker_insights table
-- This column stores detailed AI-generated analysis for each stock

ALTER TABLE ticker_insights
ADD COLUMN analysis TEXT DEFAULT '';

-- Add comment to the new column
COMMENT ON COLUMN ticker_insights.analysis IS 'Detailed AI-generated analysis for each stock';