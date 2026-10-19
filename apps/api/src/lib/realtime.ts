import pg from 'pg';
import { env } from '../config/env.js';

export interface RealtimeEvent {
  type: 'activity' | 'notification';
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId?: string | null;
  action?: string;
  userId?: string;
}

interface Subscriber {
  userId: string;
  send: (event: RealtimeEvent) => void;
}

/**
 * Hub event realtime: satu koneksi `LISTEN pt_events` (dibuka saat ada subscriber
 * pertama) di-fan-out ke subscriber per workspace. Notifikasi hanya dikirim ke
 * penerimanya. Single-process; untuk banyak instance, tiap instance LISTEN sendiri.
 */
class EventHub {
  private client: pg.Client | null = null;
  private connecting: Promise<void> | null = null;
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private retryDelay = 1000;
  private closed = false;

  private async connect() {
    const client = new pg.Client({ connectionString: env.DATABASE_URL });
    client.on('notification', (msg) => {
      if (!msg.payload) return;
      try {
        this.dispatch(JSON.parse(msg.payload) as RealtimeEvent);
      } catch {
        // payload rusak diabaikan
      }
    });
    client.on('error', () => this.handleDisconnect(client));
    client.on('end', () => this.handleDisconnect(client));
    await client.connect();
    await client.query('LISTEN pt_events');
    this.client = client;
    this.retryDelay = 1000;
  }

  private handleDisconnect(client: pg.Client) {
    if (this.client !== client) return;
    this.client = null;
    this.connecting = null;
    if (this.closed || this.subscribers.size === 0) return;
    setTimeout(() => void this.ensure().catch(() => undefined), this.retryDelay).unref();
    this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
  }

  ensure(): Promise<void> {
    if (this.client) return Promise.resolve();
    this.connecting ??= this.connect().catch((error) => {
      this.connecting = null;
      throw error;
    });
    return this.connecting;
  }

  private dispatch(event: RealtimeEvent) {
    for (const sub of this.subscribers.get(event.workspaceId) ?? []) {
      if (event.type === 'notification' && event.userId !== sub.userId) continue;
      sub.send(event);
    }
  }

  async subscribe(workspaceId: string, userId: string, send: Subscriber['send']) {
    await this.ensure();
    const sub: Subscriber = { userId, send };
    let set = this.subscribers.get(workspaceId);
    if (!set) this.subscribers.set(workspaceId, (set = new Set()));
    set.add(sub);
    return () => {
      set!.delete(sub);
      if (set!.size === 0) this.subscribers.delete(workspaceId);
    };
  }

  get subscriberCount() {
    let n = 0;
    for (const set of this.subscribers.values()) n += set.size;
    return n;
  }

  async close() {
    this.closed = true;
    const client = this.client;
    this.client = null;
    await client?.end().catch(() => undefined);
  }
}

export const eventHub = new EventHub();
