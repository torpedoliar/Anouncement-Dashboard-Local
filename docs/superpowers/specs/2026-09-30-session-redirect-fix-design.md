# Spesifikasi Desain: Perbaikan Session Redirect Loop Saat Berganti Akun

## 1. Masalah & Analisis Akar Masalah

Pengguna mengalami redirect berulang (loop) saat berpindah akun di dashboard admin (`/admin` <-> `/admin-login`).

Akar masalah teridentifikasi pada 4 titik interaksi:
1. **Soft Navigation di `admin-login/page.tsx`**:
   Setelah pemanggilan `signIn("credentials", { redirect: false })`, navigasi dilakukan via `router.push(callbackUrl)`. Ini merupakan soft client navigation di Next.js App Router, sehingga cache client NextAuth tidak dimuat ulang secara bersih.
2. **Missing Session Prop di `NextAuthProvider.tsx`**:
   `AdminLayout` memanggil `getServerSession(authOptions)` namun tidak mengoper objek `session` tersebut ke `<NextAuthProvider>`. Akibatnya, `<SessionProvider>` di sisi client memulai state dari `"loading"` atau status lama (`"unauthenticated"` dari halaman logout sebelumnya).
3. **Intersepsi Prematur oleh `SessionExpiryWatcher.tsx`**:
   - Ketika status client masih `"unauthenticated"` saat komponen termuat di `/admin`, `SessionExpiryWatcher` langsung memicu `redirectToLogin("SessionExpired")`, melempar user kembali ke `/admin-login?error=SessionExpired`.
   - Ketika pengguna klik "Keluar", `signOut()` mengubah status client menjadi `"unauthenticated"` sebelum proses redirect bawaan NextAuth selesai. `SessionExpiryWatcher` memotong proses ini dengan `window.location.href = /admin-login?error=SessionExpired&callbackUrl=%2Fadmin`.
   - Interseptor `window.fetch` menangkap respon 401 secara global tanpa filter URL (bisa mengintersepsi endpoint non-admin atau panggilan otentikasi internal).
4. **Stale Site Context Cookie di `lib/site-context.ts`**:
   Fungsi `resolveAdminSiteId()` langsung mempercayai nilai cookie `current_site_id` tanpa memvalidasi apakah user yang sedang aktif memiliki akses ke site tersebut (`canAccessSite`). Saat Akun A (akses Site 1) keluar dan Akun B (hanya akses Site 2) masuk, Akun B menerima site ID milik Akun A dan memicu error akses (401/403).

---

## 2. Rencana Solusi Komprehensif

### A. Navigasi Bersih Pasca Login (`app/(auth)/admin-login/page.tsx`)
- Ganti `router.push(callbackUrl)` dengan `window.location.href = callbackUrl`.
- Memastikan reload browser penuh sehingga seluruh cookie sesi baru (`next-auth.session-token`) dikirim langsung dalam request SSR pertama dan cache state client bersih.
- Bersihkan flag `sessionStorage.getItem("isLoggingOut")` saat mendarat di halaman login.

### B. Injeksi Session SSR ke Client Provider (`components/providers/NextAuthProvider.tsx` & `app/admin/layout.tsx`)
- Update `NextAuthProvider.tsx` agar menerima prop `session?: Session | null` dan meneruskannya ke `<SessionProvider session={session} ...>`.
- Di `app/admin/layout.tsx`, oper session yang didapat dari `getServerSession` ke `<NextAuthProvider session={session} basePath="/api/auth">`.
- Dampak: Pada frame 0 di client, `useSession().status` langsung bernilai `"authenticated"`. Tidak ada celah waktu `"unauthenticated"` yang dapat memicu `SessionExpiryWatcher`.

### C. Hardening `SessionExpiryWatcher.tsx`
- Deteksi flag `isLoggingOut` di `sessionStorage`. Jika pengguna sedang dalam alur logout yang sah, jangan lakukan redirect `SessionExpired`.
- Pada interseptor `window.fetch`:
  - Hanya pantau endpoint internal `/api/` (kecuali `/api/auth/` yang memiliki penanganan respon sendiri).
  - Abaikan respon 401 jika flag `isLoggingOut` sedang aktif.

### D. Penanganan Logout Bersih (`components/admin/AdminTopbar.tsx` & `components/admin/AdminSidebar.tsx`)
- Sebelum memanggil `signOut({ callbackUrl: "/admin-login" })`:
  - Pasang flag `sessionStorage.setItem("isLoggingOut", "1")`.
  - Hapus `currentSiteId` dari `localStorage`.

### E. Validasi Kepemilikan Site di `lib/site-context.ts`
- Di `resolveAdminSiteId()`:
  - Dapatkan sesi user aktif via `getServerSession`.
  - Jika ada `cookieId`, verifikasi dengan `await canAccessSite(session.user.id, cookieId)`.
  - Jika user tidak berhak atas `cookieId` tersebut, abaikan cookie dan fallback ke `getDefaultSite(session.user.id)`.

---

## 3. Rencana Verifikasi
1. `npx tsc --noEmit` untuk memastikan tidak ada kesalahan tipe TypeScript.
2. `npm run lint` untuk memastikan tidak ada pelanggaran linting ESLint.
3. Simulasi perpindahan akun:
   - Login User A -> Akses dashboard.
   - Logout User A -> Pastikan tidak ada pesan error `SessionExpired` di URL (`/admin-login`).
   - Login User B -> Pastikan langsung masuk ke dashboard `/admin` tanpa redirect loop.
