# Product Requirement Document (PRD)
## Project Tracker SaaS

---

## 1. Executive Summary & Objective
Aplikasi **Project Tracker** adalah platform manajemen proyek dan kolaborasi tim modern yang ditujukan untuk tim produk, engineering, dan agensi. Aplikasi ini berfokus pada kesederhanaan, transparansi alur kerja visual (Kanban & Gantt), serta pencatatan beban kerja secara real-time.

### Success Metrics (KPIs)
- Waktu onboard user baru ke first task < 3 menit.
- Latensi pembaruan status Kanban < 200 ms (via optimistic update / websocket).
- Adopsi fitur tracking waktu/estimasi > 60% per proyek aktif.

---

## 2. User Personas
1. **Engineering Lead / Project Manager (Admin/Owner)**
   - Kebutuhan: Mengatur sprint/milestone, memonitor bottleneck, memantau utilisasi tim.
2. **Individual Contributor (Member)**
   - Kebutuhan: Melihat tugas harian, update status task cepat, komentar & lampiran file.
3. **Stakeholder / Client (Viewer)**
   - Kebutuhan: Tampilan high-level milestone dan progress tanpa hak edit.

---

## 3. Scope & Feature Requirements

### 3.1 Workspace & Multi-tenancy
- User dapat membuat dan berpindah antar workspace.
- Manajemen akses role: `Owner`, `Admin`, `Member`, `Viewer`.

### 3.2 Project & Milestone Management
- CRUD Project lengkap dengan Key Prefix (contoh: `PRJ`, `CORE`).
- Penentuan tanggal mulai dan target selesai.
- Milestones untuk mengelompokkan fase/sprint deliverable.

### 3.3 Task Lifecycle & Kanban Board
- Kolom default: **Backlog**, **In Progress**, **In Review**, **Done**.
- Drag-and-drop dengan reordering antar kolom dan dalam kolom yang sama.
- Task ID unik terformat (`{PREFIX}-{TASK_NUMBER}`, misal `PRJ-42`).
- Subtasks / Checklist dengan perhitungan progress bar otomatis.
- Tags/Labels dengan kode warna kustom.

### 3.4 Task Details & Collaboration (Slide-over Modal)
- Rich-text editor untuk deskripsi task.
- Thread komentar dengan timestamp.
- File attachment preview dan download.
- Estimasi waktu vs. aktual jam pengerjaan (*Hours Tracking*).

### 3.5 Dashboard & Analytics
- Metric Cards: Total Active Projects, Completed Tasks (Weekly), Overdue Items, Overall Completion Rate.
- Activity feed real-time pada workspace/proyek.

---

## 4. User Journey & Flow
```
[Sign Up / Login]
       │
       ▼
[Select / Create Workspace]
       │
       ▼
[Project Overview Dashboard]
   ├── Switch View: [Kanban Board] <─── Drag & Drop Task
   │                   ├── Click Task -> [Slide-out Detail Drawer]
   │                   │                    ├── Edit status/assignee
   │                   │                    ├── Add comment/attachment
   │                   │                    └── Toggle subtask
   ├── Switch View: [Gantt / Timeline]
   └── Switch View: [Milestones & Roadmap]
```

---

## 5. Non-Functional Requirements
- **Security:** JWT Authentication, Role-based Access Control (RBAC), sanitasi input HTML pada Markdown komentar.
- **Reliability:** Soft deletion untuk entitas proyek dan task penting.
- **Performance:** Pagination / Virtual scrolling pada Kanban board dengan > 200 task per kolom.