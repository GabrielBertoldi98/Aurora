import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenEncryptionService {
  encrypt(value: string): string {
    const key = this.getKey();
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, initializationVector);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();

    return [
      'v1',
      initializationVector.toString('base64url'),
      authenticationTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt(ciphertext: string): string {
    const key = this.getKey();
    const [version, initializationVector, authenticationTag, encrypted] = ciphertext.split('.');

    if (version !== 'v1' || !initializationVector || !authenticationTag || !encrypted) {
      throw new Error('Encrypted token has an invalid format.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(initializationVector, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authenticationTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKey(): Buffer {
    const encodedKey = process.env.TOKEN_ENCRYPTION_KEY;
    const key = encodedKey ? Buffer.from(encodedKey, 'base64') : undefined;

    if (!key || key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }

    return key;
  }
}
