# Skill Standards, Tech Stack & Engineering Conventions

Dokumen ini memuat panduan kompetensi, stack teknologi resmi, dan pedoman coding untuk proyek **Project Tracker**.

---

## 1. Recommended Tech Stack

| Lapisan | Rekomendasi Teknologi | Alasan Pemilihan |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router) / React + Vite | Server Components, routing dinamis, integrasi Stitch Tailwind yang mudah |
| **Styling** | Tailwind CSS + Radix UI / Shadcn UI | Komponen aksesibel, konsistensi token warna dari Stitch |
| **State & Drag/Drop** | TanStack Query + `@hello-pangea/dnd` / `dnd-kit` | Optimistic update untuk Kanban board & sinkronisasi server cache |
| **Backend / API** | Node.js (NestJS / Hono / Express) atau Go / FastAPI | RESTful / tRPC dengan performa tinggi |
| **Database & ORM** | PostgreSQL 16 + Prisma / Drizzle ORM | Type-safety penuh yang selaras dengan skema SQL |
| **Container** | Docker & Docker Compose | Standardisasi lingkungan lokal dan produksi |

---

## 2. Engineering Conventions

### 2.1 Git Workflow
- `main`: Branch stabil siap rilis / production.
- `develop`: Branch integrasi fitur.
- Feature branches: `feat/{task-id}-{short-description}` (contoh: `feat/PRJ-12-kanban-dnd`).
- Fix branches: `fix/{task-id}-{short-description}`.

### 2.2 API Design Standard
- Endpoint harus konsisten dengan format RESTful:
  - `GET /api/v1/projects/:projectId/tasks` (Ambil list task board)
  - `PATCH /api/v1/tasks/:taskId/reorder` (Update posisi sort order / kolom Kanban)
  - `POST /api/v1/tasks/:taskId/comments` (Kirim komentar baru)
- Response Payload Standard:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-10-16T03:30:00Z"
}
```

### 2.3 Kanban Optimistic Updates
- Saat memindahkan kartu di board:
  1. Frontend langsung mengupdate state UI lokal.
  2. Panggil API `PATCH /tasks/:id/move`.
  3. Jika API gagal (5xx/4xx), lakukan rollback ke posisi sebelumnya dan tampilkan toast error.

---

## 3. Developer Skill Checklist
Developer yang berkontribusi pada proyek ini diharapkan menguasai:
- [x] Pemahaman arsitektur database relasional PostgreSQL & Docker containerization.
- [x] Implementasi Drag and Drop (DND) berbasis event handler di React.
- [x] Optimistic UI Updates & state synchronization.
- [x] Kemampuan memetakan komponen visual dari mockup Stitch ke Tailwind utility classes.