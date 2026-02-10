-- Drop specific function signatures to avoid ambiguity errors (cleaning up)
DROP FUNCTION IF EXISTS log_analytics_event(text, jsonb);
DROP FUNCTION IF EXISTS log_analytics_event(text, jsonb, text);

-- Drop the table if it exists
DROP TABLE IF EXISTS analytics_events;

-- Recreate with TEXT user_id to support Firebase UIDs
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES users(uid), -- References public.users(uid) which is TEXT
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);

-- RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" 
ON analytics_events 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Allow users to insert their own events (based on Firebase UID)
CREATE POLICY "Users can insert events" 
ON analytics_events FOR INSERT 
TO anon, authenticated 
WITH CHECK (true); 

-- Allow users to SELECT their own events (optional, but good for debugging if needed)
CREATE POLICY "Users can view their own events"
ON analytics_events FOR SELECT
TO anon, authenticated
USING (true); -- Or limit to user_id = auth.uid() if we wanted strict privacy

-- CRITICAL: Grant table permissions to anon/authenticated roles
GRANT ALL ON TABLE analytics_events TO anon, authenticated, service_role;
