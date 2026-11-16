import { describe, it, expect } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  hashGatewayKey,
  hashPassword,
  verifyPassword,
} from '../src/crypto.js';

describe('Crypto Helpers', () => {
  const masterSecret = 'super-secret-key-that-is-at-least-32-chars-long!';

  it('encrypts and decrypts a secret using AES-256-GCM', () => {
    const originalText = 'sk-groq-live-api-key-12345';
    const encrypted = encryptSecret(originalText, masterSecret);

    expect(encrypted).not.toBe(originalText);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3); // iv:ciphertext:tag

    const decrypted = decryptSecret(encrypted, masterSecret);
    expect(decrypted).toBe(originalText);
  });

  it('fails to decrypt if ciphertext or tag is tampered with', () => {
    const originalText = 'secret-data';
    const encrypted = encryptSecret(originalText, masterSecret);
    const parts = encrypted.split(':');
    
    // Tamper with ciphertext
    const tamperedCiphertext = `${parts[0]}:deadbeef${parts[1].slice(8)}:${parts[2]}`;
    expect(() => decryptSecret(tamperedCiphertext, masterSecret)).toThrow();

    // Tamper with tag
    const tamperedTag = `${parts[0]}:${parts[1]}:00000000000000000000000000000000`;
    expect(() => decryptSecret(tamperedTag, masterSecret)).toThrow();
  });

  it('fails to decrypt with a different master secret', () => {
    const originalText = 'secret-data';
    const encrypted = encryptSecret(originalText, masterSecret);
    expect(() => decryptSecret(encrypted, 'different-secret-key-32-chars-long!!')).toThrow();
  });

  it('hashes a gateway API key deterministically using SHA-256', () => {
    const key = 'sk-gw-1234567890abcdef';
    const hash1 = hashGatewayKey(key);
    const hash2 = hashGatewayKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
    expect(hashGatewayKey(key + 'x')).not.toBe(hash1);
  });

  it('hashes and verifies admin password', async () => {
    const password = 'AdminPassword123!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });
});
