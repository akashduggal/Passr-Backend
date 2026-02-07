-- Enable Realtime for chat tables
-- Run this in your Supabase SQL Editor

begin;
  -- Remove if already exists to avoid error
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table chats;
