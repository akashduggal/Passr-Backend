-- Create users table
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  picture TEXT,
  last_seen TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  expo_push_token TEXT,
  email_verified BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) if needed, but for backend access via service key it might not be strictly necessary unless we use client-side access too.
-- For now, we can leave it or enable it.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow full access to service role (backend)
CREATE POLICY "Allow full access to service role" ON users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to view their own data
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT
  USING (auth.uid()::text = uid);

-- Allow authenticated users to update their own data
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE
  USING (auth.uid()::text = uid);
