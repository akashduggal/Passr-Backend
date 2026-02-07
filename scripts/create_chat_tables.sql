-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id TEXT NOT NULL,
    participants TEXT[] NOT NULL,
    offer_id UUID REFERENCES offers(id),
    last_message JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(uid),
    content TEXT,
    image_url TEXT,
    message_type TEXT DEFAULT 'text',
    schedule_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Grant access to service role
GRANT ALL ON chats TO service_role;
GRANT ALL ON messages TO service_role;

-- Policies for chats
CREATE POLICY "Users can view their chats" ON chats
    FOR SELECT USING (auth.uid()::text = ANY(participants));

CREATE POLICY "Users can insert chats" ON chats
    FOR INSERT WITH CHECK (auth.uid()::text = ANY(participants));

CREATE POLICY "Users can update their chats" ON chats
    FOR UPDATE USING (auth.uid()::text = ANY(participants));

-- Policies for messages
CREATE POLICY "Users can view messages in their chats" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND auth.uid()::text = ANY(chats.participants)
        )
    );

CREATE POLICY "Users can insert messages in their chats" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND auth.uid()::text = ANY(chats.participants)
        )
    );
