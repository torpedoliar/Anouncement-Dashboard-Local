# Perbaikan Session Redirect Loop Saat Berganti Akun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghentikan infinite redirect loop antara `/admin` dan `/admin-login` saat berganti akun serta menjamin sinkronisasi sesi NextAuth dan konteks site bersih.

**Architecture:** Menerapkan full-window navigation pasca login sukses, menyuntikkan session SSR ke `<NextAuthProvider>`, membentengi `SessionExpiryWatcher` dari logout yang sah dan respon 401 luar, serta memvalidasi kepemilikan site pada `resolveAdminSiteId()`.

**Tech Stack:** Next.js 15 (App Router), NextAuth.js v4, React 19, Prisma ORM, TypeScript.

## Global Constraints
- Bahasa pesan commit dan UI: Bahasa Indonesia.
- Ponytail / Lazy senior dev: diff minimal dan tepat sasaran pada root cause, jangan buat abstraksi baru.
- Verifikasi dengan `npx tsc --noEmit` dan `npm run lint`.

---

### Task 1: Navigasi Bersih Pasca Login & Pembersihan Flag Logout

**Files:**
- Modify: `app/(auth)/admin-login/page.tsx:22-54`

**Interfaces:**
- Consumes: `signIn` dari `next-auth/react`, `searchParams` dari `next/navigation`.
- Produces: `window.location.href = callbackUrl` saat login sukses, membersihkan flag `isLoggingOut` di `sessionStorage`.

- [ ] **Step 1: Edit `app/(auth)/admin-login/page.tsx`**
  - Bersihkan `sessionStorage.removeItem("isLoggingOut")` di `useEffect`.
  - Ganti `router.push(callbackUrl)` dengan `window.location.href = callbackUrl`.
- [ ] **Step 2: Jalankan typecheck**
  - Run: `npx tsc --noEmit`
- [ ] **Step 3: Commit perubahan Task 1**
  - Git commit: `fix(auth): navigasi penuh pasca login admin dan pembersihan flag logout`

---

### Task 2: Teruskan Server Session ke NextAuthProvider & AdminLayout

**Files:**
- Modify: `components/providers/NextAuthProvider.tsx:1-16`
- Modify: `app/admin/layout.tsx:48-64`

**Interfaces:**
- Consumes: `session` dari `getServerSession(authOptions)` di `AdminLayout`.
- Produces: `<SessionProvider session={session} ...>` di `NextAuthProvider`.

- [ ] **Step 1: Tambahkan prop `session` pada `components/providers/NextAuthProvider.tsx`**
  - Impor `type { Session } from "next-auth"`.
  - Terima `session?: Session | null` pada props dan oper ke `<SessionProvider session={session}>`.
- [ ] **Step 2: Oper `session` dari `app/admin/layout.tsx`**
  - Ubah `<NextAuthProvider basePath="/api/auth">` menjadi `<NextAuthProvider session={session} basePath="/api/auth">`.
- [ ] **Step 3: Jalankan typecheck**
  - Run: `npx tsc --noEmit`
- [ ] **Step 4: Commit perubahan Task 2**
  - Git commit: `fix(auth): teruskan session SSR ke NextAuthProvider untuk cegah status unauthenticated semu`

---

### Task 3: Hardening SessionExpiryWatcher & Penanganan Logout di Shell

**Files:**
- Modify: `components/providers/SessionExpiryWatcher.tsx:13-58`
- Modify: `components/admin/AdminTopbar.tsx:69-74`
- Modify: `components/admin/AdminSidebar.tsx:59-63`

**Interfaces:**
- Consumes: `sessionStorage.getItem("isLoggingOut")`.
- Produces: Mencegah `SessionExpiryWatcher` memotong alur `signOut()` yang sah, dan membatasi intersepsi 401 hanya untuk API internal dashboard selain `/api/auth/`.

- [ ] **Step 1: Update `components/providers/SessionExpiryWatcher.tsx`**
  - Periksa `sessionStorage.getItem("isLoggingOut") === "1"`. Jika true, lewati redirect.
  - Pada fetch interceptor, hanya panggil `redirectToLogin` jika URL request mencakup `/api/` dan bukan `/api/auth/`, serta bukan saat proses logout.
- [ ] **Step 2: Update `components/admin/AdminTopbar.tsx` dan `components/admin/AdminSidebar.tsx`**
  - Set `sessionStorage.setItem("isLoggingOut", "1")` dan `localStorage.removeItem("currentSiteId")` sebelum memanggil `signOut`.
- [ ] **Step 3: Jalankan typecheck**
  - Run: `npx tsc --noEmit`
- [ ] **Step 4: Commit perubahan Task 3**
  - Git commit: `fix(auth): amankan SessionExpiryWatcher saat logout sah dan saring intersepsi 401`

---

### Task 4: Validasi Akses Site pada `resolveAdminSiteId`

**Files:**
- Modify: `lib/site-context.ts:41-56`

**Interfaces:**
- Consumes: `canAccessSite`, `getDefaultSite` dari `@/lib/site-access`, `getCurrentSiteId` dari cookie.
- Produces: `resolveAdminSiteId(): Promise<string | null>` yang memverifikasi kepemilikan site user sebelum mempercayai cookie.

- [ ] **Step 1: Update `resolveAdminSiteId` di `lib/site-context.ts`**
  - Muat session terlebih dahulu.
  - Jika ada `cookieId`, uji apakah user memiliki akses: `await canAccessSite(session.user.id, cookieId)`.
  - Jika ya, kembalikan `cookieId`. Jika tidak (misal berganti akun dengan hak site berbeda), fallback ke `getDefaultSite(session.user.id)`.
- [ ] **Step 2: Jalankan typecheck dan lint**
  - Run: `npx tsc --noEmit`
  - Run: `npm run lint`
- [ ] **Step 3: Commit perubahan Task 4**
  - Git commit: `fix(site): validasi hak akses user terhadap cookie siteId saat resolusi konteks admin`
