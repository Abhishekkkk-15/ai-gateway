import crypto from 'node:crypto';

/**
 * Derives a 32-byte key from master secret using SHA-256
 */
function deriveKey(masterSecret: string): Buffer {
  return crypto.createHash('sha256').update(masterSecret).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Returns formatted string: iv:ciphertext:tag (hex encoded)
 */
export function encryptSecret(plaintext: string, masterSecret: string): string {
  const key = deriveKey(masterSecret);
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${ciphertext}:${tag}`;
}

/**
 * Decrypts AES-256-GCM payload in format iv:ciphertext:tag (hex encoded).
 */
export function decryptSecret(payload: string, masterSecret: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:ciphertext:tag');
  }

  const [ivHex, ciphertextHex, tagHex] = parts;
  const key = deriveKey(masterSecret);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Deterministically hashes a Gateway API Key using SHA-256 (hex).
 */
export function hashGatewayKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Hashes password using PBKDF2 with a random 16-byte salt.
 * Returns format: salt:hash (hex encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a password against a salt:hash string using timing-safe comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;

  const [salt, hash] = parts;
  return new Promise((resolve) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) {
        resolve(false);
        return;
      }
      const keyBuffer = Buffer.from(hash, 'hex');
      if (keyBuffer.length !== derivedKey.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}
