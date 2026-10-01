import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(rawScrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const result = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${result.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  const candidate = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
export const digest = (token: string) => createHash('sha256').update(token).digest('hex');
