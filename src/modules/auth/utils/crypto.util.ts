import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashValue(value: string): Promise<string> {
  return bcrypt.hash(value, SALT_ROUNDS);
}
export async function verifyHash(
  value: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(value, hash);
}
