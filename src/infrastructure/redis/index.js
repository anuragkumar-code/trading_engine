const redisClient = require('./client');

/**
 * Redis cache helper methods
 */
class RedisCache {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value
   */
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl = 3600) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   */
  async del(key) {
    try {
      await redisClient.del(key);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      return (await redisClient.exists(key)) === 1;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Increment value
   * @param {string} key - Cache key
   * @returns {Promise<number>} - New value
   */
  async incr(key) {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set expiry on key
   * @param {string} key - Cache key
   * @param {number} seconds - Seconds to expire
   */
  async expire(key, seconds) {
    try {
      await redisClient.expire(key, seconds);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get keys matching pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<Array<string>>} - Matching keys
   */
  async keys(pattern) {
    try {
      return await redisClient.keys(pattern);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete multiple keys
   * @param {Array<string>} keys - Keys to delete
   */
  async delMultiple(keys) {
    if (keys.length === 0) return;
    
    try {
      await redisClient.del(keys);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Flush all data
   */
  async flushAll() {
    try {
      await redisClient.flushAll();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = {
  redisClient,
  cache: new RedisCache(),
};