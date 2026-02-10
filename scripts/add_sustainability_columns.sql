-- Add sustainability columns to listings table
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS sustainability_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS eco_impact_data JSONB DEFAULT '{}';

-- Create index for sustainability score to allow sorting/filtering
CREATE INDEX IF NOT EXISTS idx_listings_sustainability_score ON listings(sustainability_score);
