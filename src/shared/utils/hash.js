const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class Hash {
  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if match
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Hash API key using SHA-256
   * @param {string} apiKey - Plain API key
   * @returns {string} - Hashed API key
   */
  hashApiKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  /**
   * Generate random API key
   * @param {number} length - Length of API key
   * @returns {string} - Random API key
   */
  generateApiKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash any data using SHA-256
   * @param {string|Object} data - Data to hash
   * @returns {string} - Hash
   */
  hash(data) {
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    return crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');
  }

  /**
   * Generate HMAC signature
   * @param {string} data - Data to sign
   * @param {string} secret - Secret key
   * @returns {string} - HMAC signature
   */
  hmac(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - Signature to verify
   * @param {string} secret - Secret key
   * @returns {boolean} - True if signature is valid
   */
  verifyHmac(data, signature, secret) {
    const expectedSignature = this.hmac(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

module.exports = new Hash();