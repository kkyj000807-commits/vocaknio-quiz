import { describe, expect, it } from 'vitest';
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { decryptBook, encryptBook } from '../lib/encrypted-book';

describe('encrypted book transport', () => {
  it('round-trips without putting plaintext in the envelope', async () => {
    const text = 'private test book';
    const input = new TextEncoder().encode(text);
    const encrypted = await encryptBook(input, 'test-only passphrase');
    expect(new TextDecoder().decode(encrypted)).not.toContain(text);
    expect(new TextDecoder().decode(await decryptBook(encrypted, 'test-only passphrase'))).toBe(text);
    const another = await encryptBook(input, 'test-only passphrase');
    expect(encrypted).not.toEqual(another);
  });
  it('rejects incorrect passwords, modifications, and truncated input', async () => {
    const encrypted = await encryptBook(new TextEncoder().encode('fixture'), 'correct test password');
    await expect(decryptBook(encrypted, 'wrong test password')).rejects.toThrow();
    const modified = encrypted.slice(); modified[modified.length - 1] ^= 1;
    await expect(decryptBook(modified, 'correct test password')).rejects.toThrow();
    await expect(decryptBook(encrypted.slice(0, 10), 'correct test password')).rejects.toThrow();
  });
  it('opens a file produced by the interactive Node encryption format', async () => {
    const password = 'example-test-only-password';
    const magic = Buffer.from('FINETUNE-BOOK-1\n');
    const salt = randomBytes(16), iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(password, salt, 600000, 32, 'sha256'), iv);
    cipher.setAAD(magic);
    const payload = Buffer.concat([magic, salt, iv, cipher.update('fixture', 'utf8'), cipher.final(), cipher.getAuthTag()]);
    expect(new TextDecoder().decode(await decryptBook(payload, password))).toBe('fixture');
  });
});
