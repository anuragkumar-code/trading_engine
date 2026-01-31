const crypto = require('crypto');

class HMAC {
  /**
   * Generate HMAC signature for webhook validation
   * @param {Object} payload - Request payload
   * @param {string} secret - Webhook secret
   * @returns {string} - HMAC signature
   */
  generate(payload, secret) {
    const data = typeof payload === 'object' ? JSON.stringify(payload) : payload;
    
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   * @param {Object} payload - Request payload
   * @param {string} signature - Signature to verify
   * @param {string} secret - Webhook secret
   * @returns {boolean} - True if valid
   */
  verify(payload, signature, secret) {
    const expectedSignature = this.generate(payload, secret);
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate signed URL with expiry
   * @param {string} url - URL to sign
   * @param {string} secret - Secret key
   * @param {number} expirySeconds - Expiry in seconds
   * @returns {string} - Signed URL
   */
  signUrl(url, secret, expirySeconds = 3600) {
    const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
    const data = `${url}:${expiry}`;
    const signature = this.generate(data, secret);
    
    return `${url}?signature=${signature}&expiry=${expiry}`;
  }

  /**
   * Verify signed URL
   * @param {string} url - Base URL
   * @param {string} signature - Signature from URL
   * @param {number} expiry - Expiry timestamp
   * @param {string} secret - Secret key
   * @returns {boolean} - True if valid and not expired
   */
  verifyUrl(url, signature, expiry, secret) {
    const now = Math.floor(Date.now() / 1000);
    
    if (now > expiry) {
      return false;
    }
    
    const data = `${url}:${expiry}`;
    return this.verify(data, signature, secret);
  }
}

module.exports = new HMAC();