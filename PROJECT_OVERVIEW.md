# Project Tracker — Panduan Aplikasi

Dokumen ini menjelaskan **apa itu Project Tracker**, **fungsi setiap menu**, dan **setiap aspek** yang ada di aplikasi:
hak akses, alur kerja task, kolaborasi, notifikasi, metrik, arsitektur teknis, serta cara menjalankannya.

> Dokumen terkait: [README.md](README.md) (setup & daftar endpoint API) · [PRD.md](PRD.md) (kebutuhan produk) ·
> [DESIGN.md](DESIGN.md) (design system) · [DATABASE.md](DATABASE.md) (skema database) ·
> [DB_EXPORT_IMPORT.md](DB_EXPORT_IMPORT.md) (backup & restore database).

---

## Daftar Isi

1. [Ringkasan](#1-ringkasan)
2. [Konsep Dasar](#2-konsep-dasar)
3. [Peran & Hak Akses](#3-peran--hak-akses)
4. [Alur Masuk: Registrasi, Login, Onboarding](#4-alur-masuk-registrasi-login-onboarding)
5. [Tata Letak Aplikasi](#5-tata-letak-aplikasi)
6. [Menu-Menu Aplikasi](#6-menu-menu-aplikasi)
   - [6.1 Dashboard](#61-dashboard)
   - [6.2 Projects](#62-projects)
   - [6.3 Halaman Detail Project](#63-halaman-detail-project)
   - [6.4 Tasks (List & Kanban)](#64-tasks-list--kanban)
   - [6.5 Milestones](#65-milestones)
   - [6.6 Team Workload](#66-team-workload)
   - [6.7 Reports](#67-reports)
   - [6.8 Settings](#68-settings)
7. [Detail Task (Task Modal)](#7-detail-task-task-modal)
8. [Notifikasi & Realtime](#8-notifikasi--realtime)
9. [Aturan Bisnis & Rumus Metrik](#9-aturan-bisnis--rumus-metrik)
10. [Keamanan](#10-keamanan)
11. [Arsitektur Teknis](#11-arsitektur-teknis)
12. [Menjalankan Project](#12-menjalankan-project)

---

## 1. Ringkasan

**Project Tracker** adalah aplikasi manajemen proyek dan kolaborasi tim, ditujukan untuk tim produk, engineering, dan agensi.
Fokusnya pada alur kerja visual (Kanban & Gantt), transparansi progres, dan pemantauan beban kerja tim secara realtime.

Kemampuan utama:

| Area | Fitur |
| :--- | :--- |
| Multi-tenant | Banyak **workspace**; tiap workspace punya anggota dengan role sendiri |
| Proyek | CRUD project dengan **key prefix** (mis. `PRJ`), status, tanggal mulai & target |
| Task | Kanban drag-and-drop, Gantt timeline, list view, ID task otomatis (`PRJ-42`) |
| Detail task | Editor rich-text, checklist/subtask, lampiran file, komentar Markdown dengan `@mention`, balasan & like, time tracking, tag, milestone |
| Perencanaan | Milestone (fase/sprint) dengan progres otomatis |
| Analitik | KPI dashboard, beban kerja tim, laporan throughput & cycle time, ekspor CSV |
| Kolaborasi | Notifikasi in-app & activity feed yang diperbarui realtime (Server-Sent Events) |

---

## 2. Konsep Dasar

```
Workspace ──┬── Anggota (owner / admin / member / viewer)
            ├── Tags (dipakai bersama semua project)
            └── Project (key prefix, mis. "CORE")
                  ├── Milestone (fase / sprint)
                  └── Task  "CORE-1", "CORE-2", ...
                        ├── Subtask (checklist)
                        ├── Komentar (+ balasan, like, @mention)
                        ├── Lampiran (file)
                        └── Riwayat aktivitas
```

| Istilah | Penjelasan |
| :--- | :--- |
| **Workspace** | Ruang kerja satu tim/perusahaan. URL aplikasi selalu diawali slug workspace, mis. `/marketing-team/...` |
| **Project** | Kumpulan task untuk satu deliverable. Punya **key prefix** 2–10 huruf kapital/angka yang **tidak bisa diubah** setelah dibuat |
| **Task** | Unit pekerjaan. Kodenya `{PREFIX}-{nomor}` dan nomornya diberikan otomatis oleh database |
| **Milestone** | Pengelompokan task per fase/sprint dengan tanggal mulai & jatuh tempo |
| **Tag** | Label berwarna milik workspace, bisa dipakai di semua project |

**Status task** (kolom Kanban): `Backlog` → `In Progress` → `In Review` → `Done`.
**Prioritas task:** `Urgent`, `High`, `Medium`, `Low`.
**Status project:** `Planning`, `Active`, `On Hold`, `Completed`.

---

## 3. Peran & Hak Akses

Setiap user punya satu role **per workspace**. Urutan kekuatan: `viewer` < `member` < `admin` < `owner`.

| Role | Untuk siapa | Ringkasan |
| :--- | :--- | :--- |
| **Owner** | Pemilik workspace | Semua hak admin + kelola admin + hapus workspace. Role ini permanen. |
| **Admin** | Project manager / lead | Mengelola project, task, milestone, tag, dan anggota (kecuali admin lain) |
| **Member** | Kontributor | Mengerjakan **task yang di-assign kepadanya saja** |
| **Viewer** | Stakeholder / klien | Hanya melihat (read-only) |

### Matriks hak akses

| Aksi | Viewer | Member | Admin | Owner |
| :--- | :---: | :---: | :---: | :---: |
| Melihat dashboard, project, milestone, workload, reports | ✅ | ✅ | ✅ | ✅ |
| Melihat task | Semua task | **Hanya task miliknya** | Semua | Semua |
| Membuat / mengedit / menghapus project | — | — | ✅ | ✅ |
| Membuat task (Quick task di Kanban) | — | — | ✅ | ✅ |
| Mengedit task: status, judul, deskripsi, tanggal, jam, milestone, tag | — | ✅ (task sendiri) | ✅ | ✅ |
| Mengubah assignee task | — | — | ✅ | ✅ |
| Menghapus task (soft delete) / restore | — | — | ✅ | ✅ |
| Subtask, komentar, like, balasan, upload lampiran | — | ✅ (task sendiri) | ✅ | ✅ |
| Edit komentar | Penulis saja | Penulis saja | Penulis saja | Penulis saja |
| Hapus komentar / lampiran | — | Milik sendiri | ✅ | ✅ |
| Membuat tag | — | ✅ | ✅ | ✅ |
| Rename / hapus tag | — | — | ✅ | ✅ |
| Membuat / menyelesaikan / menghapus milestone | — | — | ✅ | ✅ |
| Mengubah nama & slug workspace | — | — | ✅ | ✅ |
| Menambah anggota (role member/viewer) | — | — | ✅ | ✅ |
| Menambah / mengubah / mengeluarkan **admin** | — | — | — | ✅ |
| Menghapus workspace | — | — | — | ✅ |

Aturan tambahan:

- Task hanya bisa di-assign ke anggota ber-role **member** (owner, admin, dan viewer tidak muncul di pilihan assignee).
- Role `owner` tidak bisa diberikan, diubah, atau dikeluarkan. Tidak ada user yang bisa mengubah role-nya sendiri.
- Non-anggota yang membuka workspace/project/task mendapat **404**, bukan 403, supaya keberadaan data tidak bocor.
  Hal yang sama berlaku untuk member yang membuka task yang bukan miliknya.
- Hanya akun **level owner** (`can_create_workspace = true`) yang boleh membuat workspace baru.
  Akun pertama yang mendaftar di instalasi baru otomatis menjadi akun level owner.

---

## 4. Alur Masuk: Registrasi, Login, Onboarding

### Halaman `/login`

Satu halaman dengan dua mode:

| Mode | Isi | Hasil |
| :--- | :--- | :--- |
| **Sign in** | Email + password (ada tombol show/hide password) | Masuk ke workspace pertama, atau ke `?next=` bila ada (hanya path internal yang diizinkan) |
| **Create account** | Nama lengkap, email, password (min. 8 karakter, berisi huruf & angka) | Akun dibuat, lalu kembali ke mode Sign in dengan pesan *Registration successful* |

Pesan yang mungkin muncul:

- **Registration successful**: akun sudah dibuat, tetapi baru bisa dipakai setelah owner/admin menambahkannya ke sebuah workspace.
- **No workspace assigned**: akun belum menjadi anggota workspace mana pun (dan bukan akun level owner), sehingga login ditolak.
- Error validasi per field, atau pesan kredensial salah. Login & registrasi dibatasi jumlah percobaannya per IP per menit.

### Halaman `/` (root)

Halaman pengarah otomatis: belum login → `/login`; sudah login → workspace pertama; belum punya workspace → `/onboarding`.

### Halaman `/onboarding` — Create a workspace

Form satu field (**Workspace name**). Slug URL dibuat otomatis dari nama, dan pembuat menjadi **owner**.
Jika akun bukan level owner, halaman ini hanya menampilkan pesan *Can't create a workspace*.

### Alur instalasi baru

1. Buka `/login` → **Create account**. Akun pertama otomatis menjadi akun level owner.
2. Login → diarahkan ke `/onboarding` → buat workspace.
3. User lain mendaftar sendiri, lalu owner/admin menambahkan mereka lewat **Settings → Members** memakai email.

---

## 5. Tata Letak Aplikasi

Semua halaman di dalam workspace (`/:workspace/...`) memakai kerangka yang sama: **sidebar** di kiri dan **header** di atas.
Di layar kecil sidebar menjadi menu geser (tombol ☰), di tablet sidebar menjadi deretan ikon saja.

### Sidebar

| Elemen | Fungsi |
| :--- | :--- |
| Logo **Project Tracker** | Kembali ke Dashboard workspace |
| **Workspace switcher** | Berpindah ke workspace lain. Akun level owner juga melihat **Create workspace** |
| **Dashboard** | Ringkasan workspace ([6.1](#61-dashboard)) |
| **Projects** (+ jumlah project) | Daftar project ([6.2](#62-projects)) |
| **Tasks** → *Kanban* / *List* | Task lintas project ([6.4](#64-tasks-list--kanban)) |
| **Milestones** | Roadmap milestone ([6.5](#65-milestones)) |
| **Team Workload** | Beban kerja anggota ([6.6](#66-team-workload)) |
| **Reports** | Laporan & grafik ([6.7](#67-reports)) |
| **Settings** | Pengaturan workspace & profil ([6.8](#68-settings)) |

### Header

| Elemen | Fungsi |
| :--- | :--- |
| **Breadcrumb** | Posisi saat ini, mis. `Workspace / Projects / Mobile App`. Tiap bagian bisa diklik |
| **Kotak pencarian** (`Ctrl/⌘ + K`) | Mencari project berdasarkan nama atau key prefix, lalu membuka halaman Projects dengan filter tersebut |
| **+ New** *(admin/owner)* | Membuka dialog **New project** |
| **🔔 Notifikasi** | Daftar notifikasi beserta badge jumlah belum dibaca ([8](#8-notifikasi--realtime)) |
| **? Help & Resources** | Tombol bantuan (belum memiliki aksi) |
| **Avatar akun** | Nama, email, workspace aktif, role Anda, dan tombol **Sign out** |

---

## 6. Menu-Menu Aplikasi

### 6.1 Dashboard

**URL:** `/:workspace` — ringkasan kesehatan seluruh workspace.

**Header halaman:** nama workspace, jumlah project aktif, jumlah anggota, role Anda, slug workspace,
serta tombol **All projects** dan **New project** (admin).

**4 kartu KPI:**

| Kartu | Isi |
| :--- | :--- |
| **Active Projects** | Jumlah project berstatus Active dari total project, dan berapa project yang punya task overdue |
| **Tasks Completed** | Task selesai **minggu ini**, perbandingan % terhadap minggu lalu, progress bar task Done dari total task, dan jumlah task In Review |
| **Overdue Items** | Jumlah task yang lewat due date dan belum Done. Label *Immediate Action* / *On track*, plus project yang paling terdampak beserta tombol **Open** |
| **Completion Rate** | Persentase task Done dari semua task aktif, jumlah task In Progress dan Backlog |

**Konten utama:**

- **Projects**: daftar project (key, nama, jumlah task, overdue, progress %, target date, status). Klik untuk membuka project.
- **Upcoming Milestones**: 3 milestone terdekat yang belum selesai dari project aktif.
- **Live Activity**: feed aktivitas workspace yang diperbarui realtime (task dibuat, dipindah, di-assign, komentar, dll.).
- **Squad Workload**: 4 anggota teratas beserta beban kerjanya, dengan tombol **Manage Team Allocation** menuju Team Workload.

---

### 6.2 Projects

**URL:** `/:workspace/projects` — daftar semua project di workspace.

| Fitur | Fungsi |
| :--- | :--- |
| Tab filter status | **All**, **Active**, **Planning**, **On hold**, **Completed**, masing-masing dengan jumlah project |
| **Filter projects...** | Mencari berdasarkan nama atau key prefix (tersimpan di URL `?q=`) |
| **New project** *(admin)* | Membuka dialog pembuatan project |
| Baris project | Key prefix, nama, jumlah task & overdue, progress bar penyelesaian, target date (merah jika sudah lewat), dan badge status |

#### Dialog *New project*

| Field | Keterangan |
| :--- | :--- |
| Project name | Wajib, maks. 150 karakter |
| Key prefix | Wajib, 2–10 huruf kapital/angka. Otomatis diisi dari inisial nama (mis. *Mobile App Revamp* → `MAR`). Harus unik dalam workspace dan **tidak bisa diubah** setelah dibuat |
| Description | Opsional |
| Start date / Target date | Opsional; target tidak boleh sebelum start |

Setelah dibuat, Anda langsung diarahkan ke halaman project tersebut.

---

### 6.3 Halaman Detail Project

**URL:** `/:workspace/projects/:projectId` — pusat kerja sebuah project.

**Header:** nama project, badge status (beserta rentang tanggal jika Active), target date, jumlah anggota,
dan kode task terakhir (mis. `CORE-57`).

**Tombol aksi:**

| Tombol | Fungsi |
| :--- | :--- |
| **Share** | Menyalin link halaman ke clipboard |
| **Group: Status** | Pengelompokan board (saat ini hanya per status) |
| **Export** | Mengunduh **CSV** berisi semua task project: Key, Title, Status, Priority, Assignee, Tags, Due date, Estimate, Actual, Subtasks done/total, Completed at. Sel diamankan dari *formula injection* saat dibuka di spreadsheet |

**Empat tab tampilan** (tersimpan di URL `?view=`):

#### a. Overview

| Bagian | Fungsi |
| :--- | :--- |
| **About this project** | Deskripsi, status, key, tanggal mulai & target. Admin bisa mengedit deskripsi & tanggal (**Edit**) dan mengganti status lewat dropdown |
| **Work by status** | Bar distribusi task per status beserta jumlah dan persentasenya |
| **Milestones** | Daftar milestone project; admin bisa menambah, menandai selesai/membuka kembali, dan menghapus |
| **Squad on this project** | Anggota yang punya task terbuka atau menyelesaikan task minggu ini, beserta beban kerjanya |
| **Recent Activity** | 10 aktivitas terakhir di project |

#### b. Kanban Board (tampilan default)

- **4 kartu KPI project:** Total Tasks (dan milestone terbuka), Tasks Completed (x / total + %),
  Overdue Items (dengan link *Show overdue tasks on the board*), dan Milestone Progress (milestone terdekat: %, sisa hari/terlambat).
- **Workflow Matrix**: 4 kolom status. Setiap kolom menampilkan jumlah task dan total estimasi jam.
- **Drag-and-drop** kartu antar kolom atau dalam kolom untuk mengubah status/urutan (mouse & keyboard).
  Perubahan langsung tampil (*optimistic update*); jika server menolak, kartu dikembalikan ke posisi semula.
  Viewer melihat label *View only*.
- **Quick task** *(admin)*: tombol di kolom Backlog untuk membuat task cepat (ketik judul lalu Enter).
  Kolom lain bisa lewat menu `⋯` → *Add task to …*.
- Kolom besar (>200 task) memakai *virtual scrolling*, jadi hanya kartu di sekitar layar yang dirender dan halaman berikutnya dimuat otomatis.
- Panel samping: **Upcoming Milestones** dan **Live Activity** project.

**Isi kartu task:** badge prioritas (atau *Resolved* bila Done), kode task, judul (dicoret bila Done), tag,
progress subtask, due date (merah jika overdue/hari ini), jumlah komentar, jumlah lampiran, estimasi jam, dan avatar assignee.

#### c. Gantt Timeline

- Menampilkan task yang punya start date dan/atau due date sebagai bar di garis waktu, **dikelompokkan per milestone**.
- Garis vertikal **hari ini**; warna bar mengikuti status.
- Zoom **Days** atau **Weeks**.
- Member/admin dapat **menggeser bar** untuk memindah jadwal, atau **menarik tepinya** untuk mengubah start/due date.
- Task tanpa tanggal tidak muncul. Jika belum ada task terjadwal, muncul pesan *Nothing scheduled yet*.

#### d. List View

Tabel task dengan kolom **Key, Title, Status, Priority, Assignee, Due, Subtasks, Updated**.
Klik judul kolom untuk mengurutkan (key, title, priority, due, updated); data berikutnya dimuat otomatis saat menggulir.

#### Filter task (tab Kanban, Gantt, List)

| Filter | Fungsi |
| :--- | :--- |
| **Filter tasks...** | Cari judul/kode (dengan jeda 300 ms agar tidak membebani server) |
| Avatar anggota | Tampilkan task milik anggota tertentu |
| Chip tag | Filter dengan 4 tag yang paling sering dipakai |
| **Add Filter** | Prioritas, *Overdue only*, *Assigned to me*, *Unassigned*, milestone tertentu / *No milestone*, tag lainnya |
| **Clear** | Hapus semua filter |

Klik kartu/baris task mana pun membuka **Task Modal** ([bagian 7](#7-detail-task-task-modal)) dengan URL `?task=<id>` yang bisa dibagikan.

---

### 6.4 Tasks (List & Kanban)

Task **lintas semua project** di workspace, untuk melihat "pekerjaan saya" tanpa membuka project satu per satu.

#### Tasks → List (`/:workspace/tasks`)

- Default menampilkan **My tasks**, diurutkan berdasarkan due date.
- Filter: **My tasks / All tasks / Unassigned**, cari judul atau kode, pilih project, pilih status, chip prioritas, dan checkbox *Overdue*.
- Tabel seperti List View project, ditambah kolom **Project**.
- Tombol **Kanban** untuk pindah ke tampilan board.

#### Tasks → Kanban (`/:workspace/tasks/kanban`)

- Board 4 kolom status yang berisi task dari semua project.
- Drag kartu untuk **mengubah status**. Urutan dalam kolom tetap mengikuti urutan masing-masing project.
  Bisa juga lewat keyboard (←/→ pindah ke kolom sebelah).
- Filter sama dengan halaman List, kecuali filter status.

---

### 6.5 Milestones

**URL:** `/:workspace/milestones` — roadmap fase/sprint dari semua project.

| Fitur | Fungsi |
| :--- | :--- |
| Tab filter | **Open** (default), **Overdue**, **Completed**, **All**, masing-masing dengan jumlah |
| Kartu per project | Key & nama project (klik → tab Overview project) dan badge status project |
| Item milestone | Nama, badge sisa waktu (*n days left*, *Due today*, *n d overdue*, *Completed*), deskripsi, dan progress bar task |
| Aksi admin (`⋯`) | **Mark as completed / Reopen milestone**, **Delete milestone** (task di dalamnya tetap ada, hanya dilepas dari milestone) |
| **Add milestone** *(admin)* | Nama + due date |

Progres milestone = persentase task Done dari task yang terhubung ke milestone tersebut.

---

### 6.6 Team Workload

**URL:** `/:workspace/workload` — membantu lead menyeimbangkan beban kerja tim.

**Rumus beban:** `Load = jam estimasi task terbuka ÷ 40 jam kapasitas mingguan`.
Task tanpa estimasi dihitung **4 jam**.

| Bagian | Isi |
| :--- | :--- |
| Dropdown **Project** | Semua project, atau satu project tertentu |
| Badge header | *n overloaded* atau *Healthy team* |
| Tabel per anggota | Nama, role, jumlah overdue, **Open work** (jumlah task terbuka + bar komposisi Backlog/In Progress/In Review), **Load** (jam, %, label), **Done this wk** |
| **Unassigned work** | Jumlah task terbuka tanpa assignee dan perkiraan jamnya, dengan link ke halaman Tasks |
| **Legend** | Arti label beban |

Label beban:

| Label | Kondisi |
| :--- | :--- |
| **Available** | Tidak ada task terbuka |
| **Balanced** | ≤ 70% kapasitas |
| **Healthy** | 70–90% |
| **High Load** | > 90%, pertimbangkan memindahkan task |

---

### 6.7 Reports

**URL:** `/:workspace/reports` — analitik produktivitas.

**Kontrol:** rentang waktu **4 / 8 / 12 / 26 minggu** dan pilihan project.

| Bagian | Isi |
| :--- | :--- |
| **Ringkasan** | Tasks completed, Avg per week, Avg cycle time (hari dari dibuat → Done), Tasks created |
| **Weekly throughput** | Grafik kolom task *Created* vs *Completed* per minggu (minggu dimulai Senin) |
| **Cycle time** | Grafik garis rata-rata hari dari dibuat sampai Done, per minggu penyelesaian |
| **Work by status** | Distribusi task aktif per status (bar + tabel) dan **Open work by priority** |
| **Projects: progress & effort** | Tabel per project: penyelesaian (done/total, %), overdue, jam estimasi, jam tercatat, dan **variance** (% selisih aktual vs estimasi; merah bila > 10%) |

---

### 6.8 Settings

**URL:** `/:workspace/settings?tab=...` — terdiri dari empat tab.

#### General

- **Workspace details** *(admin)*: ubah **Name** dan **URL slug**. Slug harus unik dan mengubahnya akan mengubah semua link workspace.
- **Danger zone** *(owner)*: hapus workspace. Ketik nama workspace untuk konfirmasi. **Permanen.**

#### Members

- **Add a member** *(admin)*: masukkan email user yang **sudah terdaftar** lalu pilih role.
  Owner dapat memberi role admin/member/viewer; admin hanya member/viewer.
  Jika email belum terdaftar, muncul pesan agar orang tersebut mendaftar dulu.
- **Daftar anggota**: nama, email, role. Ubah role lewat dropdown, keluarkan anggota lewat ikon 👤✕
  (sesuai aturan pada [bagian 3](#3-peran--hak-akses)).
- **Leave**: anggota non-owner dapat keluar dari workspace. Jika itu workspace terakhirnya, sesi ditutup.

#### Tags

- **New tag** *(member+)*: nama + pilihan warna.
- Daftar tag beserta jumlah task yang memakainya. Admin dapat mengganti nama/warna (color picker) dan menghapus tag.
- Tag dipakai bersama oleh semua project di workspace.

#### My profile

- **Profile**: ubah nama lengkap dan **Avatar URL** (opsional, harus `https`).
- **Change password**: password lama + password baru. Setelah berhasil, **semua sesi di perangkat lain dikeluarkan**.

---

## 7. Detail Task (Task Modal)

Dibuka dengan mengklik task di mana pun (Kanban, Gantt, List, Tasks, notifikasi). URL mendapat `?task=<id>`,
dan modal ditutup dengan `ESC` atau tombol ✕. **Semua perubahan tersimpan otomatis**; footer menampilkan
status *Saving changes…* atau *All changes saved automatically*.

### Header

| Elemen | Fungsi |
| :--- | :--- |
| Breadcrumb `Project / Milestone / KEY-12` | Klik kode task untuk menyalinnya |
| **Share** | Menyalin link task |
| `⋯` *(admin)* | **Copy link**, **Delete task** (dengan konfirmasi; soft delete sehingga admin masih bisa memulihkannya lewat API restore) |
| Dropdown **Status** | Pindah status (sama dengan memindah kartu di Kanban) |
| Dropdown **Priority** | Urgent / High / Medium / Low |
| **Judul** | Klik ikon edit untuk mengganti judul |

### Area kiri (konten)

| Bagian | Fungsi |
| :--- | :--- |
| **Description** | Editor rich-text (Tiptap) dengan toolbar Bold, Italic, Code, Bullet list, Link, Quote. Tersimpan saat editor kehilangan fokus. HTML disanitasi di server |
| **Checklist / Acceptance Criteria** | Subtask dengan progress bar: tambah (ketik lalu Enter), centang selesai, rename, hapus. Progres juga tampil di kartu Kanban |
| **Attachments** | Upload banyak file (maks. 10 file per upload, default 10 MB per file), preview gambar, unduh, hapus. Gambar png/jpeg/gif/webp bisa tampil inline; tipe lain (termasuk SVG) selalu diunduh demi keamanan |
| **Activity** | Tab **All activity**, **Comments**, **History** (lihat di bawah) |

#### Komentar & riwayat

- Komentar ditulis dalam **Markdown**. Ketik `@` untuk memunculkan autocomplete anggota.
  Handle mention = bagian lokal email, mis. `budi@company.com` → `@budi`.
  Kirim komentar dengan `Ctrl/⌘ + Enter`.
- **Reply**: thread satu tingkat. Membalas sebuah balasan otomatis menambahkan mention ke penulisnya.
- **Like**: tombol 👍 beserta jumlah like.
- Penulis dapat **mengedit** komentarnya; penulis atau admin dapat **menghapusnya** (menghapus komentar akar ikut menghapus balasannya).
- **History** menampilkan riwayat sistem, misalnya *"moved status from Backlog to In Progress"*,
  *"changed priority"*, *"updated due date, estimate"*, *"added tag Bug"*, *"completed subtask"*, upload lampiran, dan restore.
  Riwayat dicatat otomatis oleh trigger database.

### Panel kanan (meta)

| Field | Fungsi |
| :--- | :--- |
| **Assignee** | Hanya admin yang bisa mengganti atau melepas assignee. Pilihan hanya anggota ber-role member |
| **Reporter** | Pembuat task (read-only) |
| **Start date** | Dipakai di Gantt Timeline |
| **Due date** | Dasar penentuan overdue |
| **Time tracking** | Jam tercatat vs estimasi, dengan % dan progress bar (merah bila melebihi estimasi). **Edit estimate** dan **Log time** (menambahkan jam ke total aktual) |
| **Milestone** | Hubungkan task ke milestone project |
| **Tags** | Pilih/lepas tag, atau buat tag baru langsung dari sini |

Footer: waktu dan pembuat task, serta label *View only* untuk viewer.

---

## 8. Notifikasi & Realtime

### Notifikasi in-app (ikon 🔔)

| Jenis | Dikirim ke |
| :--- | :--- |
| `task.assigned` | Assignee baru (jika bukan dirinya sendiri yang meng-assign) |
| `comment.mention` | Anggota yang di-`@mention` di komentar |
| `comment.reply` | Penulis komentar yang dibalas |
| `comment.created` | Assignee & reporter task |

Satu orang hanya menerima **satu** notifikasi per komentar, dan pelaku aksi tidak pernah dinotifikasi atas aksinya sendiri.
Popover notifikasi punya filter **Unread** dan tombol **Mark all read**. Klik notifikasi untuk membuka task terkait.

### Realtime

- Trigger PostgreSQL mengirim `pg_notify('pt_events', …)` setiap ada aktivitas, perubahan urutan task, atau notifikasi baru.
- API memegang satu koneksi `LISTEN` dan meneruskan event ke browser lewat **Server-Sent Events** (`GET /api/v1/events`).
- Browser mengubah event menjadi penyegaran data (dikumpulkan per 400 ms). Akibatnya board, activity feed, dan
  badge notifikasi ikut berubah saat rekan kerja melakukan perubahan, tanpa perlu reload.

---

## 9. Aturan Bisnis & Rumus Metrik

| Aturan / Metrik | Definisi |
| :--- | :--- |
| **Kode task** | `{KEY_PREFIX}-{task_number}`; nomor dari counter per project yang diisi trigger database, tidak pernah dipakai ulang |
| **Overdue** | Task dengan `due_date < hari ini` dan status ≠ Done |
| **Completion rate** | Task Done ÷ seluruh task aktif × 100% |
| **Minggu ini** | Sejak Senin 00:00 UTC |
| **Tasks completed (weekly)** | Berdasarkan `completed_at`, yang diisi otomatis saat task masuk Done |
| **Cycle time** | Rata-rata hari dari task dibuat sampai Done |
| **Workload** | Σ estimasi task terbuka (task tanpa estimasi = 4 jam) ÷ 40 jam |
| **Variance** | (jam aktual − jam estimasi) ÷ jam estimasi × 100% |
| **Soft delete** | Project, task, dan komentar tidak benar-benar dihapus (`deleted_at`) dan bisa dipulihkan admin. Data terhapus tidak dihitung di metrik |
| **Perpindahan status** | Status & posisi task hanya diubah lewat endpoint `/move`, yang juga menjaga urutan kartu |
| **Key prefix** | Unik per workspace dan tidak bisa diubah |

---

## 10. Keamanan

- **Autentikasi JWT**: access token berlaku 15 menit dan hanya disimpan di memori browser.
  Refresh token berlaku 30 hari, disimpan di cookie `httpOnly`, dan **dirotasi** setiap kali dipakai.
  Jika token lama dipakai ulang, seluruh sesi tersebut dicabut (deteksi pencurian token).
- **Password** di-hash dengan **Argon2id**. Mengganti password mengeluarkan sesi di perangkat lain.
- **Rate limit** login/registrasi per IP.
- **RBAC** di setiap endpoint (lihat [bagian 3](#3-peran--hak-akses)); non-anggota mendapat 404.
- **Sanitasi HTML**: deskripsi task (rich-text) dan komentar (Markdown → HTML) disaring dengan allowlist di server.
- **Lampiran**: nama file di disk dibuat oleh server (`<taskId>/<uuid>`), hanya format gambar aman yang bisa tampil inline,
  dan unduhan dikirim dengan `nosniff` + CSP sandbox.
- **Ekspor CSV** aman dari *formula injection*.
- **Redirect login** (`?next=`) hanya menerima path internal untuk mencegah *open redirect*.

---

## 11. Arsitektur Teknis

Monorepo **pnpm** dengan tiga paket:

```
.
├── apps/
│   ├── web/   @pt/web — Next.js 16 (App Router), React 19, Tailwind CSS v4
│   └── api/   @pt/api — Hono (Node.js) REST API + SSE
├── packages/
│   └── db/    @pt/db  — skema Drizzle ORM, migrasi SQL, trigger & function PostgreSQL
├── storage/   lampiran file (disk lokal, tidak masuk git)
├── backups/   dump database
└── docker-compose.yml — PostgreSQL 16 (+ Adminer opsional)
```

| Lapisan | Teknologi & Peran |
| :--- | :--- |
| **Frontend** | Next.js + React Query (cache & sinkronisasi data), `@dnd-kit` (drag-and-drop), Tiptap (rich-text), `@tanstack/react-virtual` (virtual scrolling), Radix UI (dialog, dropdown). Next.js mem-proxy `/api/v1/*` ke API sehingga browser hanya melihat satu origin |
| **Backend** | Hono dengan modul per domain di `apps/api/src/modules/`: `auth`, `workspaces`, `projects`, `tasks`, `subtasks`, `comments`, `attachments`, `milestones`, `tags`, `activity`, `dashboard`, `insights` (workload & reports), `notifications`, `realtime`. Validasi input dengan Zod. Respons memakai format `{ success, data, error, timestamp }` |
| **Database** | PostgreSQL 16. Trigger mengurus nomor task, `completed_at`, activity log, dan event realtime |
| **Testing** | Vitest (unit test API) + TypeScript typecheck |

Struktur halaman web (`apps/web/src/app/`):

| Route | Halaman |
| :--- | :--- |
| `/login` | Sign in / Create account |
| `/onboarding` | Create a workspace |
| `/:workspace` | Dashboard |
| `/:workspace/projects` | Projects |
| `/:workspace/projects/:projectId` | Detail project (`?view=overview\|kanban\|gantt\|list`, `?task=<id>`) |
| `/:workspace/tasks` | Tasks — List |
| `/:workspace/tasks/kanban` | Tasks — Kanban |
| `/:workspace/milestones` | Milestones |
| `/:workspace/workload` | Team Workload |
| `/:workspace/reports` | Reports |
| `/:workspace/settings` | Settings (`?tab=general\|members\|tags\|profile`) |

Daftar endpoint API lengkap ada di [README.md](README.md); skema tabel ada di [DATABASE.md](DATABASE.md).

---

## 12. Menjalankan Project

Prasyarat: Node.js ≥ 22, pnpm (lewat `corepack enable`), Docker Desktop.

```bash
cp .env.example .env
pnpm install
pnpm db:up        # jalankan PostgreSQL
pnpm db:migrate   # terapkan migrasi

pnpm dev:api      # terminal 1 — API di http://localhost:4000
pnpm dev:web      # terminal 2 — Web di http://localhost:3000
```

| Script | Fungsi |
| :--- | :--- |
| `pnpm db:up` / `db:down` / `db:logs` | Start / stop / lihat log container Postgres |
| `pnpm db:generate` | Membuat migrasi dari perubahan skema |
| `pnpm db:migrate` | Menerapkan migrasi |
| `pnpm db:reset` | Mengosongkan database lalu migrate ulang (ditolak di production) |
| `pnpm db:studio` | Membuka Drizzle Studio |
| `pnpm typecheck` / `pnpm test` / `pnpm test:all` | Typecheck, unit test, atau keduanya |

Variabel lingkungan penting (`.env`): `DATABASE_URL`, `API_PORT`, `WEB_ORIGIN`, `JWT_SECRET` (min. 32 karakter),
`JWT_ACCESS_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `SESSION_MAX_AGE_DAYS`, `AUTH_RATE_LIMIT_PER_MINUTE`, `STORAGE_DIR`, `MAX_UPLOAD_MB`.

Database development kosong setelah migrasi. Ikuti [alur instalasi baru](#alur-instalasi-baru) untuk membuat akun dan workspace pertama.
Untuk backup/restore data, lihat [DB_EXPORT_IMPORT.md](DB_EXPORT_IMPORT.md).
