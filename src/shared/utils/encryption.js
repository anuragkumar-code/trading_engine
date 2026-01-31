const crypto = require('crypto');
const config = require('../config');

class Encryption {
  constructor() {
    this.algorithm = config.app.encryption.algorithm;
    this.key = Buffer.from(config.app.encryption.key, 'utf8');
    
    if (this.key.length !== 32) {
      throw new Error('Encryption key must be exactly 32 characters');
    }
  }

  /**
   * Encrypt text using AES-256-GCM
   * @param {string} text - Plain text to encrypt
   * @returns {string} - Encrypted text with IV and auth tag (format: iv:authTag:encrypted)
   */
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted text
   * @param {string} encryptedText - Encrypted text (format: iv:authTag:encrypted)
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedText) {
    try {
      const parts = encryptedText.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt object to JSON string
   * @param {Object} obj - Object to encrypt
   * @returns {string} - Encrypted JSON
   */
  encryptObject(obj) {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypt JSON string to object
   * @param {string} encryptedText - Encrypted JSON
   * @returns {Object} - Decrypted object
   */
  decryptObject(encryptedText) {
    const decrypted = this.decrypt(encryptedText);
    return JSON.parse(decrypted);
  }
}

module.exports = new Encryption();