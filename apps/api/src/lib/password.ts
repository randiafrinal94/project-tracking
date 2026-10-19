import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 default: Argon2id, m=19456 KiB, t=2, p=1 (rekomendasi OWASP).
export const hashPassword = (plain: string) => hash(plain);

let dummyHash: Promise<string> | undefined;

/**
 * Verifikasi password. Bila user tidak ditemukan (`hashed` undefined) tetap
 * menjalankan verifikasi terhadap hash dummy agar waktu respons seragam.
 */
export async function verifyPassword(hashed: string | undefined, plain: string): Promise<boolean> {
  if (!hashed) {
    dummyHash ??= hash('dummy-password-for-timing');
    await verify(await dummyHash, plain).catch(() => false);
    return false;
  }
  return verify(hashed, plain).catch(() => false);
}
