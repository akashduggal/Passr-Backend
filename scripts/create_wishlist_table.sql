-- Create wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- Enable RLS
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- Policies

-- Users can view their own wishlist
CREATE POLICY "Users can view their own wishlist" 
ON wishlist FOR SELECT 
USING (auth.uid()::text = user_id);

-- Users can add to their wishlist
CREATE POLICY "Users can add to their wishlist" 
ON wishlist FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

-- Users can remove from their wishlist
CREATE POLICY "Users can remove from their wishlist" 
ON wishlist FOR DELETE 
USING (auth.uid()::text = user_id);

-- Grant access to service role (backend)
GRANT ALL ON wishlist TO service_role;
