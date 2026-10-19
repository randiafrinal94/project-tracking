import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { storageDir } from '../config/env.js';
import { notFound } from './errors.js';

/**
 * Penyimpanan lampiran di disk lokal. Key dibuat server (`<taskId>/<uuid>`), tidak
 * pernah dari nama file user; tetap divalidasi agar tidak keluar dari STORAGE_DIR.
 */
function pathFor(key: string): string {
  const full = resolve(storageDir, key);
  if (!full.startsWith(storageDir + sep)) throw new Error(`Invalid storage key: ${key}`);
  return full;
}

export async function saveObject(key: string, data: Uint8Array): Promise<void> {
  const full = pathFor(key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data, { flag: 'wx' });
}

export async function openObject(key: string): Promise<{ stream: ReadableStream; size: number }> {
  const full = pathFor(key);
  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) throw notFound('File');
  return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream, size: info.size };
}

export async function deleteObject(key: string): Promise<void> {
  await rm(pathFor(key), { force: true });
}
