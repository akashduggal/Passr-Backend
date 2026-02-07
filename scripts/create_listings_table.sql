-- Create listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT REFERENCES users(uid) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  category TEXT,
  condition TEXT,
  brand TEXT,
  living_community TEXT,
  urgent BOOLEAN DEFAULT FALSE,
  event_date TIMESTAMP WITH TIME ZONE,
  venue TEXT,
  cover_image TEXT,
  images TEXT[], -- Array of image URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sold BOOLEAN DEFAULT FALSE,
  sold_to_user_id TEXT REFERENCES users(uid),
  status TEXT DEFAULT 'active' -- active, sold, expired, etc.
);

-- Enable Row Level Security (RLS)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow full access to service role (backend)
CREATE POLICY "Allow full access to service role" ON listings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow everyone to view active listings
CREATE POLICY "Anyone can view active listings" ON listings
  FOR SELECT
  USING (true);

-- Allow authenticated users to create listings
CREATE POLICY "Users can create listings" ON listings
  FOR INSERT
  WITH CHECK (auth.uid()::text = seller_id);

-- Allow sellers to update their own listings
CREATE POLICY "Sellers can update their own listings" ON listings
  FOR UPDATE
  USING (auth.uid()::text = seller_id);

-- Allow sellers to delete their own listings
CREATE POLICY "Sellers can delete their own listings" ON listings
  FOR DELETE
  USING (auth.uid()::text = seller_id);

-- Create indexes for common filters
CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_created_at ON listings(created_at);
