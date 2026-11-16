import { afterEach, describe, expect, it } from 'vitest';

import { TokenEncryptionService } from '../src/cloud-connections/token-encryption.service.js';

describe('TokenEncryptionService', () => {
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey) {
      process.env.TOKEN_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    }
  });

  it('encrypts and decrypts token material with AES-256-GCM', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const encryption = new TokenEncryptionService();
    const encrypted = encryption.encrypt('provider-token');

    expect(encrypted).not.toContain('provider-token');
    expect(encryption.decrypt(encrypted)).toBe('provider-token');
  });

  it('rejects a key that is not 32 bytes', () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString('base64');

    expect(() => new TokenEncryptionService().encrypt('provider-token')).toThrow();
  });
});
