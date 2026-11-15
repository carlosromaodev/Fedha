import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scryptAsync(pw: string, salt: Buffer, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pw, salt, len, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const expected = Buffer.from(k, "base64");
  const key = await scryptAsync(password, Buffer.from(s, "base64"), expected.length);
  return timingSafeEqual(key, expected);
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const hmacSha256 = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("hex");

/** AES-256-GCM para segredos 2FA e documentos KYC em repouso. */
export function encrypt(keyHex: string, data: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const enc = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
export function decrypt(keyHex: string, blob: Buffer): Buffer {
  const d = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}
export const encryptText = (k: string, s: string) => encrypt(k, Buffer.from(s)).toString("base64");
export const decryptText = (k: string, s: string) => decrypt(k, Buffer.from(s, "base64")).toString();
