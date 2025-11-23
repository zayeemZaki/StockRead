-- Add full_name and bio columns to profiles table
-- Run this in your Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Optional: Add a check constraint to limit bio length
ALTER TABLE profiles 
ADD CONSTRAINT bio_length_check 
CHECK (length(bio) <= 160);
