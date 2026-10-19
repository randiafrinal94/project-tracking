# Export & Import Database (pindah laptop)

Runbook untuk memindahkan database PostgreSQL project ini dari satu laptop ke laptop lain.
Ditulis agar bisa dibaca dan dieksekusi langkah demi langkah oleh AI Agent.

- **Bagian A** — export, dijalankan di laptop **sumber** (yang database-nya sudah berisi data).
- **Bagian B** — import, dijalankan di laptop **tujuan**.

## Aturan untuk AI Agent

1. Jalankan langkah **berurutan**. Jika satu langkah gagal atau hasilnya tidak sesuai "Hasil yang diharapkan", **berhenti** dan laporkan ke user beserta output-nya. Jangan improvisasi.
2. **Jangan** jalankan `pnpm db:migrate`, `pnpm db:reset`, atau `docker compose down -v` sebelum import selesai.
3. Jika database tujuan ternyata **sudah berisi tabel** (cek di langkah B4), **tanya user dulu** sebelum menimpa — restore memakai `--clean` yang menghapus isi lama.
4. Jangan `git commit` / `git push` file dump kecuali user memintanya.
5. Semua perintah di bawah memakai `docker exec` / `docker cp` sehingga bisa dijalankan di **PowerShell** maupun **bash**. Khusus **Git Bash di Windows**, jalankan dulu `export MSYS_NO_PATHCONV=1` (kalau tidak, path `/tmp/...` diubah menjadi path Windows dan perintah gagal).
6. **Jangan** pakai redirect `>` / `<` untuk file dump di PowerShell — PowerShell merusak file biner. Gunakan `-f` dan `docker cp` seperti di bawah.

## Konfigurasi yang dipakai

| Item | Nilai |
|---|---|
| Container | `pt-postgres` (service `postgres` di [docker-compose.yml](docker-compose.yml)) |
| Image | `postgres:16-alpine` |
| User DB | `tracker` |
| Nama DB | `project_tracker` |
| Volume | `project-tracker_pgdata` |
| Folder dump | `backups/` (di root repo) |
| Format dump | `pg_dump -Fc` (custom, terkompresi), `--no-owner --no-acl` |

Jika `POSTGRES_USER` / `POSTGRES_DB` di `.env` berbeda, ganti `tracker` / `project_tracker` di semua perintah.

---

## Dump yang sudah tersedia

Dump sudah dibuat pada **2026-10-19** dan sudah diuji restore ke database sementara (hasil identik):

| Item | Nilai |
|---|---|
| File | `backups/project_tracker_2026-10-19.dump` |
| Ukuran | 72.032 byte |
| SHA-256 | `d110e148e9ca057eda6f5ca2eb5a8f526badd3ca0c1456f39e966f29dcc3d083` |

**Isi data (untuk verifikasi setelah import):**

| Tabel | Baris |
|---|---|
| `users` | 1 |
| `workspaces` | 1 |
| `workspace_members` | 1 |
| `refresh_tokens` | 5 |
| `drizzle.__drizzle_migrations` | 10 |
| `projects`, `milestones`, `tasks`, `subtasks`, `tags`, `task_tags`, `comments`, `attachments`, `activity_logs`, `notifications` | 0 |

**Objek database:** 29 function, 23 trigger, 4 enum, 39 index (schema `public`).

Jika memakai dump ini, **lewati Bagian A** dan langsung ke Bagian B.
Jika ingin dump yang lebih baru, jalankan Bagian A lalu perbarui tabel di atas.

---

## Bagian A — Export (laptop sumber)

Jalankan dari root repo.

### A1. Pastikan container berjalan

```sh
docker ps --filter name=pt-postgres --format "{{.Names}} {{.Status}}"
```

Hasil yang diharapkan: `pt-postgres Up ... (healthy)`.
Jika tidak berjalan: `docker compose up -d postgres`, lalu ulangi cek ini.

### A2. Buat dump di dalam container

Ganti `2026-10-19` dengan tanggal hari ini (format `YYYY-MM-DD`) di langkah A2–A4.

```sh
docker exec pt-postgres pg_dump -U tracker -d project_tracker -Fc -Z 9 --no-owner --no-acl -f /tmp/project_tracker.dump
```

Hasil yang diharapkan: tidak ada output, exit code 0.

### A3. Salin dump ke folder `backups/` dan bersihkan container

```sh
mkdir backups
docker cp pt-postgres:/tmp/project_tracker.dump backups/project_tracker_2026-10-19.dump
docker exec pt-postgres rm /tmp/project_tracker.dump
```

(`mkdir` boleh error "already exists" — abaikan.)

### A4. Catat checksum dan isi data

Checksum:

```powershell
# PowerShell
Get-FileHash backups/project_tracker_2026-10-19.dump -Algorithm SHA256
```

```sh
# bash
sha256sum backups/project_tracker_2026-10-19.dump
```

Jumlah baris (jalankan di database sumber, simpan hasilnya untuk dibandingkan di B6):

```sh
docker exec pt-postgres psql -U tracker -d project_tracker -c "select (select count(*) from users) as users, (select count(*) from workspaces) as workspaces, (select count(*) from workspace_members) as members, (select count(*) from projects) as projects, (select count(*) from tasks) as tasks, (select count(*) from comments) as comments, (select count(*) from attachments) as attachments, (select count(*) from notifications) as notifications, (select count(*) from drizzle.__drizzle_migrations) as migrations;"
```

Perbarui bagian **"Dump yang sudah tersedia"** di dokumen ini dengan nama file, ukuran, checksum, dan jumlah baris yang baru.

### A5. File lampiran (opsional)

Lampiran tidak disimpan di database, tapi di disk: folder `storage/uploads` (lihat `STORAGE_DIR` di `.env`). Jika folder itu berisi file, salin seluruh folder `storage/` ke laptop tujuan juga. Folder ini di-`.gitignore`, jadi tidak ikut lewat git.

### A6. Pindahkan file ke laptop tujuan

Salin ke laptop tujuan (flashdisk, Google Drive, dll.):

- `backups/project_tracker_<tanggal>.dump`
- `storage/` (jika ada isinya)
- `.env` (opsional — file ini tidak ada di git; kalau tidak dibawa, buat dari `.env.example` di B2)

> Dump berisi hash password user dan refresh token. Perlakukan sebagai data sensitif; jangan unggah ke repo publik.

---

## Bagian B — Import (laptop tujuan)

Jalankan dari root repo di laptop tujuan.

### B1. Cek prasyarat

```sh
docker --version
docker compose version
git status
```

Hasil yang diharapkan: Docker dan Docker Compose terpasang, Docker Desktop sedang berjalan, dan direktori saat ini adalah root repo (ada `docker-compose.yml`).

Pastikan file dump ada di `backups/`: `ls backups` (bash) / `Get-ChildItem backups` (PowerShell).

Verifikasi checksum sama dengan yang tercatat di bagian "Dump yang sudah tersedia":

```powershell
# PowerShell
Get-FileHash backups/project_tracker_2026-10-19.dump -Algorithm SHA256
```

```sh
# bash
sha256sum backups/project_tracker_2026-10-19.dump
```

Jika checksum berbeda → file rusak saat dipindahkan. Berhenti dan laporkan ke user.

### B2. Siapkan `.env`

Jika `.env` belum ada di root repo:

```powershell
# PowerShell
Copy-Item .env.example .env
```

```sh
# bash
cp .env.example .env
```

Pastikan `POSTGRES_USER=tracker` dan `POSTGRES_DB=project_tracker`. Password boleh berbeda dari laptop sumber (dump dibuat dengan `--no-owner`), asalkan `DATABASE_URL` memakai password yang sama dengan `POSTGRES_PASSWORD`.

Catatan: nilai `POSTGRES_*` hanya dipakai saat volume database **pertama kali** dibuat.

### B3. Jalankan container PostgreSQL

Cek dulu port 5432 tidak dipakai container lain:

```sh
docker ps --format "{{.Names}} {{.Ports}}"
```

Jika ada container lain yang memakai `5432`, tanya user: hentikan container itu, atau ubah `POSTGRES_PORT` di `.env` (dan port di `DATABASE_URL`).

```sh
docker compose up -d postgres
docker inspect -f "{{.State.Health.Status}}" pt-postgres
```

Ulangi perintah `docker inspect` (tunggu beberapa detik di antaranya) sampai hasilnya `healthy`. Jika lebih dari 1 menit belum `healthy`, cek `docker compose logs postgres` dan laporkan ke user.

### B4. Pastikan database tujuan kosong

```sh
docker exec pt-postgres psql -U tracker -d project_tracker -Atc "select count(*) from information_schema.tables where table_schema in ('public','drizzle');"
```

- Hasil `0` → database kosong, lanjut ke B5.
- Hasil lebih dari `0` → database sudah berisi tabel (misalnya pernah `pnpm db:migrate` atau dipakai sebelumnya). **Berhenti dan tanya user** apakah isinya boleh ditimpa. Jika user setuju, lanjut ke B5 (`--clean` akan menghapus objek lama yang ada di dump lalu membuatnya ulang).

### B5. Restore dump

```sh
docker cp backups/project_tracker_2026-10-19.dump pt-postgres:/tmp/import.dump
docker exec pt-postgres pg_restore -U tracker -d project_tracker --no-owner --no-acl --clean --if-exists --exit-on-error /tmp/import.dump
docker exec pt-postgres rm /tmp/import.dump
```

Hasil yang diharapkan: `pg_restore` tidak menampilkan output dan exit code 0. Jika ada error, berhenti dan laporkan output lengkapnya.

### B6. Verifikasi

Jumlah baris:

```sh
docker exec pt-postgres psql -U tracker -d project_tracker -c "select (select count(*) from users) as users, (select count(*) from workspaces) as workspaces, (select count(*) from workspace_members) as members, (select count(*) from projects) as projects, (select count(*) from tasks) as tasks, (select count(*) from comments) as comments, (select count(*) from attachments) as attachments, (select count(*) from notifications) as notifications, (select count(*) from drizzle.__drizzle_migrations) as migrations;"
```

Objek database:

```sh
docker exec pt-postgres psql -U tracker -d project_tracker -c "select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as functions, (select count(*) from pg_trigger where not tgisinternal) as triggers, (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e') as enums, (select count(*) from pg_indexes where schemaname = 'public') as indexes;"
```

Bandingkan dengan tabel di bagian "Dump yang sudah tersedia" (untuk dump 2026-10-19: users 1, workspaces 1, members 1, migrations 10, sisanya 0; functions 29, triggers 23, enums 4, indexes 39). Jika ada yang berbeda, laporkan ke user.

### B7. Cek migrasi & aplikasi

Pastikan dependency terpasang (`pnpm install` jika `node_modules` belum ada), lalu:

```sh
pnpm db:migrate
```

Hasil yang diharapkan: `✔ Migrasi selesai` tanpa menerapkan migrasi baru (tabel `drizzle.__drizzle_migrations` ikut ter-restore, jadi migrasi yang sudah ada dilewati). Jika repo di laptop tujuan punya migrasi yang lebih baru dari dump, migrasi tersebut akan diterapkan di sini — itu normal.

Jika di langkah A5 ada folder `storage/` yang dibawa, letakkan di root repo laptop tujuan (sesuai `STORAGE_DIR`).

Jalankan aplikasi (`pnpm dev:api` dan `pnpm dev:web`) lalu coba login dengan akun yang ada di laptop sumber. Jika `JWT_SECRET` di laptop tujuan berbeda, sesi lama tidak berlaku — cukup login ulang; password tetap sama.

### Selesai

Laporkan ke user: file dump yang dipakai, hasil checksum, hasil verifikasi B6, dan output `pnpm db:migrate`.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `could not open output file "C:/Users/.../Temp/..."` | Git Bash mengubah path `/tmp`. Jalankan `export MSYS_NO_PATHCONV=1` lalu ulangi. |
| `pg_restore: error: input file does not appear to be a valid archive` | File dump rusak (biasanya karena redirect `>` di PowerShell, atau transfer tidak lengkap). Cek checksum; buat ulang dump dengan langkah A2–A3. |
| `password authentication failed for user "tracker"` saat `pnpm db:migrate` / API | Password di `DATABASE_URL` tidak sama dengan password database. Volume lama masih memakai password lama — samakan `DATABASE_URL`, atau (jika database boleh dikosongkan, **tanya user dulu**) `docker compose down -v` lalu ulangi dari B3. |
| `role "tracker" does not exist` | `POSTGRES_USER` di `.env` berbeda saat volume dibuat. Pakai user tersebut di semua perintah, atau ganti `tracker` sesuai `.env`. |
| `port is already allocated` | Port 5432 dipakai container/aplikasi lain. Lihat B3. |
| `pg_restore: error: unsupported version (1.xx) in file header` | Versi `pg_restore` lebih lama dari `pg_dump`. Pastikan image tetap `postgres:16-alpine` (jangan pakai `pg_restore` dari instalasi PostgreSQL lokal yang lebih lama). |
