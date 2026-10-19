import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Muat `.env` root monorepo; variabel yang sudah di-set di environment tidak ditimpa.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../../../.env', import.meta.url)));
} catch {
  // Tidak ada file .env (mis. di container) — andalkan environment.
}

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    WEB_ORIGIN: z
      .string()
      .default('http://localhost:3000')
      .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    /** Folder lampiran (disk lokal). Relatif terhadap root monorepo bila tidak absolut. */
    STORAGE_DIR: z.string().default('storage/uploads'),
    MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  })
  .refine((e) => e.NODE_ENV !== 'production' || !e.JWT_SECRET.startsWith('change-me'), {
    message: 'JWT_SECRET masih memakai nilai contoh',
    path: ['JWT_SECRET'],
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('✖ Konfigurasi environment tidak valid:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

/** Root monorepo (apps/api/src/config → ../../../..). */
export const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export const storageDir = isAbsolute(env.STORAGE_DIR) ? env.STORAGE_DIR : resolve(repoRoot, env.STORAGE_DIR);
