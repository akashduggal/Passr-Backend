require('dotenv').config({ path: '../.env' }); // Load env from parent dir if running from scripts/
// If running from root of backend, path might need adjustment. 
// Assuming running from Passr-Backend root as `node scripts/clear_data.js` or similar.
// Actually, looking at other scripts, they might assume .env is in root.
// Let's try to load .env relative to the script location or current working directory.

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Try to load .env from project root
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearData() {
  console.log('Starting data cleanup...');
  console.log('Preserving users table.');

  try {
    // 1. Clear messages
    console.log('Clearing messages...');
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to delete all rows since .delete() requires a filter
    
    if (messagesError) throw new Error(`Error clearing messages: ${messagesError.message}`);
    
    // 2. Clear chats
    console.log('Clearing chats...');
    const { error: chatsError } = await supabase
      .from('chats')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (chatsError) throw new Error(`Error clearing chats: ${chatsError.message}`);

    // 3. Clear wishlist
    console.log('Clearing wishlist...');
    const { error: wishlistError } = await supabase
      .from('wishlist')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (wishlistError) throw new Error(`Error clearing wishlist: ${wishlistError.message}`);

    // 4. Clear offers
    console.log('Clearing offers...');
    const { error: offersError } = await supabase
      .from('offers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (offersError) throw new Error(`Error clearing offers: ${offersError.message}`);

    // 5. Clear listings
    console.log('Clearing listings...');
    const { error: listingsError } = await supabase
      .from('listings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (listingsError) throw new Error(`Error clearing listings: ${listingsError.message}`);

    // 6. Clear notifications
    console.log('Clearing notifications...');
    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
      
    if (notificationsError) throw new Error(`Error clearing notifications: ${notificationsError.message}`);

    console.log('✅ Data cleanup complete! Users table preserved.');

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

clearData();
