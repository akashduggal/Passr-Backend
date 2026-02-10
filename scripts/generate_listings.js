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
  Furniture: {
    titles: ['Modern Sofa', 'Study Desk', 'Ergonomic Chair', 'Bed Frame', 'Bookshelf', 'Coffee Table', 'Dining Set', 'Wardrobe', 'Nightstand', 'Lamp'],
    brands: ['IKEA', 'Wayfair', 'Ashley', 'West Elm', 'Target'],
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=80',
      'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500&q=80'
    ]
  },
  Electronics: {
    titles: ['MacBook Pro 2021', 'Sony WH-1000XM4', 'iPad Air', 'Gaming Monitor', 'Mechanical Keyboard', 'AirPods Pro', 'Nintendo Switch', 'Bluetooth Speaker', 'Kindle Paperwhite', 'USB-C Hub'],
    brands: ['Apple', 'Samsung', 'Sony', 'Dell', 'HP'],
    images: [
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'
    ]
  },
  Escooters: {
    titles: ['Xiaomi M365', 'Segway Ninebot Max', 'Gotrax GXL', 'Razor E300', 'Hiboy S2', 'Electric Scooter Foldable', 'Commuter Scooter', 'Off-road E-scooter', 'Scooter Helmet', 'Scooter Lock'],
    brands: ['Xiaomi', 'Segway', 'Razor', 'Gotrax', 'Hiboy'],
    images: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&q=80',
      'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=500&q=80'
    ]
  },
  Kitchen: {
    titles: ['Instant Pot', 'Air Fryer', 'Blender', 'Coffee Maker', 'Toaster', 'Microwave', 'Knife Set', 'Cookware Set', 'Rice Cooker', 'Food Processor'],
    brands: ['KitchenAid', 'Cuisinart', 'Instant Pot', 'Ninja', 'Hamilton Beach'],
    images: [
      'https://images.unsplash.com/photo-1584269600519-112d071b35e6?w=500&q=80',
      'https://images.unsplash.com/photo-1570222094114-28a9d88aa7d7?w=500&q=80'
    ]
  },
  Tickets: {
    titles: ['Concert Ticket: The Weeknd', 'NBA Game: Suns vs Lakers', 'Comedy Show', 'Theater Play', 'Music Festival Pass', 'Football Game', 'Art Exhibition', 'Museum Entry', 'Movie Premiere', 'Charity Gala'],
    brands: ['Concert', 'Sports', 'Theater', 'Other'],
    images: [
      'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=500&q=80',
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=500&q=80'
    ]
  }
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
        const data = SAMPLE_DATA[category];
        
        for (let i = 0; i < 1; i++) {
          const title = data.titles[i] || `${category} Item ${i + 1}`;
        const brand = data.brands[Math.floor(Math.random() * data.brands.length)];
        const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
        const livingCommunity = LIVING_COMMUNITIES[Math.floor(Math.random() * LIVING_COMMUNITIES.length)];
        const price = Math.floor(Math.random() * 200) + 10; // Random price between 10 and 210
        const coverImage = data.images[i % data.images.length];
        
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
