const supabase = require('../config/supabase');

class UserService {
  // Helper to map DB model (snake_case) to App model (camelCase)
  _toAppModel(dbUser) {
    if (!dbUser) return null;
    const { 
      last_seen, 
      updated_at, 
      expo_push_token, 
      ...rest 
    } = dbUser;

    return {
      ...rest,
      lastSeen: last_seen,
      updatedAt: updated_at,
      expoPushToken: expo_push_token
    };
  }

  // Helper to map App model to DB model
  _toDbModel(appUser) {
    const { 
      lastSeen, 
      updatedAt, 
      expoPushToken, 
      ...rest 
    } = appUser;

    const dbUser = { ...rest };
    if (lastSeen !== undefined) dbUser.last_seen = lastSeen;
    if (updatedAt !== undefined) dbUser.updated_at = updatedAt;
    if (expoPushToken !== undefined) dbUser.expo_push_token = expoPushToken;

    return dbUser;
  }

  /**
   * Sync user data to Supabase (Upsert)
   * @param {Object} userData - The user data to sync
   * @returns {Promise<Object>} - The synced user data
   */
  async syncUser(userData) {
    const { uid, email, name, picture, ...otherData } = userData;
    
    const appUserPayload = {
      uid,
      email,
      name,
      picture,
      lastSeen: new Date().toISOString(),
      ...otherData
    };

    const dbPayload = this._toDbModel(appUserPayload);

    // Upsert user based on uid
    const { data, error } = await supabase
      .from('users')
      .upsert(dbPayload, { onConflict: 'uid' })
      .select()
      .single();

    if (error) {
      throw new Error(`Error syncing user: ${error.message}`);
    }

    return this._toAppModel(data);
  }

  /**
   * Get user by ID
   * @param {string} uid - The user ID
   * @returns {Promise<Object|null>} - The user data or null if not found
   */
  async getUserById(uid) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // code for no rows returned
            return null;
        }
      throw new Error(`Error fetching user: ${error.message}`);
    }

    return this._toAppModel(data);
  }

  /**
   * Get multiple users by IDs
   * @param {Array<string>} uids - Array of user IDs
   * @returns {Promise<Array<Object>>} - Array of user objects
   */
  async getUsersByIds(uids) {
    if (!uids || uids.length === 0) return [];

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('uid', uids);

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    return data.map(user => this._toAppModel(user));
  }

  /**
   * Update user profile
   * @param {string} uid - The user ID
   * @param {Object} updates - The updates to apply
   * @returns {Promise<Object>} - The updated user data
   */
  async updateUser(uid, updates) {
    const appUpdates = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const dbUpdates = this._toDbModel(appUpdates);

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('uid', uid)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }

    return this._toAppModel(data);
  }

  /**
   * Delete user
   * @param {string} uid - The user ID
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteUser(uid) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('uid', uid);

    if (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }

    return true;
  }
}

module.exports = new UserService();
