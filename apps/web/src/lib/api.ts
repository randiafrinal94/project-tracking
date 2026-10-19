import type { ApiEnvelope, ApiErrorBody, Session } from './types';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(status: number, body: ApiErrorBody | null | undefined) {
    return new ApiError(status, body?.code ?? 'UNKNOWN', body?.message ?? 'Request failed', body?.details);
  }
}

// ---------------------------------------------------------------------------
// Access token: hanya di memori (tidak pernah di localStorage) — refresh token
// tinggal di cookie httpOnly yang dikelola API.
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshInFlight: Promise<Session | null> | null = null;
const unauthorizedListeners = new Set<() => void>();

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/** Untuk koneksi yang tidak bisa memakai header (EventSource). */
export const getAccessToken = () => accessToken;

/** Dipanggil AuthProvider untuk mengarahkan user ke /login saat sesi habis. */
export const onUnauthorized = (listener: () => void) => {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
};

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success) throw ApiError.from(res.status, body?.error);
  return body.data as T;
}

/** Rotasi refresh token; request paralel berbagi satu promise. */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((res) => (res.ok ? parse<Session>(res) : null))
    .catch(() => null)
    .then((session) => {
      setAccessToken(session?.accessToken ?? null);
      return session;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Dikirim sebagai JSON. */
  body?: unknown;
  /** Dikirim apa adanya (mis. FormData untuk upload). */
  rawBody?: BodyInit;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

/** Kirim request dengan Bearer token; saat 401 coba refresh sekali lalu ulangi. */
async function authorizedFetch(path: string, options: RequestOptions): Promise<Response> {
  const send = () =>
    fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      signal: options.signal,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });

  let res = await send();
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) {
      res = await send();
    } else {
      unauthorizedListeners.forEach((listener) => listener());
    }
  }
  return res;
}

/**
 * Fetch ke API dengan envelope standar. Saat 401 mencoba refresh sekali,
 * lalu mengulang request; bila tetap gagal, listener unauthorized dipanggil.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return parse<T>(await authorizedFetch(path, options));
}

/** Unduh respons biner (lampiran) sebagai Blob — `<img>` tidak bisa mengirim header Authorization. */
export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const res = await authorizedFetch(path, options);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<null> | null;
    throw ApiError.from(res.status, body?.error);
  }
  return res.blob();
}
