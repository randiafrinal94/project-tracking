import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hash } from '@node-rs/argon2';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from './client.js';
import {
  activityLogs,
  comments,
  milestones,
  notifications,
  projects,
  subtasks,
  tags,
  taskTags,
  tasks,
  users,
  workspaceMembers,
  workspaces,
  SORT_ORDER_GAP,
  type MemberRole,
  type NewActivityLog,
  type NewNotification,
  type TaskPriority,
  type TaskStatus,
} from './schema/index.js';

/** HTML komentar seed (seeder tidak memakai renderer API): escape + `code` inline. */
const seedCommentHtml = (body: string) =>
  `<p>${body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`;

const DAY = 86_400_000;
const now = Date.now();
const at = (days: number, hours = 0) => new Date(now + days * DAY + hours * 3_600_000);
const day = (days: number) => at(days).toISOString().slice(0, 10);

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const USERS: { key: string; fullName: string; email: string; role: MemberRole }[] = [
  { key: 'alya', fullName: 'Alya Pratama', email: 'alya@acme.test', role: 'owner' },
  { key: 'bima', fullName: 'Bima Santoso', email: 'bima@acme.test', role: 'admin' },
  { key: 'citra', fullName: 'Citra Lestari', email: 'citra@acme.test', role: 'member' },
  { key: 'dimas', fullName: 'Dimas Wirawan', email: 'dimas@acme.test', role: 'member' },
  { key: 'eka', fullName: 'Eka Putri', email: 'eka@client.test', role: 'viewer' },
];

const TAGS = [
  { key: 'frontend', name: 'Frontend', color: '#4F46E5' },
  { key: 'backend', name: 'Backend', color: '#2563EB' },
  { key: 'design', name: 'Design', color: '#D97706' },
  { key: 'devops', name: 'DevOps', color: '#059669' },
  { key: 'bug', name: 'Bug', color: '#DC2626' },
  { key: 'research', name: 'Research', color: '#64748B' },
] as const;
type TagKey = (typeof TAGS)[number]['key'];

interface TaskSeed {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  milestone?: string;
  tags?: TagKey[];
  /** Hari relatif terhadap hari ini; negatif = lampau. */
  due?: number;
  estimate?: number;
  actual?: number;
  /** [judul, selesai?] */
  subtasks?: [string, boolean][];
  comments?: [author: string, body: string, daysAgo: number][];
  description?: string;
}

interface ProjectSeed {
  name: string;
  keyPrefix: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  start: number;
  target: number;
  milestones: { key: string; name: string; start: number; due: number; done?: boolean }[];
  tasks: TaskSeed[];
}

const PROJECTS: ProjectSeed[] = [
  {
    name: 'Project Tracker Platform',
    keyPrefix: 'PRJ',
    description: 'Aplikasi web project tracking: Kanban board, milestone, dan analytics tim.',
    status: 'active',
    start: -30,
    target: 45,
    milestones: [
      { key: 's1', name: 'Sprint 1 — Foundation', start: -30, due: -16, done: true },
      { key: 's2', name: 'Sprint 2 — Kanban MVP', start: -15, due: -1, done: true },
      { key: 's3', name: 'Sprint 3 — Collaboration', start: 0, due: 14 },
    ],
    tasks: [
      {
        title: 'Setup monorepo & CI pipeline',
        status: 'done', priority: 'high', assignee: 'bima', milestone: 's1',
        tags: ['devops'], due: -25, estimate: 6, actual: 5.5,
        subtasks: [['Init pnpm workspace', true], ['GitHub Actions lint + typecheck', true]],
      },
      {
        title: 'Design database schema & migrations',
        status: 'done', priority: 'high', assignee: 'bima', milestone: 's1',
        tags: ['backend'], due: -20, estimate: 8, actual: 9,
      },
      {
        title: 'Map Stitch design tokens to Tailwind theme',
        status: 'done', priority: 'medium', assignee: 'citra', milestone: 's1',
        tags: ['design', 'frontend'], due: -18, estimate: 5, actual: 4,
      },
      {
        title: 'Build app shell: sidebar & header',
        status: 'done', priority: 'medium', assignee: 'citra', milestone: 's2',
        tags: ['frontend'], due: -10, estimate: 8, actual: 7.5,
      },
      {
        title: 'Kanban board drag-and-drop',
        status: 'done', priority: 'high', assignee: 'dimas', milestone: 's2',
        tags: ['frontend'], due: -3, estimate: 12, actual: 14,
        subtasks: [['Column droppable', true], ['Card reorder in column', true], ['Cross-column move', true]],
      },
      {
        title: 'Task move endpoint with sort_order gaps',
        status: 'done', priority: 'high', assignee: 'bima', milestone: 's2',
        tags: ['backend'], due: -2, estimate: 6, actual: 6,
      },
      {
        title: 'Implement OAuth2 Google Login',
        status: 'in_progress', priority: 'urgent', assignee: 'bima', milestone: 's3',
        tags: ['backend'], due: 4, estimate: 10, actual: 4,
        description: 'Tambahkan login Google (OIDC) di samping email/password. Akun dengan email sama digabung.',
        subtasks: [
          ['Register OAuth client di Google Cloud', true],
          ['Callback handler & token exchange', true],
          ['Link akun dengan email yang sudah ada', true],
          ['Refresh token rotation', false],
          ['E2E test login flow', false],
        ],
        comments: [
          ['alya', 'Pastikan domain `acme.test` di-whitelist untuk staging ya.', 2],
          ['bima', 'Siap, callback sudah jalan di staging. Tinggal rotation.', 1],
        ],
      },
      {
        title: 'Task detail slide-out drawer',
        status: 'in_progress', priority: 'high', assignee: 'citra', milestone: 's3',
        tags: ['frontend', 'design'], due: 6, estimate: 10, actual: 3,
        subtasks: [['Layout 65/35 split', true], ['Meta sidebar fields', false], ['Keyboard close (Esc)', false]],
      },
      {
        title: 'Comment thread with markdown sanitization',
        status: 'in_progress', priority: 'medium', assignee: 'dimas', milestone: 's3',
        tags: ['backend', 'frontend'], due: 9, estimate: 8, actual: 2,
      },
      {
        title: 'Fix card flicker on optimistic rollback',
        status: 'in_review', priority: 'high', assignee: 'dimas', milestone: 's3',
        tags: ['bug', 'frontend'], due: 1, estimate: 3, actual: 2.5,
        comments: [['citra', 'Sudah saya cek di Safari, flicker hilang. LGTM.', 0]],
      },
      {
        title: 'Workspace invitation emails',
        status: 'in_review', priority: 'medium', assignee: 'bima', milestone: 's3',
        tags: ['backend'], due: 3, estimate: 5, actual: 5,
      },
      {
        title: 'Attachment upload & preview',
        status: 'backlog', priority: 'medium', milestone: 's3',
        tags: ['frontend', 'backend'], due: 12, estimate: 10,
      },
      {
        title: 'Dashboard KPI cards',
        status: 'backlog', priority: 'medium', assignee: 'citra',
        tags: ['frontend'], due: 18, estimate: 6,
      },
      {
        title: 'Gantt / timeline view research',
        status: 'backlog', priority: 'low',
        tags: ['research'], estimate: 4,
      },
      {
        title: 'Virtual scrolling for columns > 200 tasks',
        status: 'backlog', priority: 'low', assignee: 'dimas',
        tags: ['frontend'], estimate: 6,
      },
      {
        title: 'Update onboarding copy',
        status: 'backlog', priority: 'low', assignee: 'citra',
        tags: ['design'], due: -2, estimate: 2,
      },
    ],
  },
  {
    name: 'Core Services',
    keyPrefix: 'CORE',
    description: 'Hardening layanan inti: auth, observability, dan performa database.',
    status: 'active',
    start: -10,
    target: 60,
    milestones: [{ key: 'q4', name: 'Q4 Hardening', start: -10, due: 30 }],
    tasks: [
      {
        title: 'Rate limiting for auth endpoints',
        status: 'done', priority: 'urgent', assignee: 'bima', milestone: 'q4',
        tags: ['backend'], due: -4, estimate: 4, actual: 3,
      },
      {
        title: 'Structured logging & request IDs',
        status: 'in_progress', priority: 'medium', assignee: 'dimas', milestone: 'q4',
        tags: ['backend', 'devops'], due: 7, estimate: 6, actual: 2,
        subtasks: [['Pino logger', true], ['Propagate x-request-id', false]],
      },
      {
        title: 'Nightly Postgres backups',
        status: 'in_review', priority: 'high', assignee: 'bima', milestone: 'q4',
        tags: ['devops'], due: -1, estimate: 3, actual: 3,
      },
      {
        title: 'Slow query audit on activity_logs',
        status: 'backlog', priority: 'medium', milestone: 'q4',
        tags: ['backend', 'research'], due: 20, estimate: 5,
      },
      {
        title: 'Connection pool exhaustion under load',
        status: 'backlog', priority: 'urgent', assignee: 'dimas', milestone: 'q4',
        tags: ['bug', 'backend'], due: -3, estimate: 4,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

async function truncateAll(tx: Tx) {
  await tx.execute(sql`
    TRUNCATE notifications, activity_logs, attachments, comments, subtasks, task_tags, tags,
             tasks, milestones, projects, workspace_members, workspaces,
             refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

/** Baris attachments di-truncate → kosongkan juga folder file lampiran (disk lokal). */
async function clearStorage() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const dir = resolve(root, process.env.STORAGE_DIR ?? 'storage/uploads');
  if (!dir.startsWith(resolve(root))) throw new Error(`STORAGE_DIR di luar repo, tidak dihapus: ${dir}`);
  await rm(dir, { recursive: true, force: true });
}

export async function seedDatabase(db: Database, { quiet = false } = {}) {
  const password = process.env.SEED_USER_PASSWORD ?? 'Password123!';
  await clearStorage();
  const passwordHash = await hash(password);

  await db.transaction(async (tx) => {
    // Seeder menulis riwayat activity sendiri (dengan timestamp lampau); matikan trigger log.
    await tx.execute(sql`SELECT set_config('app.skip_activity', 'on', true)`);
    await truncateAll(tx);

    const userRows = await tx
      .insert(users)
      .values(USERS.map((u) => ({ email: u.email, fullName: u.fullName, passwordHash })))
      .returning({ id: users.id, email: users.email });
    const userId = Object.fromEntries(
      USERS.map((u) => [u.key, userRows.find((r) => r.email === u.email)!.id]),
    );
    const ownerId = userId.alya!;

    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: 'Acme Corp', slug: 'acme-corp', ownerId })
      .returning();
    const workspaceId = workspace!.id;

    await tx
      .insert(workspaceMembers)
      .values(USERS.map((u) => ({ workspaceId, userId: userId[u.key]!, role: u.role })));

    const tagRows = await tx
      .insert(tags)
      .values(TAGS.map((t) => ({ workspaceId, name: t.name, color: t.color })))
      .returning({ id: tags.id, name: tags.name });
    const tagId = Object.fromEntries(
      TAGS.map((t) => [t.key, tagRows.find((r) => r.name === t.name)!.id]),
    ) as Record<TagKey, string>;

    const activity: NewActivityLog[] = [];
    const notificationRows: NewNotification[] = [];
    let taskCount = 0;

    for (const p of PROJECTS) {
      const [project] = await tx
        .insert(projects)
        .values({
          workspaceId,
          name: p.name,
          keyPrefix: p.keyPrefix,
          description: p.description,
          status: p.status,
          startDate: day(p.start),
          targetDate: day(p.target),
          createdBy: ownerId,
          createdAt: at(p.start),
        })
        .returning();
      const projectId = project!.id;
      activity.push({
        workspaceId, projectId, actorId: ownerId, action: 'project.created',
        entityType: 'project', entityId: projectId, metadata: { name: p.name },
        createdAt: at(p.start),
      });

      const msRows = await tx
        .insert(milestones)
        .values(
          p.milestones.map((m, i) => ({
            projectId,
            name: m.name,
            startDate: day(m.start),
            dueDate: day(m.due),
            completedAt: m.done ? at(m.due) : null,
            sortOrder: (i + 1) * SORT_ORDER_GAP,
          })),
        )
        .returning({ id: milestones.id, name: milestones.name });
      const milestoneId = Object.fromEntries(
        p.milestones.map((m) => [m.key, msRows.find((r) => r.name === m.name)!.id]),
      );

      // sort_order per kolom dengan jarak SORT_ORDER_GAP
      const columnPos: Record<TaskStatus, number> = {
        backlog: 0, in_progress: 0, in_review: 0, done: 0,
      };

      // Insert satu per satu agar task_number (trigger) mengikuti urutan definisi.
      for (const [i, t] of p.tasks.entries()) {
        const createdAt = at(p.start + i, 9);
        const isDone = t.status === 'done';
        const [task] = await tx
          .insert(tasks)
          .values({
            projectId,
            milestoneId: t.milestone ? milestoneId[t.milestone] : null,
            title: t.title,
            description: t.description ?? null,
            status: t.status,
            priority: t.priority,
            sortOrder: ++columnPos[t.status] * SORT_ORDER_GAP,
            assigneeId: t.assignee ? userId[t.assignee] : null,
            reporterId: userId.bima,
            dueDate: t.due === undefined ? null : day(t.due),
            estimateHours: t.estimate?.toFixed(2) ?? null,
            actualHours: (t.actual ?? 0).toFixed(2),
            completedAt: isDone ? at(Math.min(t.due ?? 0, 0) - 1, 16) : null,
            createdAt,
          })
          .returning({ id: tasks.id, taskNumber: tasks.taskNumber });
        const taskId = task!.id;
        const key = `${p.keyPrefix}-${task!.taskNumber}`;
        taskCount++;

        activity.push({
          workspaceId, projectId, taskId, actorId: userId.bima, action: 'task.created',
          entityType: 'task', entityId: taskId, metadata: { key, title: t.title },
          createdAt,
        });
        if (t.status !== 'backlog') {
          activity.push({
            workspaceId, projectId, taskId, actorId: t.assignee ? userId[t.assignee] : ownerId,
            action: 'task.moved', entityType: 'task', entityId: taskId,
            metadata: { key, from: 'backlog', to: t.status },
            createdAt: isDone ? at(Math.min(t.due ?? 0, 0) - 1, 16) : at(-1, i % 8),
          });
        }

        if (t.tags?.length) {
          await tx.insert(taskTags).values(t.tags.map((k) => ({ taskId, tagId: tagId[k] })));
        }

        if (t.subtasks?.length) {
          await tx.insert(subtasks).values(
            t.subtasks.map(([title, done], j) => ({
              taskId,
              title,
              isCompleted: done,
              completedAt: done ? at(-2, j) : null,
              sortOrder: (j + 1) * SORT_ORDER_GAP,
            })),
          );
        }

        for (const [author, body, daysAgo] of t.comments ?? []) {
          const [comment] = await tx
            .insert(comments)
            .values({ taskId, authorId: userId[author], body, bodyHtml: seedCommentHtml(body), createdAt: at(-daysAgo, 10) })
            .returning({ id: comments.id });
          activity.push({
            workspaceId, projectId, taskId, actorId: userId[author], action: 'comment.created',
            entityType: 'comment', entityId: comment!.id, metadata: { key },
            createdAt: at(-daysAgo, 10),
          });
          // Notifikasi contoh untuk assignee task (bila bukan penulis komentar).
          if (t.assignee && t.assignee !== author) {
            notificationRows.push({
              userId: userId[t.assignee]!, workspaceId, projectId, taskId, actorId: userId[author],
              type: 'comment.created', metadata: { key, title: t.title, excerpt: body.slice(0, 140) },
              createdAt: at(-daysAgo, 10),
            });
          }
        }
      }
    }

    await tx.insert(activityLogs).values(activity);
    if (notificationRows.length > 0) await tx.insert(notifications).values(notificationRows);

    if (!quiet) {
      console.log(
        `✔ Seed selesai: ${USERS.length} users, 1 workspace, ${PROJECTS.length} projects, ` +
          `${taskCount} tasks, ${activity.length} activity logs`,
      );
      console.log(`  Login dev: ${USERS.map((u) => `${u.email} (${u.role})`).join(', ')}`);
      console.log(`  Password : ${password}`);
    }
  });
}

// Dijalankan sebagai script (`pnpm db:seed`), bukan saat di-import (test/prepare).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.NODE_ENV === 'production') {
    console.error('✖ Seeder ditolak di NODE_ENV=production');
    process.exit(1);
  }
  const { db, pool } = createDb({ max: 1 });
  try {
    await seedDatabase(db);
  } catch (error) {
    console.error('✖ Seed gagal:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
