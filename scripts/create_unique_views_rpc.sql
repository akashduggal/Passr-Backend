-- Function to get unique view count
-- Logic: 
-- 1. For authenticated users (user_id IS NOT NULL): Count distinct (user_id, listing_id) pairs.
-- 2. For guest users (user_id IS NULL): Count every event as unique (since we can't track them across sessions easily without device ID).
CREATE OR REPLACE FUNCTION get_unique_view_count()
RETURNS INTEGER AS $$
DECLARE
  guest_views INTEGER;
  auth_unique_views INTEGER;
BEGIN
  -- Count all guest views
  SELECT COUNT(*) INTO guest_views
  FROM analytics_events
  WHERE event_type = 'view_item' AND user_id IS NULL;

  -- Count distinct authenticated views per item
  SELECT COUNT(DISTINCT (user_id, event_data->>'listing_id')) INTO auth_unique_views
  FROM analytics_events
  WHERE event_type = 'view_item' AND user_id IS NOT NULL;

  RETURN COALESCE(guest_views, 0) + COALESCE(auth_unique_views, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_unique_view_count() TO anon, authenticated, service_role;
