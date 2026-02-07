const { supabase } = require('../config/supabase');
const listingService = require('./listingService');

class WishlistService {
  /**
   * Get user's wishlist
   * @param {string} userId 
   * @returns {Promise<Array>} List of listings in wishlist
   */
  async getWishlist(userId) {
    const { data, error } = await supabase
      .from('wishlist')
      .select(`
        listing_id,
        created_at,
        listings (
          *
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wishlist:', error);
      throw new Error('Failed to fetch wishlist');
    }

    // Flatten and map to app model
    return data
      .filter(item => item.listings) // Filter out nulls if any
      .map(item => {
        const appListing = listingService._toAppModel(item.listings);
        return {
          ...appListing,
          addedAt: item.created_at
        };
      });
  }

  /**
   * Add item to wishlist
   * @param {string} userId 
   * @param {string} listingId 
   */
  async addToWishlist(userId, listingId) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .single();

    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from('wishlist')
      .insert({
        user_id: userId,
        listing_id: listingId
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding to wishlist:', error);
      throw new Error('Failed to add to wishlist');
    }

    return data;
  }

  /**
   * Remove item from wishlist
   * @param {string} userId 
   * @param {string} listingId 
   */
  async removeFromWishlist(userId, listingId) {
    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId);

    if (error) {
      console.error('Error removing from wishlist:', error);
      throw new Error('Failed to remove from wishlist');
    }
  }

  /**
   * Check if listing is in wishlist
   * @param {string} userId 
   * @param {string} listingId 
   */
  async checkWishlistStatus(userId, listingId) {
    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      console.error('Error checking wishlist status:', error);
    }

    return !!data;
  }
}

module.exports = new WishlistService();
