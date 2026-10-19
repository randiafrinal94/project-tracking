# Design Specification & UI Guidelines (Stitch Implementation)

Dokumen ini mendokumentasikan terjemahan desain dari prototipe **Google Stitch** ke dalam token CSS/Tailwind dan struktur komponen visual.

- **Sumber:** Stitch project `2820080197429906756` — design system **"Kinetic Slate"**, screen *Agile Project Tracking & Management Dashboard* dan *Task Detail Slide-out Drawer*.
- **Implementasi token:** [apps/web/src/app/globals.css](apps/web/src/app/globals.css) (`@theme` Tailwind v4), disalin 1:1 dari `tailwind.config` HTML Stitch.
- **Katalog komponen hidup:** halaman `/design-system` pada aplikasi web.

> Bila dokumen ini dan HTML Stitch berbeda, **HTML Stitch yang berlaku** (lihat §5 untuk daftar koreksi).

---

## 1. Design Tokens & Color Palette

Stitch memakai penamaan Material 3. Nama token di bawah adalah nama kelas Tailwind (`bg-*`, `text-*`).

### 1.1 Surfaces & Text
| Token | Hex | Penggunaan |
| :--- | :--- | :--- |
| `background` / `surface` | `#F8F9FF` | Canvas aplikasi & area main |
| `surface-container-lowest` | `#FFFFFF` | Kartu task, KPI card, modal, input |
| `surface-container-low` | `#EFF4FF` | Sidebar, kolom Kanban, item milestone |
| `surface-container` | `#E5EEFF` | Track progress, tab group, chip tag netral, tombol tonal |
| `surface-container-high` | `#DCE9FF` | Hover tonal, pill priority medium/low |
| `surface-container-highest` | `#D3E4FE` | Counter kolom |
| `on-surface` | `#0B1C30` | Teks utama & heading |
| `on-surface-variant` | `#464555` | Metadata, label, ikon non-aktif |
| `outline` / `outline-variant` | `#777587` / `#C7C4D8` | Teks tersier, key task, pemisah breadcrumb |

### 1.2 Brand & Semantic
| Token | Hex | Penggunaan |
| :--- | :--- | :--- |
| `primary-container` | `#4F46E5` | Tombol CTA, nav aktif, progress default |
| `primary` | `#3525CD` | Hover tombol utama, teks aksen/link |
| `primary-fixed` | `#E2DFFF` | Pill hitungan tab, badge "days left" |
| `secondary` / `secondary-fixed` | `#006591` / `#C9E6FF` | **In Progress** (dot, bar atas kolom, progress) |
| `review` | `#F59E0B` | **In Review** (dot, bar) — pill `#FEF3C7` / teks `#92400E` |
| `tertiary-container` / `tertiary-fixed` | `#006E4B` / `#6FFBBE` | **Done / Success** |
| `error` / `error-container` | `#BA1A1A` / `#FFDAD6` | **Urgent / Overdue / Blocked** |
| `high` | `#F97316` | Priority **High** — pill `#FFEDD5` / teks `#9A3412` |
| Backlog | `outline` `#777587` | Dot kolom Backlog |

---

## 2. Typography
- **Font:** `Plus Jakarta Sans` (UI) + `JetBrains Mono` (key task `PRJ-42`, kode, timestamp feed). Ikon: **Material Symbols Outlined**.
- Angka metrik & timestamp memakai tabular figures (kelas `.tabular`).

| Kelas | Ukuran / Line / Weight | Contoh pemakaian |
| :--- | :--- | :--- |
| `text-headline-xl` | 32 / 40 / 700, −0.025em | Angka KPI |
| `text-headline-lg` | 24 / 32 / 600, −0.02em | Judul halaman |
| `text-headline-md` | 18 / 26 / 600 | Judul section ("Workflow Matrix"), brand |
| `text-headline-sm` | 15 / 22 / 600 | Judul kartu task, judul panel rail |
| `text-body-md` / `text-body-sm` | 14/20 · 13/18 | Isi, metadata |
| `text-label-md` | 13 / 18 / 500 | Nav, tombol, label kolom |
| `text-label-sm` | 11 / 16 / 600, +0.04em | Pill, badge, label KPI (uppercase) |
| `text-code-inline` | 12 / 16 / 500 mono | Key task, kbd |

---

## 3. UI Components Breakdown

### 3.1 App Layout
- **Sidebar:** `w-64` (256px), `bg-surface-container-low`, shadow `0 1px 8px rgba(0,0,0,.04)`, tanpa border. Isi: brand → workspace switcher (kartu putih) → nav (item aktif `bg-primary-container text-on-primary rounded-lg`) → Settings.
  - Breakpoint: **≥1280px** penuh (bisa diciutkan ke rail), **768–1279px** icon rail 64px, **<768px** drawer off-canvas.
- **Header:** `h-16` sticky, `bg-surface/80 backdrop-blur-xl`, breadcrumb kiri; kanan: search `w-72 h-9` dengan `⌘K`, tombol **New** (primary), notifikasi, help, avatar 32px.
- **Main Canvas:** `bg-surface`, padding `px-gutter-lg` (32px) `py-gutter-md` (24px).
- **Page header:** tile ikon 40px `rounded-xl bg-primary-container`, judul `headline-lg`, pill status, baris meta, grup tombol (secondary / tonal), lalu segmented tabs + filter bar.

### 3.2 KPI Cards
`p-space-lg rounded-xl bg-surface-container-lowest shadow-xs hover:shadow-md`: label uppercase `label-md` + tile ikon 32px berwarna, angka `headline-xl`, deskripsi `body-sm`, footer progress `h-2`.

### 3.3 Kanban Column & Card Anatomy
- **Kolom:** `rounded-xl bg-surface-container-low p-space-md min-w-[270px]`, bar warna status 4px di atas (kecuali Backlog), header: dot 10px + nama + counter + menu.
- **Kartu:** `p-space-md rounded-lg bg-surface-container-lowest shadow-xs hover:shadow-md hover:-translate-y-0.5`.
```
+------------------------------------+
| ● In Progress  (8)            ···  | <-- Column Header (bar biru di atas)
+------------------------------------+
| +--------------------------------+ |
| | (● Urgent)            PRJ-102  | | <-- Priority pill & key (mono)
| | Implement OAuth2 Google Login  | | <-- headline-sm
| | [Backend] [Security]           | | <-- tag chip
| | Subtasks            3/5 (60%)  | |
| | [=====>      ]                 | | <-- progress h-1.5
| | 📅 Oct 20        💬 2   (BS)   | | <-- due · komentar · avatar 24px
| +--------------------------------+ |
+------------------------------------+
```
- Kartu Done: opacity 95%, judul `line-through text-outline`, pill "Resolved".

### 3.4 Task Detail (modal — keputusan final mengikuti Stitch)
**Modal tengah** `max-w-[1060px] rounded-2xl`, scrim `inverse-surface/40 backdrop-blur-[3px]`, dibuka via `?task=<id>` (dapat dibagikan; Esc/Back menutup).
- **Header:** breadcrumb (project / milestone / key dapat disalin), Share, menu ⋯ (Delete), Close (hover merah). Pill status (dropdown), pill prioritas uppercase (dropdown), pill estimasi; judul `headline-lg` dapat diedit inline.
- **Kolom kiri (8/12):** Description (ribbon Bold/Italic/Code/List/Link/Quote + kotak `surface-container-low`), Acceptance Criteria (meter `h-2` + checklist), Attachments (grid 3 kolom: kartu preview gambar `h-28` + badge ekstensi, tile ikon PDF merah / video biru / umum, drag & drop file), tab aktivitas *All activity / Comments / History* + kotak komentar.
- **Rail kanan (4/12, `surface-container-low/70`, border kiri):** Assignee, Reporter, Due Date (+ badge), Time Tracking (meter logged/estimate + Log Time), Milestone, Tags.
- **Footer:** status simpan otomatis · dibuat oleh · `ESC to close`.
- Bagian Stitch yang belum ditampilkan: Watch, branch/PR pill, Links & Dependencies, reaksi emoji, tombol Mention (belum ada backend).

### 3.6 Kanban Interaction
- Drag mouse/touch (aktif setelah 6px) dan **keyboard** (Space ambil · ←/→ pindah kolom · ↑/↓ urutan · Space taruh · Esc batal).
- Optimistic: kartu langsung pindah; API gagal → kembali ke posisi semula + toast error.
- Kolom memuat 50 kartu per halaman ("Load more (N left)"); filter bar: pencarian (judul/key), assignee, tag, prioritas, milestone, overdue, unassigned.
- **Lebar kolom minimum 228px** (Stitch HTML: 270px) agar 4 kolom = 960px muat di desktop 1280px dengan sidebar penuh — kolom *Done* selalu terlihat.
- **Container query** (`@container`): rail kanan (Upcoming Milestones, Live Activity) hanya di samping board bila lebar konten ≥ 1344px; di bawahnya rail turun ke bawah board dalam grid 2 kolom. Gradien + chevron tetap menjadi petunjuk bila board harus di-scroll (tablet).
- **Virtual scrolling:** kolom > 40 kartu dirender ter-virtualisasi terhadap scroll window, halaman berikutnya dimuat otomatis; teks "N of M loaded" di bawah kolom.

### 3.7 View & Halaman Tambahan
Komponen baru memakai token & pola yang sama (kartu `rounded-xl` Level 1, baris list hairline, pill, segmented tabs):
- **List View / Tasks:** baris Kinetic Slate "Lists & Backlog Rows" (key mono → judul → status → prioritas → assignee → due → subtask), header dapat diurutkan, ter-virtualisasi.
- **Gantt Timeline:** label 280px sticky, grid hari (zoom Days/Weeks), baris milestone dengan bar progres tertiary, bar task berwarna status (overdue: ring error), garis "today" primary; drag bar/tepi untuk menjadwal ulang.
- **Team Workload:** baris "Squad Workload" Stitch (avatar + status dot, "N tasks (x%)", label Balanced/Healthy/High Load) + bar beban.
- **Reports:** stat tile, kolom berkelompok & line chart SVG. Palet chart divalidasi (dataviz `validate_palette.js`): slot 1 `#4F46E5`, slot 2 `#0EA5E9` (CVD ΔE 17.9; kontras slot 2 2.7:1 → legend + toggle tabel wajib, tersedia). Status memakai warna kolom board.
- **Notifikasi:** popover Level 3 380px dari lonceng header, badge merah jumlah belum dibaca, item belum dibaca ber-latar `primary-fixed/20`.
- **Mention:** `<span class="mention">` ber-latar `primary-fixed` + teks primary semibold.

### 3.5 Elevation
| Level | Shadow | Pemakaian |
| :--- | :--- | :--- |
| 1 | `shadow-xs` / `0 1px 2px rgba(15,23,42,.04)` | Kartu, panel, input |
| 2 | `shadow-md` / Kinetic Slate level-2 | Hover kartu, drag |
| 3 | `shadow-level-3` | Dropdown, toast |
| Modal | `0 24px 50px -12px rgba(15,23,42,.22)` | Dialog & task detail |

---

## 4. States
Setiap komponen data wajib memiliki state **loading** (skeleton shimmer), **empty** (tile ikon + judul + aksi), **error** (tile merah + pesan API + "Try again"), plus hover/focus (`ring-2 ring-primary-container/35`) dan disabled (opacity 50%).

---

## 5. Koreksi terhadap Ringkasan Awal
Ringkasan awal dokumen ini berbeda dari HTML Stitch pada poin berikut; implementasi mengikuti Stitch:

| Aspek | Ringkasan awal | Stitch (berlaku) |
| :--- | :--- | :--- |
| Font | Inter / Plus Jakarta Sans | Plus Jakarta Sans + JetBrains Mono |
| Sidebar | 260px, putih, border kanan | 256px (`w-64`), `surface-container-low`, shadow |
| In Progress | Blue `#2563EB` | `secondary` `#006591` |
| In Review | `#D97706` | `#F59E0B` |
| Done | `#059669` | `tertiary-container` `#006E4B` |
| Canvas | `#F8FAFC` | `#F8F9FF` |
| Task detail | Slide-out kanan 640px | Modal tengah 1060px, split 8/4 (**disetujui**) |

Elemen Stitch yang sengaja **tidak** ditampilkan karena belum ada datanya: kartu "Storage" di sidebar, sparkline KPI, dan story points per kolom (diganti total jam estimasi). Badge notifikasi dan panel "Squad Workload" kini tampil dengan data nyata. Nama brand "NexusFlow" diganti "Project Tracker".
