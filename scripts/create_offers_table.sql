-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id TEXT NOT NULL REFERENCES users(uid),
    seller_id TEXT NOT NULL REFERENCES users(uid),
    total_offer_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    message TEXT
);

-- Enable RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Policies

-- Buyers can view their own offers
CREATE POLICY "Buyers can view their own offers" 
ON offers FOR SELECT 
USING (auth.uid()::text = buyer_id);

-- Sellers can view offers on their listings (where they are the seller)
CREATE POLICY "Sellers can view offers received" 
ON offers FOR SELECT 
USING (auth.uid()::text = seller_id);

-- Buyers can create offers
CREATE POLICY "Buyers can create offers" 
ON offers FOR INSERT 
WITH CHECK (auth.uid()::text = buyer_id);

-- Sellers can update status (accept/reject)
CREATE POLICY "Sellers can update offers" 
ON offers FOR UPDATE 
USING (auth.uid()::text = seller_id);

-- Buyers can update their own offers (if needed, e.g. cancel)
CREATE POLICY "Buyers can update their own offers" 
ON offers FOR UPDATE 
USING (auth.uid()::text = buyer_id);

-- Grant access to service role (backend)
GRANT ALL ON offers TO service_role;
