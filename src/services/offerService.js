const supabase = require('../config/supabase');

class OfferService {
    // Convert DB model (snake_case) to App model (camelCase)
    _toAppModel(dbOffer) {
        if (!dbOffer) return null;
        const { 
            buyer_id, seller_id, total_offer_amount, created_at, updated_at, 
            ...rest 
        } = dbOffer;
        
        return {
            ...rest,
            buyerId: buyer_id,
            sellerId: seller_id,
            totalOfferAmount: Number(total_offer_amount),
            offerAmount: Number(total_offer_amount), // Alias for frontend compatibility
            createdAt: created_at,
            updatedAt: updated_at
        };
    }

    // Convert App model (camelCase) to DB model (snake_case)
    _toDbModel(appOffer) {
        const { 
            buyerId, sellerId, totalOfferAmount, createdAt, updatedAt, 
            ...rest 
        } = appOffer;

        const dbModel = {
            ...rest,
            buyer_id: buyerId,
            seller_id: sellerId,
            total_offer_amount: totalOfferAmount,
            created_at: createdAt,
            updated_at: updatedAt
        };

        // Remove undefined fields
        Object.keys(dbModel).forEach(key => 
            dbModel[key] === undefined && delete dbModel[key]
        );

        return dbModel;
    }

    async createOffer(offerData) {
        const dbOffer = this._toDbModel(offerData);
        
        const { data, error } = await supabase
            .from('offers')
            .insert(dbOffer)
            .select()
            .single();

        if (error) throw error;
        return this._toAppModel(data);
    }

    async getOfferById(offerId) {
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('id', offerId)
            .single();

        if (error) return null;
        return this._toAppModel(data);
    }

    async getOffersByBuyerId(buyerId) {
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('buyer_id', buyerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(offer => this._toAppModel(offer));
    }

    async getOffersBySellerId(sellerId) {
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(offer => this._toAppModel(offer));
    }

    async updateOffer(offerId, updates) {
        const dbUpdates = this._toDbModel(updates);
        
        const { data, error } = await supabase
            .from('offers')
            .update(dbUpdates)
            .eq('id', offerId)
            .select()
            .single();

        if (error) throw error;
        return this._toAppModel(data);
    }

    async getOffersByListingId(listingId) {
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .contains('items', JSON.stringify([{ id: listingId }]))
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(offer => this._toAppModel(offer));
    }

    // Used to count offers for a specific listing
    async getOfferCountForListing(listingId) {
        // We use the @> operator to check if the items array contains an object with the matching id
        // Note: The ID in the JSON array must match the type (string/number) exactly
        const { count, error } = await supabase
            .from('offers')
            .select('*', { count: 'exact', head: true })
            .contains('items', JSON.stringify([{ id: listingId }]));

        if (error) {
            console.error('Error counting offers for listing:', error);
            return 0;
        }
        return count;
    }

    // Helper to check if an offer exists for a listing by a user
    // This is hard with JSONB items array without exact structure match
    // But usually we just want to know if *any* offer exists?
    // The previous code checked `newOffer.sellerId === newOffer.buyerId`
    // and created chats.
    
    // Get all offers (only for migration/debugging, careful with this)
    async getAllOffers() {
        const { data, error } = await supabase
            .from('offers')
            .select('*');
            
        if (error) throw error;
        return data.map(offer => this._toAppModel(offer));
    }
}

module.exports = new OfferService();
