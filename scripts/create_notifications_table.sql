-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id TEXT NOT NULL REFERENCES users(uid),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    type TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Grant access to service role
GRANT ALL ON notifications TO service_role;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO anon;

-- Policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid()::text = recipient_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid()::text = recipient_id);

-- Index on recipient_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
