# Project Tracker

Platform manajemen proyek (Kanban, milestone, activity log) untuk tim produk & engineering.

Spesifikasi (single source of truth): [PRD.md](PRD.md) · [DESIGN.md](DESIGN.md) · [DATABASE.md](DATABASE.md) · [SKILL.md](SKILL.md)

## Struktur Monorepo

```
.
├── apps/
│   ├── web/              # @pt/web — Next.js 16 (App Router) + Tailwind v4, token Stitch
│   └── api/              # @pt/api — Hono REST API (src/modules/*: auth, workspaces, projects,
│                         #   tasks, subtasks, comments, milestones, tags, activity, dashboard)
├── packages/
│   └── db/               # @pt/db — skema Drizzle, migrasi SQL, seeder, DB client, prepare (DB test)
│       ├── migrations/   # 0000 extensions · 0001 init · 0002 triggers · 0003 refresh_tokens
│       │                 # 0004 comments.body_html · 0005 activity & completed_at triggers
│       │                 # 0006 attachment activity trigger · 0007 notifications · 0008 realtime pg_notify
│       └── src/
│           ├── schema/   # satu file per domain + relations.ts
│           ├── client.ts # createDb() → { db, pool }
│           ├── migrate.ts · seed.ts · reset.ts
├── e2e/                  # @pt/e2e — Playwright (DB project_tracker_e2e)
├── storage/              # lampiran disk lokal (gitignored)
├── docker-compose.yml    # PostgreSQL 16 (+ Adminer via profile "tools")
└── .env.example
```

## Prasyarat

- Node.js ≥ 22 (lihat `.nvmrc`)
- pnpm via Corepack: `corepack enable`
- Docker Desktop

## Setup Lokal

```bash
cp .env.example .env
pnpm install
pnpm db:up        # jalankan PostgreSQL 16 (tunggu healthy)
pnpm db:migrate   # terapkan migrasi
pnpm db:seed      # isi data contoh (menghapus data lama!)
```

Adminer (opsional): `docker compose --profile tools up -d` lalu buka http://localhost:8080
(server `postgres`, kredensial dari `.env`).

## Script Database

| Script | Fungsi |
| :--- | :--- |
| `pnpm db:up` / `db:down` | Start / stop container Postgres |
| `pnpm db:generate` | Generate migrasi baru dari perubahan `src/schema/*` |
| `pnpm db:migrate` | Terapkan migrasi yang belum jalan |
| `pnpm db:seed` | Truncate semua tabel lalu isi data contoh |
| `pnpm db:reset` | Drop schema → migrate → seed (ditolak saat `NODE_ENV=production`) |
| `pnpm db:studio` | Drizzle Studio |

Migrasi berisi SQL kustom (extension, function, trigger) dibuat dengan
`pnpm --filter @pt/db exec drizzle-kit generate --custom --name=<nama>`.

## API (`apps/api`)

Hono di Node.js. Jalankan setelah database siap:

```bash
pnpm dev:api      # http://localhost:4000 (watch mode)
```

Semua respons memakai envelope `{ success, data, error, timestamp }`; error berbentuk
`{ code, message, details? }` dan setiap respons membawa header `X-Request-Id`.

**Auth.** Access token JWT (HS256, 15 menit) dikirim di body dan dipakai sebagai
`Authorization: Bearer <token>`. Refresh token (30 hari) hanya lewat cookie httpOnly
`pt_refresh` (path `/api/v1/auth`) dan dirotasi di setiap refresh; token lama yang
dipakai ulang mencabut seluruh sesi. Login/register dibatasi per IP
(`AUTH_RATE_LIMIT_PER_MINUTE`).

| Method & Path | Akses minimal |
| :--- | :--- |
| `GET /health` | publik |
| `POST /api/v1/auth/register` · `login` · `refresh` · `logout` | publik |
| `GET /api/v1/auth/me` | login |
| `GET` · `POST /api/v1/workspaces` | login (pembuat menjadi owner) |
| `GET /api/v1/workspaces/:workspaceId` | viewer |
| `PATCH /api/v1/workspaces/:workspaceId` | admin |
| `DELETE /api/v1/workspaces/:workspaceId` | owner |
| `GET /api/v1/workspaces/:workspaceId/members` | viewer |
| `POST /api/v1/workspaces/:workspaceId/members` | admin (memberi role admin: owner) |
| `PATCH /api/v1/workspaces/:workspaceId/members/:userId` | admin (menyentuh admin: owner) |
| `DELETE /api/v1/workspaces/:workspaceId/members/:userId` | admin, atau diri sendiri (keluar) |
| `GET /api/v1/workspaces/:workspaceId/projects?status=&archived=` | viewer |
| `POST /api/v1/workspaces/:workspaceId/projects` | admin |
| `POST /api/v1/workspaces/:workspaceId/projects/:projectId/restore` | admin |
| `GET /api/v1/projects/:projectId` | viewer |
| `PATCH` · `DELETE /api/v1/projects/:projectId` | admin (DELETE = soft delete) |
| `GET /api/v1/workspaces/:workspaceId/dashboard` | viewer (KPI PRD §3.5) |
| `GET /api/v1/workspaces/:workspaceId/activity` | viewer |
| `GET` · `POST /api/v1/workspaces/:workspaceId/tags` | viewer · member |
| `PATCH` · `DELETE /api/v1/tags/:tagId` | admin |
| `GET /api/v1/projects/:projectId/tasks` | viewer — filter `status, priority, assigneeId (uuid\|me\|unassigned), milestoneId (uuid\|none), tagId, q, overdue`, paginasi `cursor, limit` |
| `POST /api/v1/projects/:projectId/tasks` | member |
| `GET` · `POST /api/v1/projects/:projectId/milestones` | viewer · admin |
| `GET /api/v1/projects/:projectId/activity` | viewer |
| `GET /api/v1/tasks/:taskId` | viewer (detail + checklist) |
| `PATCH` · `DELETE /api/v1/tasks/:taskId` | member (DELETE = soft delete) |
| `PATCH /api/v1/tasks/:taskId/move` | member — `{ status, prevTaskId?, nextTaskId? }` |
| `PUT /api/v1/tasks/:taskId/tags` | member — `{ tagIds }` (replace) |
| `POST /api/v1/tasks/:taskId/restore` | admin |
| `GET` · `POST /api/v1/tasks/:taskId/subtasks` | viewer · member |
| `PUT /api/v1/tasks/:taskId/subtasks/order` | member — `{ subtaskIds }` |
| `PATCH` · `DELETE /api/v1/subtasks/:subtaskId` | member |
| `GET` · `POST /api/v1/tasks/:taskId/comments` | viewer · member |
| `PATCH /api/v1/comments/:commentId` | penulis saja |
| `DELETE /api/v1/comments/:commentId` | penulis atau admin |
| `GET /api/v1/tasks/:taskId/activity` | viewer |
| `PATCH` · `DELETE /api/v1/milestones/:milestoneId` | admin (`completed: true/false`) |

**Konvensi task.** Status & posisi hanya diubah lewat `/move` (bukan `PATCH`). Deskripsi
task berupa HTML rich-text yang disanitasi allowlist; komentar berupa Markdown — client
menampilkan `bodyHtml` (sudah aman) dan memakai `body` untuk mengedit. Endpoint list
memakai paginasi keyset: `{ items, nextCursor }`.

Aturan RBAC: role `owner` tidak dapat diberikan, diubah, atau dikeluarkan; user tidak
dapat mengubah role-nya sendiri; non-anggota mendapat 404 (bukan 403) agar keberadaan
workspace/project tidak bocor. `keyPrefix` project tidak dapat diubah setelah dibuat.

## Web (`apps/web`)

```bash
pnpm dev:api      # terminal 1 — API di :4000
pnpm dev:web      # terminal 2 — web di http://localhost:3000
```

- Next.js mem-proxy `/api/v1/*` ke API (`API_ORIGIN`, default `http://localhost:4000`), jadi browser
  hanya melihat satu origin dan cookie refresh bekerja tanpa CORS.
- Access token disimpan di memori; saat 401 client otomatis memanggil `/auth/refresh` sekali.
- Token desain Stitch ada di `src/app/globals.css`; katalog komponen di **/design-system**.
- Route: `/login`, `/onboarding`, `/:workspaceSlug` (dashboard), `/:workspaceSlug/projects`,
  `/:workspaceSlug/projects/:projectId` (Kanban board), `?task=<taskId>` membuka detail task.
- Kanban: drag-and-drop `@dnd-kit` (mouse & keyboard) dengan optimistic update + rollback;
  detail task: editor rich-text Tiptap, checklist, komentar Markdown, time tracking, tags.

## Fitur Workspace & Kolaborasi

| Method & Path | Akses | Isi |
| :--- | :--- | :--- |
| `GET /api/v1/workspaces/:id/tasks` | viewer | Task lintas project; filter seperti board + `projectId`; `sort=board\|due\|priority\|updated\|created\|title\|key`, `dir`, `offset` |
| `GET /api/v1/workspaces/:id/milestones` | viewer | Roadmap milestone semua project aktif |
| `GET /api/v1/workspaces/:id/workload[?projectId]` | viewer | Beban per anggota: open estimate ÷ kapasitas 40 jam (task tanpa estimasi = 4 jam) |
| `GET /api/v1/workspaces/:id/reports?weeks=4–26[&projectId]` | viewer | Throughput mingguan, cycle time, status/prioritas, jam per project |
| `GET /api/v1/workspaces/:id/notifications[?unread=true]` · `/unread-count` · `POST /read` | viewer | Notifikasi milik user login |
| `GET /api/v1/events?workspaceId&token` | anggota | **Server-Sent Events** realtime (`activity`, `notification`) |
| `PATCH /api/v1/auth/me` · `POST /api/v1/auth/password` | login | Profil & ganti password (mencabut sesi lain) |

- **Notifikasi:** `task.assigned` (assignee baru ≠ aktor), `comment.mention` (`@handle` = bagian lokal email
  anggota workspace, mis. `@citra`), `comment.created` (untuk assignee & reporter). Tanpa duplikat per komentar.
- **Realtime:** trigger PostgreSQL `pg_notify('pt_events', …)` pada `activity_logs`, reorder task, dan
  `notifications`; API memegang satu koneksi `LISTEN` dan meneruskan event ke subscriber workspace via SSE.
  Client mengubah event menjadi invalidasi cache (batch 400 ms). Single instance; untuk banyak instance
  setiap instance cukup `LISTEN` sendiri.
- **Web:** tab project *Overview / Kanban / Gantt / List*; halaman *Tasks* (list & Kanban lintas project),
  *Milestones*, *Team Workload*, *Reports*, *Settings* (General, Members, Tags, My profile); lonceng notifikasi;
  autocomplete `@mention` di komentar.
- **Kolom besar:** board & tabel memakai virtual scrolling (`@tanstack/react-virtual`) — hanya kartu di sekitar
  viewport yang dirender dan halaman berikutnya dimuat otomatis.

## Lampiran (disk lokal)

File disimpan di `STORAGE_DIR` (default `storage/uploads`, di-gitignore) dengan key buatan server
`<taskId>/<uuid>` — nama asli hanya di DB. Batas per file `MAX_UPLOAD_MB` (default 10 MB, maks 10 file
per upload). Hanya png/jpeg/gif/webp yang boleh tampil inline (`?inline=1`); tipe lain (termasuk SVG)
selalu diunduh dengan `nosniff` + CSP `default-src 'none'; sandbox`. `pnpm db:seed` ikut mengosongkan folder ini.

| Method & Path | Akses |
| :--- | :--- |
| `GET /api/v1/tasks/:taskId/attachments` | viewer |
| `POST /api/v1/tasks/:taskId/attachments` (multipart, field `file`) | member |
| `GET /api/v1/attachments/:id/download[?inline=1]` | viewer |
| `DELETE /api/v1/attachments/:id` | pengunggah atau admin |

## Testing

| Perintah | Isi | Database |
| :--- | :--- | :--- |
| `pnpm typecheck` | TypeScript seluruh workspace | — |
| `pnpm test` | Vitest API (unit + integrasi via `app.request`, termasuk SSE realtime — 75 test) | `project_tracker_test` |
| `pnpm test:e2e` | Build web + Playwright (32 skenario: shell, Kanban DnD mouse/keyboard, rollback, modal, lampiran, view project, virtual scrolling 260 task, halaman workspace, settings, mention, realtime 2 browser, responsif) | `project_tracker_e2e` |
| `pnpm test:all` | Ketiganya berurutan | — |

- Database test/e2e dibuat, di-reset, dimigrasi, dan di-seed otomatis (`pnpm --filter @pt/db prepare-db`);
  pengaman menolak me-reset database yang namanya tidak berakhiran `_test`/`_e2e`. Data development tidak tersentuh.
- E2E menyalakan API (:4000) dan web (:3000) sendiri → **matikan `dev:api`/`dev:web` dulu**.
- Browser: Edge terpasang dipakai otomatis di Windows; di Linux/CI jalankan `pnpm --filter @pt/e2e exec playwright install chromium`
  (atau set `PW_CHANNEL`). Laporan HTML: `pnpm --filter @pt/e2e report`.

## Akun Seed (development)

Semua password: nilai `SEED_USER_PASSWORD` (default `Password123!`).

| Email | Role |
| :--- | :--- |
| alya@acme.test | owner |
| bima@acme.test | admin |
| citra@acme.test | member |
| dimas@acme.test | member |
| eka@client.test | viewer |

Workspace `acme-corp` berisi project **PRJ** (16 task, 3 milestone) dan **CORE** (5 task).
Tanggal seed relatif terhadap hari ini sehingga metrik overdue/weekly selalu terisi.
