-- Add active_chat_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_chat_id UUID;
