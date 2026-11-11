/** Password-encrypted book transport. This module never accesses learner storage. */
const MAGIC = new TextEncoder().encode('FINETUNE-BOOK-1\n');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ITERATIONS = 600_000;
const MAX_BYTES = 96 * 1024 * 1024;

async function keyFor(password: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  if (!password || password.length > 1024 || !globalThis.crypto?.subtle) throw new Error('Encryption unavailable');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: ITERATIONS }, material,
    { name: 'AES-GCM', length: 256 }, false, [usage],
  );
}

export async function encryptBook(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Invalid book size');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await keyFor(password, salt, 'encrypt');
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: MAGIC }, key, new Uint8Array(bytes)));
  const result = new Uint8Array(MAGIC.length + salt.length + iv.length + encrypted.length);
  result.set(MAGIC); result.set(salt, MAGIC.length); result.set(iv, MAGIC.length + SALT_BYTES);
  result.set(encrypted, MAGIC.length + SALT_BYTES + IV_BYTES);
  return result;
}

export async function decryptBook(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const header = MAGIC.length + SALT_BYTES + IV_BYTES;
  if (bytes.length < header + 16 || bytes.length > MAX_BYTES + header + 16 ||
    MAGIC.some((value, index) => bytes[index] !== value)) throw new Error('Invalid encrypted book');
  const salt = bytes.slice(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = bytes.slice(MAGIC.length + SALT_BYTES, header);
  const key = await keyFor(password, salt, 'decrypt');
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: MAGIC }, key, bytes.slice(header)));
  } catch {
    throw new Error('Incorrect password or damaged encrypted book');
  }
}
