# Database Migrations

This directory contains SQL migration scripts for setting up the Stock Read database schema in Supabase.

## Setup Instructions

1. Run these migrations in order in your Supabase SQL Editor:
   - `create_ticker_insights_table.sql` - Creates the main AI insights table
   - `enable_delete_policies.sql` - Sets up Row Level Security policies for deletions

2. For frontend-specific migrations:
   - `../frontend/database_migration_settings.sql` - Adds profile fields (full_name, bio)

## Migration Files

### `create_ticker_insights_table.sql`
Creates the `ticker_insights` table that stores AI-driven market analysis for S&P 500 stocks. This table is used by:
- `services/global_analyst.py` - Batch analysis service
- `populate_all_insights.py` - One-time population script

### `enable_delete_policies.sql`
Sets up Row Level Security (RLS) policies allowing users to:
- Delete their own posts, comments, and reactions
- Delete comments/reactions on their own posts

## Notes

- These migrations must be run manually in Supabase SQL Editor
- The `ticker_insights` table uses `ai_summary` column (not `analysis`)
- All migrations use `IF NOT EXISTS` or `IF EXISTS` for idempotency

