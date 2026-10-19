# Database Specification & Schema Architecture

Platform menggunakan **PostgreSQL 16** via Docker container. Arsitektur data mengadopsi skema relasional yang dioptimalkan untuk relasi multi-tenant workspace, integritas data, dan audit log.

> Implementasi: [packages/db/src/schema/](packages/db/src/schema/) (Drizzle ORM) dan [packages/db/migrations/](packages/db/migrations/) (SQL). Dokumen ini dan skema kode harus selalu sinkron.

---

## 1. Entity Relationship Overview
```
users ───────────< workspace_members >────────── workspaces
  │                                                   │
  │ (created_by / assignee / reporter / author)       ├──< tags
  ▼                                                   │      │
projects ─────────────────────────────────────────────┘      │
  │                                                          │
  ├──< milestones                                            │
  │        │                                                 │
  │        └──< tasks (milestone_id)                         │
  │                                                          │
  └──< tasks ───────────< task_tags >────────────────────────┘
         │
         ├──< subtasks
         ├──< comments
         ├──< attachments
         └──< activity_logs  (juga terhubung ke workspace & project)
```

---

## 2. Konvensi Umum
- **Primary key:** `UUID` default `uuid_generate_v4()` (extension `uuid-ossp`), kecuali tabel junction yang memakai composite PK.
- **Timestamps:** `created_at` / `updated_at` bertipe `TIMESTAMPTZ NOT NULL DEFAULT now()`. Tabel immutable (`attachments`, `activity_logs`, `task_tags`) hanya memiliki `created_at`.
- **Soft delete:** `deleted_at TIMESTAMPTZ` pada `projects`, `tasks`, `comments`. Index terkait memakai partial index `WHERE deleted_at IS NULL`.
- **Penamaan constraint:** `pk_*`, `uq_*`, `chk_*`, `idx_*`, trigger `trg_<table>_*`.

---

## 3. Enums
| Enum | Nilai |
| :--- | :--- |
| `member_role` | `owner`, `admin`, `member`, `viewer` |
| `project_status` | `planning`, `active`, `on_hold`, `completed` |
| `task_status` | `backlog`, `in_progress`, `in_review`, `done` |
| `task_priority` | `low`, `medium`, `high`, `urgent` |

---

## 4. Data Dictionary

### `users`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | ID user |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE `lower(email)` | Email login (case-insensitive) |
| `password_hash` | `TEXT` | NOT NULL | Hash Argon2id |
| `full_name` | `VARCHAR(150)` | NOT NULL | Nama tampilan |
| `avatar_url` | `TEXT` | Nullable | URL avatar |

### `refresh_tokens`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK -> `users(id)` ON DELETE CASCADE | |
| `family_id` | `UUID` | NOT NULL | Rantai rotasi satu sesi login |
| `token_hash` | `VARCHAR(64)` | UNIQUE, NOT NULL | SHA-256 dari token opaque (token asli tidak pernah disimpan) |
| `user_agent` | `VARCHAR(255)` | Nullable | Info perangkat |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | |
| `revoked_at` | `TIMESTAMPTZ` | Nullable | Terisi saat dirotasi / logout. Pemakaian ulang token yang sudah dicabut → seluruh `family_id` dicabut |

### `workspaces`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK, Default `uuid_generate_v4()` | ID Workspace |
| `name` | `VARCHAR(150)` | NOT NULL | Nama ruang kerja / tim |
| `slug` | `VARCHAR(150)` | UNIQUE, NOT NULL, CHECK kebab-case | URL identifier (e.g. `acme-corp`) |
| `owner_id` | `UUID` | FK -> `users(id)` ON DELETE RESTRICT, NOT NULL | Pemilik utama workspace |

### `workspace_members`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `workspace_id` | `UUID` | PK (komposit), FK -> `workspaces(id)` ON DELETE CASCADE | |
| `user_id` | `UUID` | PK (komposit), FK -> `users(id)` ON DELETE CASCADE | |
| `role` | `member_role` | NOT NULL, DEFAULT `member` | Basis RBAC |

### `projects`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | ID Proyek |
| `workspace_id`| `UUID` | FK -> `workspaces(id)` ON DELETE CASCADE | Pemilik proyek |
| `name` | `VARCHAR(150)` | NOT NULL | Nama proyek |
| `key_prefix` | `VARCHAR(10)` | NOT NULL, CHECK `^[A-Z][A-Z0-9]{1,9}$`, UNIQUE (`workspace_id`, `key_prefix`) untuk baris aktif | Prefix kode task (misal: `PRJ`) |
| `description` | `TEXT` | Nullable | |
| `status` | `project_status`| NOT NULL, DEFAULT `planning` | Status proyek |
| `start_date` / `target_date` | `DATE` | CHECK `target_date >= start_date` | Rentang waktu proyek |
| `task_counter` | `INT` | NOT NULL, DEFAULT 0 | Nomor task terakhir (dikelola trigger) |
| `created_by` | `UUID` | FK -> `users(id)` ON DELETE SET NULL | |
| `deleted_at` | `TIMESTAMPTZ` | Nullable | Soft delete |

### `milestones`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | |
| `project_id` | `UUID` | FK -> `projects(id)` ON DELETE CASCADE | |
| `name` | `VARCHAR(150)` | NOT NULL | Nama fase / sprint |
| `description` | `TEXT` | Nullable | |
| `start_date` / `due_date` | `DATE` | CHECK `due_date >= start_date` | |
| `completed_at` | `TIMESTAMPTZ` | Nullable | Terisi saat milestone selesai |
| `sort_order` | `INT` | NOT NULL, DEFAULT 0 | Urutan roadmap |

### `tasks`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PK | ID Task |
| `project_id` | `UUID` | FK -> `projects(id)` ON DELETE CASCADE, immutable | Parent project |
| `milestone_id`| `UUID` | FK -> `milestones(id)` ON DELETE SET NULL | Milestone task |
| `task_number`| `INT` | NOT NULL, UNIQUE(`project_id`, `task_number`), immutable | Nomor urut task, diisi trigger |
| `title` | `VARCHAR(255)` | NOT NULL | Judul task |
| `description` | `TEXT` | Nullable | Rich-text (disanitasi di API) |
| `status` | `task_status` | NOT NULL, DEFAULT `backlog` | Tahap Kanban |
| `priority` | `task_priority` | NOT NULL, DEFAULT `medium` | Tingkat urgensi |
| `sort_order` | `INT` | NOT NULL, DEFAULT 0 | Urutan drag-and-drop di Kanban (lihat §6) |
| `assignee_id` / `reporter_id` | `UUID` | FK -> `users(id)` ON DELETE SET NULL | |
| `start_date` / `due_date` | `DATE` | CHECK `due_date >= start_date` | Timeline & overdue |
| `estimate_hours`| `NUMERIC(5,2)` | Nullable, CHECK `>= 0` | Estimasi durasi (jam) |
| `actual_hours`| `NUMERIC(5,2)` | NOT NULL, DEFAULT 0, CHECK `>= 0` | Jam aktual tercatat |
| `completed_at` | `TIMESTAMPTZ` | Nullable | Untuk metrik "Completed Tasks (Weekly)" |
| `deleted_at` | `TIMESTAMPTZ` | Nullable | Soft delete |

### `tags` & `task_tags`
| Tabel.Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `tags.workspace_id` | `UUID` | FK -> `workspaces(id)` ON DELETE CASCADE | Tag dipakai ulang lintas project |
| `tags.name` | `VARCHAR(50)` | NOT NULL, UNIQUE (`workspace_id`, `lower(name)`) | |
| `tags.color` | `VARCHAR(7)` | NOT NULL, CHECK `^#[0-9A-Fa-f]{6}$` | Warna label kustom |
| `task_tags.(task_id, tag_id)` | `UUID` | PK komposit, FK CASCADE ke `tasks` & `tags` | |

### `subtasks`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `task_id` | `UUID` | FK -> `tasks(id)` ON DELETE CASCADE | |
| `title` | `VARCHAR(255)` | NOT NULL | Item checklist |
| `is_completed` | `BOOLEAN` | NOT NULL, DEFAULT false | Basis progress bar |
| `completed_at` | `TIMESTAMPTZ` | Nullable | |
| `sort_order` | `INT` | NOT NULL, DEFAULT 0 | |

### `comments`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `task_id` | `UUID` | FK -> `tasks(id)` ON DELETE CASCADE | |
| `author_id` | `UUID` | FK -> `users(id)` ON DELETE SET NULL | |
| `body` | `TEXT` | NOT NULL | Markdown mentah dari user (untuk edit; tidak pernah dirender langsung) |
| `body_html` | `TEXT` | NOT NULL, DEFAULT `''` | Render Markdown → HTML yang disanitasi (allowlist) oleh API; HTML mentah di-escape |
| `deleted_at` | `TIMESTAMPTZ` | Nullable | Soft delete |

### `attachments` (immutable)
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `task_id` | `UUID` | FK -> `tasks(id)` ON DELETE CASCADE | |
| `uploaded_by` | `UUID` | FK -> `users(id)` ON DELETE SET NULL | |
| `file_name` / `mime_type` | `VARCHAR(255)` / `VARCHAR(127)` | NOT NULL | Metadata preview |
| `size_bytes` | `BIGINT` | NOT NULL, CHECK `>= 0` | |
| `storage_key` | `TEXT` | NOT NULL | Key file di disk lokal `<task_id>/<uuid>` relatif ke `STORAGE_DIR` (dibuat server, bukan dari nama file user) |

### `notifications`
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `user_id` | `UUID` | FK -> `users(id)` ON DELETE CASCADE, NOT NULL | Penerima |
| `workspace_id` | `UUID` | FK -> `workspaces(id)` ON DELETE CASCADE, NOT NULL | |
| `project_id` / `task_id` | `UUID` | FK CASCADE, nullable | Target navigasi |
| `actor_id` | `UUID` | FK -> `users(id)` ON DELETE SET NULL | Pemicu |
| `type` | `VARCHAR(40)` | NOT NULL | `task.assigned` · `comment.mention` · `comment.created` |
| `metadata` | `JSONB` | NOT NULL, DEFAULT `{}` | `{ key, title, excerpt?, commentId? }` |
| `read_at` | `TIMESTAMPTZ` | Nullable | Terisi saat dibaca |

Index: `idx_notifications_user (user_id, created_at DESC)`, partial `idx_notifications_unread (user_id) WHERE read_at IS NULL`.

### `activity_logs` (append-only)
| Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `workspace_id` | `UUID` | FK -> `workspaces(id)` ON DELETE CASCADE, NOT NULL | Feed workspace |
| `project_id` | `UUID` | FK -> `projects(id)` ON DELETE CASCADE | Feed proyek |
| `task_id` | `UUID` | FK -> `tasks(id)` ON DELETE SET NULL | Riwayat task |
| `actor_id` | `UUID` | FK -> `users(id)` ON DELETE SET NULL | Pelaku |
| `action` | `VARCHAR(50)` | NOT NULL | Format `<entity>.<verb>`: `task.created`, `task.moved`, `comment.created` |
| `entity_type` / `entity_id` | `VARCHAR(30)` / `UUID` | NOT NULL | Target aksi |
| `metadata` | `JSONB` | NOT NULL, DEFAULT `{}` | Payload diff (misal `{from, to}`) |

---

## 5. Query Optimizations & Indexing
- `idx_tasks_project`: Mengakselerasi pemuatan halaman board per proyek.
- `idx_tasks_status`: Indeks komposit `(project_id, status, sort_order)` untuk rendering kolom Kanban instan tanpa sort tambahan.
- `idx_activity_project`: Mengoptimalkan pembacaan riwayat aktivitas dengan sorting `created_at DESC`. Pendamping: `idx_activity_workspace`, `idx_activity_task`.
- Lainnya: `idx_refresh_tokens_user` (partial, token aktif), `idx_refresh_tokens_family`, `idx_tasks_milestone`, `idx_tasks_assignee`, `idx_projects_workspace`, `idx_workspace_members_user`, `idx_milestones_project`, `idx_subtasks_task`, `idx_comments_task`, `idx_attachments_task`, `idx_task_tags_tag`.
- Seluruh index pada tabel ber-soft-delete adalah partial index `WHERE deleted_at IS NULL`.

---

## 6. Kanban Ordering (`sort_order`)
- Nilai awal berjarak `SORT_ORDER_GAP = 1024` per kolom (1024, 2048, 3072, ...). Urutan kolom: `ORDER BY status, sort_order, id`.
- Client mengirim posisi relatif: `prevTaskId` (kartu di atas) **atau** `nextTaskId` (kartu di bawah). Tetangga lainnya dicari server dari data aktual, sehingga aman terhadap tampilan yang terfilter/usang.
- Memindahkan kartu cukup meng-update satu baris dengan nilai tengah antara tetangga atas/bawah.
- Jika jarak antar tetangga habis (selisih < 2) atau mendekati batas INT, kolom tersebut di-rebalance ulang dalam transaksi yang sama (respons `rebalanced: true` → client refetch kolom).
- Semua operasi urutan per project diserialisasi dengan `pg_advisory_xact_lock(hashtextextended(project_id, 0))`.

---

## 7. Triggers & Automation
- `set_updated_at()`: tabel `users`, `workspaces`, `workspace_members`, `projects`, `milestones`, `tasks`, `tags`, `subtasks`, `comments` otomatis mengubah kolom `updated_at` menjadi `CURRENT_TIMESTAMP` sebelum operasi `UPDATE` dieksekusi.
- `assign_task_number()` (`BEFORE INSERT ON tasks`): jika `task_number` NULL, menaikkan `projects.task_counter` secara atomik (row lock) dan memakainya sebagai nomor task, sehingga aman terhadap insert paralel.
- `prevent_task_identity_change()` (`BEFORE UPDATE OF task_number, project_id ON tasks`): menolak perubahan identitas task agar key `PRJ-42` permanen.
- `sync_task_completed_at()` / `sync_subtask_completed_at()`: mengisi `completed_at` saat status menjadi `done` / `is_completed = true`, dan mengosongkannya bila dibuka kembali.

### 7.1 Activity Log Otomatis
Trigger `AFTER` menulis `activity_logs` secara otomatis, sehingga audit trail tidak bergantung pada disiplin kode aplikasi.

| Trigger | Action yang dicatat |
| :--- | :--- |
| `trg_projects_activity` | `project.created`, `project.updated` (`fields`), `project.status_changed`, `project.deleted`, `project.restored` |
| `trg_milestones_activity` | `milestone.created`, `milestone.updated`, `milestone.completed`, `milestone.reopened`, `milestone.deleted` |
| `trg_tasks_activity` | `task.created`, `task.moved` (`from`/`to`), `task.assigned`, `task.priority_changed`, `task.updated` (`fields`), `task.deleted`, `task.restored` |
| `trg_task_tags_activity` | `task.tag_added`, `task.tag_removed` |
| `trg_attachments_activity` | `attachment.added`, `attachment.removed` (`fileName`, `sizeBytes`) |
| `trg_subtasks_activity` | `subtask.created`, `subtask.completed`, `subtask.reopened`, `subtask.updated`, `subtask.deleted` |
| `trg_comments_activity` | `comment.created`, `comment.edited`, `comment.deleted` (`excerpt`) |

- **Aktor:** API menjalankan setiap mutasi dalam transaksi dengan `SELECT set_config('app.actor_id', '<user uuid>', true)`; trigger membacanya lewat `activity_actor()`.
- **Bypass:** `set_config('app.skip_activity', 'on', true)` mematikan log (dipakai seeder/import).
- **Metadata** selalu menyertakan `key` task (`PRJ-42`) agar feed bisa dirender tanpa join tambahan.
- Perubahan yang hanya menyentuh `sort_order` / `task_counter` tidak dicatat.
- DELETE hasil cascade (`pg_trigger_depth() > 1`) tidak dicatat, sehingga penghapusan workspace/project tidak gagal.

### 7.2 Realtime (`pg_notify`)
Trigger `AFTER INSERT` pada `activity_logs` dan `notifications`, serta `AFTER UPDATE OF sort_order` pada `tasks`
(reorder di dalam kolom, yang tidak masuk activity log), mengirim payload ringkas ke channel **`pt_events`**:
`{ type: 'activity' | 'notification', workspaceId, projectId?, taskId?, actorId?, action?, userId? }` — hanya ID
(batas pg_notify 8 KB). API `LISTEN pt_events` dan meneruskannya via Server-Sent Events; client me-refetch data terkait.
