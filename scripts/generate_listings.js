require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { calculateSustainabilityMetrics } = require('../src/utils/sustainabilityCalculator');

// Try to load .env from project root if not found
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CATEGORIES = ['Furniture', 'Electronics', 'Escooters', 'Kitchen', 'Tickets'];
const CONDITIONS = ['New', 'Like New', 'Fair', 'Good'];
const LIVING_COMMUNITIES = ['The Hyve', 'Paseo on University', 'Skye at McClintock', 'Tooker', 'The Villas on Apache', 'Union Tempe', 'The District on Apache'];

const SAMPLE_DATA = {
  Furniture: [
    { title: 'Modern Sofa', brand: 'IKEA', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=80' },
    { title: 'Study Desk', brand: 'Wayfair', image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500&q=80' },
    { title: 'Ergonomic Chair', brand: 'Herman Miller', image: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=500&q=80' },
    { title: 'Bed Frame', brand: 'Ashley', image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=500&q=80' },
    { title: 'Bookshelf', brand: 'West Elm', image: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=500&q=80' },
    { title: 'Coffee Table', brand: 'Target', image: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=500&q=80' },
    { title: 'Dining Set', brand: 'IKEA', image: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=500&q=80' },
    { title: 'Wardrobe', brand: 'IKEA', image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500&q=80' },
    { title: 'Nightstand', brand: 'Wayfair', image: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=500&q=80' },
    { title: 'Lamp', brand: 'Target', image: 'https://images.unsplash.com/photo-1507473888900-52e1ad145924?w=500&q=80' }
  ],
  Electronics: [
    { title: 'MacBook Pro 2021', brand: 'Apple', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80' },
    { title: 'Sony WH-1000XM4', brand: 'Sony', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80' },
    { title: 'iPad Air', brand: 'Apple', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&q=80' },
    { title: 'Gaming Monitor', brand: 'Dell', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80' },
    { title: 'Mechanical Keyboard', brand: 'Keychron', image: 'https://images.unsplash.com/photo-1587829741301-dc798b91a603?w=500&q=80' },
    { title: 'AirPods Pro', brand: 'Apple', image: 'https://images.unsplash.com/photo-1603351154351-5cf99bc3292d?w=500&q=80' },
    { title: 'Nintendo Switch', brand: 'Nintendo', image: 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=500&q=80' },
    { title: 'Bluetooth Speaker', brand: 'JBL', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80' },
    { title: 'Kindle Paperwhite', brand: 'Amazon', image: 'https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=500&q=80' },
    { title: 'USB-C Hub', brand: 'Anker', image: 'https://images.unsplash.com/photo-1625766763788-95dcce9bf5ac?w=500&q=80' }
  ],
  Escooters: [
    { title: 'Xiaomi M365', brand: 'Xiaomi', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&q=80' },
    { title: 'Segway Ninebot Max', brand: 'Segway', image: 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=500&q=80' },
    { title: 'Gotrax GXL', brand: 'Gotrax', image: 'https://images.unsplash.com/photo-1620802051782-421712a7622d?w=500&q=80' },
    { title: 'Razor E300', brand: 'Razor', image: 'https://images.unsplash.com/photo-1595562137699-b39f6071869e?w=500&q=80' },
    { title: 'Hiboy S2', brand: 'Hiboy', image: 'https://images.unsplash.com/photo-1605152276897-4f618f831968?w=500&q=80' },
    { title: 'Electric Scooter Foldable', brand: 'Generic', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c3d?w=500&q=80' },
    { title: 'Commuter Scooter', brand: 'Segway', image: 'https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=500&q=80' },
    { title: 'Off-road E-scooter', brand: 'Apollo', image: 'https://images.unsplash.com/photo-1618397351688-64c92cb002b8?w=500&q=80' },
    { title: 'Scooter Helmet', brand: 'Thousand', image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500&q=80' },
    { title: 'Scooter Lock', brand: 'Kryptonite', image: 'https://images.unsplash.com/photo-1502444330042-d1a1ddf9bb5b?w=500&q=80' }
  ],
  Kitchen: [
    { title: 'Instant Pot', brand: 'Instant Pot', image: 'https://images.unsplash.com/photo-1584269600519-112d071b35e6?w=500&q=80' },
    { title: 'Air Fryer', brand: 'Ninja', image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&q=80' },
    { title: 'Blender', brand: 'Vitamix', image: 'https://images.unsplash.com/photo-1570222094114-28a9d88aa7d7?w=500&q=80' },
    { title: 'Coffee Maker', brand: 'Keurig', image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500&q=80' },
    { title: 'Toaster', brand: 'Cuisinart', image: 'https://images.unsplash.com/photo-1609159320875-977038e244b7?w=500&q=80' },
    { title: 'Microwave', brand: 'Panasonic', image: 'https://images.unsplash.com/photo-1585659722983-3a675bad627e?w=500&q=80' },
    { title: 'Knife Set', brand: 'Henckels', image: 'https://images.unsplash.com/photo-1593642532400-2682810df593?w=500&q=80' },
    { title: 'Cookware Set', brand: 'T-fal', image: 'https://images.unsplash.com/photo-1584990347449-a0846b1e1631?w=500&q=80' },
    { title: 'Rice Cooker', brand: 'Zojirushi', image: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=500&q=80' },
    { title: 'Food Processor', brand: 'Cuisinart', image: 'https://images.unsplash.com/photo-1585514611466-9b0d5c2182c8?w=500&q=80' }
  ],
  Tickets: [
    { title: 'Concert Ticket: The Weeknd', brand: 'Concert', image: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=500&q=80' },
    { title: 'NBA Game: Suns vs Lakers', brand: 'Sports', image: 'https://images.unsplash.com/photo-1504454125957-d32eec0f33ee?w=500&q=80' },
    { title: 'Comedy Show', brand: 'Theater', image: 'https://images.unsplash.com/photo-1585699324551-f6012dc992c9?w=500&q=80' },
    { title: 'Theater Play', brand: 'Theater', image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=500&q=80' },
    { title: 'Music Festival Pass', brand: 'Concert', image: 'https://images.unsplash.com/photo-1459749411177-8c4750bb0e5e?w=500&q=80' },
    { title: 'Football Game', brand: 'Sports', image: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=500&q=80' },
    { title: 'Art Exhibition', brand: 'Museum', image: 'https://images.unsplash.com/photo-1518998053901-5348d3969104?w=500&q=80' },
    { title: 'Museum Entry', brand: 'Museum', image: 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?w=500&q=80' },
    { title: 'Movie Premiere', brand: 'Cinema', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&q=80' },
    { title: 'Charity Gala', brand: 'Event', image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=500&q=80' }
  ]
};

const userIds = process.argv.slice(2);

if (userIds.length === 0) {
  console.error('Error: Please provide at least one User ID as an argument.');
  console.error('Usage: node scripts/generate_listings.js <user_id_1> <user_id_2> ...');
  process.exit(1);
}

async function generateListings() {
  console.log(`Starting listing generation for User IDs: ${userIds.join(', ')}...`);

  try {
    for (const userId of userIds) {
      console.log(`Processing User ID: ${userId}...`);
      
      // Verify user exists first
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('uid')
        .eq('uid', userId)
        .single();

      if (userError || !user) {
        console.error(`Error: User with ID ${userId} not found. Skipping...`);
        continue;
      }

      const listings = [];

      for (const category of CATEGORIES) {
        console.log(`  Generating listings for ${category}...`);
        const categoryItems = SAMPLE_DATA[category];
        
        for (let i = 0; i < 5; i++) {
          const item = categoryItems[i % categoryItems.length];
          const title = item.title;
          const brand = item.brand;
          const coverImage = item.image;

          const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
          const livingCommunity = LIVING_COMMUNITIES[Math.floor(Math.random() * LIVING_COMMUNITIES.length)];
          const price = Math.floor(Math.random() * 200) + 10; // Random price between 10 and 210
          
          const listing = {
            seller_id: userId,
            title: title,
            description: `This is a gently used ${title} from ${brand}. Great condition and perfect for students!`,
            price: price,
            category: category,
            condition: condition,
            brand: brand,
            living_community: livingCommunity,
            cover_image: coverImage,
            images: [coverImage],
            status: 'active',
            urgent: Math.random() < 0.2, // 20% chance of being urgent
            posted_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Expires in 30 days
          };

        // Calculate sustainability metrics
        const { sustainabilityScore, ecoImpactData } = calculateSustainabilityMetrics({
            category: listing.category,
            condition: listing.condition,
            livingCommunity: listing.living_community
        });

        listing.sustainability_score = sustainabilityScore;
        listing.eco_impact_data = ecoImpactData;

        if (category === 'Tickets') {
          const eventDate = new Date();
          eventDate.setDate(eventDate.getDate() + Math.floor(Math.random() * 30)); // Event in next 30 days
          listing.event_date = eventDate.toISOString();
          listing.venue = 'ASU Gammage';
        }

        listings.push(listing);
      }
      }

      if (listings.length > 0) {
        const { error } = await supabase.from('listings').insert(listings);

        if (error) {
          console.error(`Failed to insert listings for user ${userId}: ${error.message}`);
        } else {
          console.log(`✅ Successfully generated ${listings.length} listings for user ${userId}!`);
        }
      }
    }

    // Generate Analytics Events
    console.log('\nGenerating Analytics Events (Views)...');
    const { data: allListings } = await supabase.from('listings').select('id, category, price');
    
    if (allListings && allListings.length > 0) {
      const events = [];
      // Generate random views for random listings
      allListings.forEach(listing => {
        // 50% chance to have views
        if (Math.random() > 0.5) {
          const viewCount = Math.floor(Math.random() * 20) + 1; // 1 to 20 views
          for (let k = 0; k < viewCount; k++) {
            // Pick a random user from the provided list as the viewer
            const viewerId = userIds[Math.floor(Math.random() * userIds.length)];
            
            events.push({
              user_id: viewerId,
              event_type: 'view_item',
              event_data: { 
                listing_id: listing.id, 
                category: listing.category,
                price: listing.price 
              },
              // Random time in last 30 days
              created_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString()
            });
          }
        }
      });

      if (events.length > 0) {
        // Insert in batches of 100 to avoid limits
        for (let i = 0; i < events.length; i += 100) {
          const batch = events.slice(i, i + 100);
          const { error: eventError } = await supabase.from('analytics_events').insert(batch);
          if (eventError) {
             console.error('Error inserting analytics batch:', eventError.message);
          }
        }
        console.log(`✅ Generated ${events.length} view events.`);
      }
    }

  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    process.exit(1);
  }
}

generateListings();
