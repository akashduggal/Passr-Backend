-- Create Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    event_type VARCHAR(50) NOT NULL, -- 'view_item', 'search', 'click_category', 'filter_usage'
    event_data JSONB DEFAULT '{}'::jsonb, -- e.g. { "query": "iphone", "category": "electronics" }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster querying
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);

-- RLS Policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own events
CREATE POLICY "Users can insert their own events" 
ON analytics_events FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow admins/service_role to view all events
CREATE POLICY "Admins can view all events" 
ON analytics_events FOR SELECT 
TO service_role 
USING (true);

-- Create a helper function to log events (optional, but good for RPC calls)
CREATE OR REPLACE FUNCTION log_analytics_event(
    p_event_type TEXT,
    p_event_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (user_id, event_type, event_data)
    VALUES (auth.uid(), p_event_type, p_event_data)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$;
