import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * EncryptionService
 *
 * Reversible symmetric encryption for secrets stored at rest — e.g. OAuth
 * refresh tokens for the email-integration module. Uses AES-256-GCM, which
 * provides both confidentiality and integrity (tamper detection via the auth
 * tag).
 *
 * The key is derived from `auth.ENC_KEY` in the YAML properties. A random IV is
 * generated per encryption and stored alongside the ciphertext, so encrypting
 * the same plaintext twice yields different outputs (no leaking of equality).
 *
 * Encoded format (single string, colon-separated base64):
 *   <iv>:<authTag>:<ciphertext>
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96-bit IV recommended for GCM
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encKey = this.configService.get<string>('auth.ENC_KEY');

    if (!encKey) {
      throw new Error(
        'EncryptionService: auth.ENC_KEY is not configured. Set it in the properties YAML.',
      );
    }

    // Derive a fixed 32-byte (256-bit) key from the configured secret via
    // SHA-256, so any-length ENC_KEY yields a valid AES-256 key.
    this.key = createHash('sha256').update(encKey, 'utf8').digest();
  }

  /**
   * Encrypts a UTF-8 string and returns an `iv:authTag:ciphertext` base64 blob.
   */
  encrypt(plainText: string): string {
    const iv = randomBytes(EncryptionService.IV_LENGTH);
    const cipher = createCipheriv(EncryptionService.ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypts a blob produced by {@link encrypt}. Throws if the ciphertext has
   * been tampered with or the format is invalid — callers should treat a throw
   * as "credential unusable".
   */
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('EncryptionService: malformed ciphertext payload');
    }

    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(
      EncryptionService.ALGORITHM,
      this.key,
      iv,
    );
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
