# Design TASK-30 — HRIS Gateway Admin Config + Set Password Page

## Arah

Desain ini mempertahankan konsistensi visual sistem yang sudah ada (dark/light theme dengan skema warna Night/Paper, hierarki tipografi Inter, komponen UI dari kit), tetapi menambahkan dua area khusus: (1) admin gateway config dengan pola form konfigurasi enterprise (masking sensitive data jelas, feedback status connection real-time), dan (2) set-password page JIT yang bersifat one-time, high-friction flow dengan validasi kuat. Fokus pada aksesibilitas (WCAG AA kontras, keyboard navigable, label aria), motion minimal sesuai `prefers-reduced-motion`, dan state feedback yang jelas untuk setiap interaksi. Desain ini memanfaatkan token yang sudah ada di `app/globals.css` tanpa menambah nilai baru—hanya komposisi ulang komponen existing.

## File token yang saya miliki

Tidak ada file token baru. Saya menggunakan token eksisting dari `app/globals.css`:
| Token | Nilai (Night) | Nilai (Paper) | Dipakai untuk |
|---|---|---|---|
| `--brand-red` | `#ED1C24` | `#ED1C24` | Accent utama, tombol primary |
| `--surface-0` | `#09090B` | `#F7F6F3` | Background shell/admin |
| `--surface-1` | `#111113` | `#FFFFFF` | Card backgrounds |
| `--surface-2` | `#18181B` | `#EDEBE6` | Input/field backgrounds |
| `--surface-3` | `#27272A` | `#E4E1DA` | Border surfaces |
| `--text-1` | `#FAFAFA` | `#1C1917` | Heading text |
| `--text-2` | `#A1A1AA` | `#57534E` | Body text |
| `--text-3` | `#8A8A93` | `#6B675F` | Muted text |
| `--color-success` | `#22c55e` | `#22c55e` | Success states |
| `--color-danger` | `#ef4444` | `#ef4444` | Error/danger states |
| `--color-warning` | `#eab308` | `#eab308` | Warning states |
| `--color-info` | `#60a5fa` | `#60a5fa` | Info states |
| `--radius-control` | `6px` | `6px` | Buttons, inputs |
| `--radius-card` | `8px` | `8px` | Cards, modals |
| `--motion-fast` | `150ms` | `150ms` | Button presses, hover |
| `--motion-standard` | `300ms` | `300ms` | Modal open/close, page transitions |

Komponen yang dipakai: `Button`, `Input`, `Card`, `Modal`, `Badge`, `ToastContext`, `ConfirmDialog`. Semua komponen ini sudah ada di repo—tidak perlu library baru.

## Layout & breakpoint

| Breakpoint | Perilaku |
|---|---|
| `< 640px` | Form single column, input penuh lebar, tombol stack vertikal, card full width |
| `>= 640px` | Form tetap single column (admin config), judul di kiri atas dengan action button kanan |
| `>= 1024px` | Optional: 2-column layout untuk status health section (last ping vs sync controls) |

Admin shell uses existing geometry from globals.css (`--admin-sidebar-w`, `--admin-topbar-h`). Portal pages use standard portal layout with AuthFrame-like presentation for set-password.

## Komponen: Admin Hris Gateway Config Page

State spesifikasi per elemen:

### Header Section
| State | Spesifikasi |
|---|---|
| default | Layout flex row gap-4 items-center; title "Konfigurasi Gateway HRIS" (text-xl font-semibold text-text-1); eyebrow "SETTINGS > HRIS GATEWAY" (text-xs font-semibold tracking-widest text-accent) |
| loading | Same layout dengan skeleton text block (h-6 w-48 bg-surface-2 animate-pulse) |
| error | Error banner inline (border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger role="alert") |

### Connection Settings Card
| State | Spesifikasi |
|---|---|
| default | Card padding space-4, radius-md, surface-1 background, border-border shadow-lvl-1 |
| base URL input | Label "Base URL *" (text-xs font-semibold text-text-2 mb-2 block); Input type=text placeholder="http://[host]:[port]"; value text color/text-1, bg/surface-2, border-border, focus ring 2px/accent offset-2 |
| API key input | Label "API Key *" (same style); Input type=password masking (shows asterisks); show/hide toggle button absolute right-3 top-1/2 -translate-y-1/2 icon Eye/EyeSlash text-text-3 hover:text-text-1 transition-colors p-1 aria-label="Lihat sembunyi API key"; **setelah save: field read-only, masked only (cannot reveal)** |
| encryption note | Text-xs text-text-3 mt-1 italic ("API key dienkripsi dengan AES-256-GCM menggunakan PORTAL_CREDENTIAL_KEY"); not interactive |
| Save button | Button type=submit variant=primary size=md min-h-10 text-sm font-medium; disabled opacity-50 cursor-not-allowed when saving; label "Simpan"; iconLeft={Save} optional |
| success toast | ToastContext green tone duration=4000ms message="Configurasi berhasil disimpan"; dismissible with X button |
| error toast | ToastContext red tone duration=6000ms message="Gagal menyimpan: [reason]"; dismissible |

### Health Status Card
| State | Spesifikasi |
|---|---|
| default | Card same as connection settings; subsection header "Status Kesehatan" (text-sm font-semibold text-text-1 mb-3) |
| last ping timestamp | Flex row gap-2 items-center; label "Ping terakhir:" (text-xs text-text-3); span timestamp format="DD MMM YYYY HH:mm:ss" locale="id-ID" (font-mono text-xs tabular-nums text-text-2); "Belum pernah" if null |
| status badge | Badge component with dynamic tone based on ping result: success="ONLINE" (green), warning="DEGRADED" (yellow), danger="OFFLINE" (red); neutral="No response yet" (gray) |
| Test Connection button | Button type=button variant=secondary size=sm min-h-8 text-xs; iconLeft={Ping} or Sparkle icon; label "Test Connection"; disabled=false even without config saved (will fail gracefully) |
| test loading | Button label changes to "Menguji..." disabled=true; spinner or pulse visual alternative |
| test result display | After test: inline banner above/below button (bg-green-subtle/40 border border-success/30 px-3 py-2 text-sm text-success role=status OR bg-red-subtle/40 border border-danger/30 text-danger) |

### Sync Controls Card
| State | Spesifikasi |
|---|---|
| default | Card same structure; subsection header "Sinkronisasi" (text-sm font-semibold text-text-1 mb-3) |
| last sync info | Flex row gap-2 items-center; label "Sinkronisasi terakhir:" (text-xs text-text-3); span timestamp or "Belum pernah"; metadata next scheduled (if cron exists) text-xs text-text-3 |
| Run Sync Now button | Button type=button variant=primary size=sm min-h-8 text-xs; iconLeft={Sync} or ArrowsClockwise; label "Sinkron Sekarang"; confirms modal before execution (title="Jalankan Sinkronisasi Manual", message="Menjalankan sinkronisasi akan mengambil data terbaru dari HRIS. Lanjutkan?") |
| confirm dialog | Modal component size=sm overlay backdrop blur-fg; Escape key closes; scroll lock active |
| running state | Button disabled=true label="Menjalankan..." during async operation; no auto-dismiss confirmation after trigger |
| success summary | Toast duration=5000ms tone=success message="Sinkronisasi selesai: {updated} pengguna diperbarui, {deactivated} dinonaktifkan" (count derived from API response) |

### Empty / Initial State
| State | Spesifikasi |
|---|---|
| first load | Skeleton loader all cards (4 rows per card, h-4 bg-surface-2 animate-pulse); table skeleton pattern from portal-users page reused |
| no config | Card content shows "Belum ada konfigurasi"—empty state with prompt button "Tambah Konfigurasi" (variant=secondary onClick opens edit modal with pre-filled empty fields) |

## Interaksi & motion

| Interaksi | Spesifikasi | Alasan fungsional |
|---|---|---|
| Save button press | scale-0.99 duration-[150ms] ease-out cubic-bezier(0.16,1,0.3,1) | Feedback tactile bahwa tekanan terdaftar |
| Modal open/close | translateY(-8px) fade opacity duration-[300ms] ease-out | Menjelaskan asal-usul elemen masuk/keluar |
| Toast appearance | slide-in-from-right translate-x-full opacity-0 → translate-x-0 opacity-100 duration-[200ms] ease-out | Menarik perhatian tanpa menghalangi workflow |
| Loading shimmer | pulse opacity transition duration-[2000ms] infinite | Memberi indikasi progress aktif (bukan stuck) |
| Hover states (non-touch) | brightness-105% atau scale-102% duration-[150ms] | Umpan balik penunjuk interaktivitas |
| Focus outline | Outline-2 outline-accent offset-2 never-remove | WAJIB untuk keyboard accessibility |
| `prefers-reduced-motion` | All transforms removed; fade only; duration=0ms instant | Menghormati preferensi pengguna |

## Component spec: Set Password Page

### AuthFrame wrapper (reuses portal-login pattern but adapted)
| State | Spesifikasi |
|---|---|
| default | Centered card max-w-md mx-auto mt-20 sm:mt-28 lg:mt-32; shadow-lvl-2 bg-surface-1 border border-border rounded-card; eyebrow "JIT PROVISIONING" (text-xs font-semibold tracking-widest text-accent) |
| title | "Atur Kata Sandi" (text-2xl font-display font-semibold text-text-1 mb-2) |
| description | "Akun Anda terdaftar dalam sistem namun belum memiliki kata sandi. Silakan atur kata sandi terlebih dahulu untuk memulai." (text-sm text-text-2 leading-relaxed mb-6) |
| error banner | If server returns error (NIK not found already, expired token): border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger role="alert" |

### Form fields
| State | Spesifikasi |
|---|---|
| NIK field | Readonly text input type=text value={from query/session} bg-surface-2 text-text-1 font-mono text-sm rounded-control border border-border; label "NIK" (not required visually but present for a11y); aria-readonly=true readonly attribute |
| New password | Label "Kata sandi baru *" (text-xs font-semibold text-text-2 mb-2 block); Input type=password minLength=8 placeholder="Minimal 8 karakter"; show/hide toggle Eye/EyeSlash absolute right-3 top-1/2 -translate-y-1/2; validation feedback inline below field (text-xs text-danger if <8 chars, invalid-char class) |
| Confirm password | Label "Konfirmasi kata sandi *" (same style); Input type=password same styling; live match validation (toggles red border + message "Password tidak cocok" jika mismatch) |
| Submit button | Full-width variant=primary min-h-10 text-sm disabled opacity-50 cursor-not-allowed; label "Setel Kata Sandi"; loading state "Menyetel..." |
| Success redirect | On POST success: client-side redirect router.push("/portal-login") dengan toast info "Kata sandi berhasil disetel. Silakan login."; auto-after-2s |

### Validation rules
| Rule | Spec | Error message |
|---|---|---|
| Minimum length | minLength=8 char | "Kata sandi minimal 8 karakter" |
| Match passwords | confirmPassword === newPassword | "Kata sandi tidak cocok" |
| Client-side check | Both fields non-empty on submit | Ditangani by browser required attribute |
| Server-side fallback | API returns 4xx error shape {error: string} | Display verbatim in error banner |

### Loading state
| State | Spesifikasi |
|---|---|
| initial load | Skeleton: 3x h-10 bg-surface-2 animate-pulse vertical stack centered; title skeleton h-7 w-40; description skeleton h-4 w-3/4 |
| submitting | Button disabled; spinner inline-left (w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin); text="Menyetel..." |
| API error response | Banner appears inline top-of-form (red tone); buttons re-enabled |

## Syarat aksesibilitas

| Syarat | Angka | Cara verifikasi |
|---|---|---|
| Kontras teks utama | >= 4.5:1 (--text-1/#FAFAFA di --surface-1/#111113 = 15.8:1 PASS) | Color contrast analyzer tool |
| Kontras teks besar | >= 3:1 (judul 24px+ --text-1) | Visual audit |
| Target sentuh | >= 44x44px (tombol min-h-10 = 40px + padding 4px each side = 48px vertical) | Touch target inspection |
| Urutan fokus | Header → Base URL → API Key → Show/Hide toggle → Save → Health Status section → Test Connection → Sync Controls → Run Sync Now | Keyboard Tab traversal recording |
| Nama untuk pembaca layar | Setiap input punya label explicit element; button aria-label descriptive; status regions role="status" where applicable | Screen reader test (NVDA/VoiceOver) |
| Tanpa tetikus | Seluruh alur dapat diselesaikan (fokus management, Enter/Space activation) | Disable mouse in OS, complete flow |
| Form errors | Alert role, non-modal focus trap avoided, focus moves to error on submit failure | Tab to error region after failed submit |
| Reduced motion | All CSS transitions respect @media (prefers-reduced-motion: reduce) | DevTools media query override |

## Cara verifikasi

| Spec | Cara verifier membuktikannya |
|---|---|
| Token values | Compare computed styles against token table in design.md |
| Contrast ratios | Use automated WCAG checker plugin or manual calculation |
| State coverage | Render page with mock data (config saved/not saved, online/offline status, success/error responses) and verify all states exist |
| Keyboard navigation | Record Tab sequence, verify logical order (header→inputs→actions→section headers), verify Focus visible always shown |
| Motion preferences | Toggle `prefers-reduced-motion` in DevTools, verify transforms are removed or duration=0 |
| API integration | Check Network tab for POST /api/hris/config, POST /api/hris/ping, POST /api/hris/sync, POST /api/portal/set-password with correct payload shapes |
| Encryption note accuracy | Verify lib/portal-crypto.ts usage (read code, not UI) |
| Gate tests | tsc 0, eslint 0, npm run build 0 — run these commands and verify exit codes |

## Keputusan sulit dibalik (calon ADR)

| Keputusan | Pilihan diambil | Alternatif ditolak | Alasan |
|---|---|---|---|
| API key masking setelah save | Read-only masked display (no reveal) | Show/hide toggle kept permanently | Security: plaintext never returned from backend; user must re-enter if needed later |
| JIT password flow | Dedicated set-password page separate from login | Inline modal on login attempt | Separation of concerns; cleaner error handling; supports deep-linking for email invites |
| Confirmation modal for sync run | Required before execution | Immediate async trigger | Prevents accidental runs; user expects sync to be impactful operation |
| Live match validation for password | Client-side real-time feedback | Server-side only on submit | Better UX; reduces friction; still validate server-side as defense-in-depth |
| Status badge tones | Semantic mapping (green=ONLINE, red=OFFLINE, yellow=DEGRADED) | Custom labels only | Leverages existing Badge component; consistent with product patterns |

## Yang sengaja TIDAK dilakukan

- Tidak ada tema tambahan (light/dark sudah ada, tidak perlu third option)
- Tidak ada animasi entrance berurutan (stagger) antar card—tidak memberi fungsi, hanya beban performa
- Tidak ada skeleton untuk set-password page after initial load—halaman kecil satu kolom lebih cepat render
- Tidak ada custom icons—reuse Phosphor Icons yang sudah terinstall (Eye, EyeSlash, Plus, ShieldCheck, ToggleRight, dll)
- Tidak ada dependency baru—semua komponen sudah tersedia di repo
- Tidak mengubah API signature—kontrak endpoint diserahkan ke Oscar (TASK-29) via board coordination
- Tidak menyentuh lib/prisma atau file API—batas scope designer adalah UI layer saja
- Tidak ada "remember me" atau session persistence tambahan—tetap mengikuti existing portal-auth pattern

## Catatan koordinasi

**WAJIB koordasi dengan Oscar (Builder) via board sebelum wiring:**
1. Endpoint signature untuk config: `POST /api/hris/config` payload `{baseUrl, apiKey, enabled}` + `GET /api/hris/config` response shape
2. Endpoint ping/sync: `POST /api/hris/ping` response `{healthStatus, lastPingAt, error?}`; `POST /api/hris/sync` response `{updatedCount, deactivatedCount, jobId?}`
3. Endpoint set-password: `POST /api/portal/set-password` payload `{nik, password}` response `{success: true, redirectTo: "/portal-login"}`

**Jika endpoint Oscar belum ready:** implementasi gunakan mock placeholder functions dengan TODO comments yang jelas:
```typescript
// TODO: Replace with actual API call once Oscar completes TASK-29
const handleSaveConfig = async (data: ConfigData) => {
  console.log("Mock save:", data);
  showToast("Configurasi tersimpan (mock)", "success");
};
```

---

**Verdict:** `designed`  
**Next suggested:** `builder` (Oscar-mtbo9igp)  
**Findings:** [] (tidak ada temuan negatif—spesifikasi lengkap dengan cara verifikasi)
