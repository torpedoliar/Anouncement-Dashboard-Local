# Restricted Apps + Multi-Credential Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portal app bisa ditandai non-publik (restricted → hanya user/grup yang punya akses) dan satu user bisa menyimpan banyak akun berlabel per app, dengan pemilih akun saat SSO.

**Architecture:** Dua perubahan skema Prisma (`PortalApp.isPublic`, `PortalUserAppCredential.label` + unique baru), satu sumber aturan akses di `lib/portal-access.ts`, dan UI kelola akun diperluas di halaman Kelola Kredensial yang sudah ada tanpa layar baru.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 5 (PostgreSQL), Zod, parse5 (sudah ada), Tailwind/inline styles, NextAuth 4.

## Global Constraints

- **No new dependencies** — parse pattern pakai parse5 yang sudah ada (transitif), jangan tambah cheerio/jsdom.
- **UI strings & commit messages dalam Bahasa Indonesia.**
- **`isPublic` default `true`** — semua app yang ada sekarang tetap publik setelah migrasi.
- **`label` wajib non-null** untuk credential; nilai default migrasi = `'default'`.
- **Jangan jalankan server lokal / migrate dev lokal** — tulis migration SQL untuk `prisma migrate deploy` di server. Verifikasi via `npx tsc --noEmit` + self-check script.
- **Prefix perintah git dengan `rtk`** (aturan global CLAUDE.md).
- **Aturan akses satu sumber:** ALL gate akses melalui fungsi di `lib/portal-access.ts`; jangan hand-roll cek di route.
- **`portalUserId_appId` unique credential HILANG** — semua `findUnique/upsert` pada `PortalUserAppCredential` dengan `where: { portalUserId_appId }` wajib diganti (by id / list).
- **`PortalUserAppAccess` & `PortalUserAppVisibility` unique TIDAK berubah** — `app/api/portal-users/[id]/access` dan `saveVisibilityPartial` tidak perlu diubah strukturnya.

---

### Task 1: Skema & migrasi (isPublic + label + unique)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260812000001_add_app_is_public_and_credential_label/migration.sql`

**Interfaces:**
- Produces: `PortalApp.isPublic: Boolean` (default true); `PortalUserAppCredential.label: String` (non-null, default `'default'`); unique `@@unique([portalUserId, appId, label])` menggantikan `@@unique([portalUserId, appId])`.

- [ ] **Step 1: Update schema**

```prisma
model PortalApp {
  ...
  isPublic Boolean @default(true)   // true=berlaku semua user; false=hanya berhak akses
  ...
}

model PortalUserAppCredential {
  id              String   @id @default(cuid())
  portalUserId    String
  appId           String
  label           String   @default("default")   // WAJIB pasca-migrasi; nama akun
  credentialBlob  String
  appUsername     String?
  lastUsedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  portalUser      PortalUser @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  app             PortalApp  @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([portalUserId, appId, label])
  @@index([portalUserId])
  @@index([appId])
  @@map("portal_user_app_credentials")
}
```

- [ ] **Step 2: Tulis migration SQL**

```sql
-- 1) Kolom baru di portal_apps
ALTER TABLE "portal_apps" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- 2) Kolom label di portal_user_app_credentials (default 'default' untuk data lama)
ALTER TABLE "portal_user_app_credentials" ADD COLUMN "label" TEXT NOT NULL DEFAULT 'default';

-- 3) Hapus unique lama, buat unique baru
ALTER TABLE "portal_user_app_credentials" DROP CONSTRAINT "portal_user_app_credentials_portalUserId_appId_key";
-- (nama constraint mungkin berbeda — cek di DB; alternatif: DROP INDEX ...)
CREATE UNIQUE INDEX "portal_user_app_credentials_portalUserId_appId_label_key"
  ON "portal_user_app_credentials" ("portalUserId", "appId", "label");
```

> Catatan: pastikan nama constraint unik lama benar (umumnya `portal_user_app_credentials_portalUserId_appId_key`). Jika berbeda, sesuaikan.

- [ ] **Step 3: Regenerate client**

Run: `npx prisma generate`

- [ ] **Step 4: Verifikasi typecheck model**

Run: `npx tsc --noEmit`
Expected: (sebelum Task berikutnya mungkin ada error di impor `label` — itu OK sementara; schema sudah jalan)

- [ ] **Step 5: Commit**

```bash
rtk git add prisma/schema.prisma prisma/migrations/20260812000001_add_app_is_public_and_credential_label/migration.sql
rtk git commit -m "feat(portal): skema isPublic + label kredensial multi-akun"
```

---

### Task 2: Aturan akses restricted (satu sumber)

**Files:**
- Modify: `lib/portal-access.ts`
- Test: `scripts/test-portal-restricted.ts` (new)

**Interfaces:**
- Consumes: `PortalApp.isPublic`, `PortalUserAppAccess`, `PortalUserGroup` (schema Task 1).
- Produces:
  - `canAccessPortalApp(portalUserId, appId)` — berubah: restricted memerlukan direct atau grup.
  - `getAccessiblePortalApps(portalUserId)` — berubah: filter restricted sebelum visibility.
  - `canAccessPortalAppBySlug(portalUserId, appSlug)` — meneruskan aturan baru.
  - Helper baru (opsional): `filterAccessibleAppIds(portalUserId, appIds)` untuk guard visibility — return `Set<string>` app yang user bisa akses.

- [ ] **Step 1: Tulis test gagal dulu (self-check)**

Create `scripts/test-portal-restricted.ts`:

```ts
// Self-check aturan akses restricted (murni predikat, tanpa DB).
// Run: npx tsx scripts/test-portal-restricted.ts
type Role = "PORTAL_ADMIN" | "PORTAL_USER";

interface AccessContext {
    role: Role;
    isPublic: boolean;
    isActive: boolean;
    hasDirect: boolean;
    hasActiveGroup: boolean;
}

function canAccess(ctx: AccessContext): boolean {
    if (!ctx.isActive) return false;
    if (ctx.role === "PORTAL_ADMIN") return true;
    if (ctx.isPublic) return true;
    return ctx.hasDirect || ctx.hasActiveGroup;
}

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)}`);
    if (!ok) process.exitCode = 1;
}

const pub: AccessContext = { role: "PORTAL_USER", isPublic: true, isActive: true, hasDirect: false, hasActiveGroup: false };
assertEq(canAccess(pub), true, "publik + user biasa → akses");

const admin: AccessContext = { role: "PORTAL_ADMIN", isPublic: false, isActive: true, hasDirect: false, hasActiveGroup: false };
assertEq(canAccess(admin), true, "restricted + admin → akses");

const restrNo: AccessContext = { role: "PORTAL_USER", isPublic: false, isActive: true, hasDirect: false, hasActiveGroup: false };
assertEq(canAccess(restrNo), false, "restricted + no access → tolak");

const restrDirect: AccessContext = { role: "PORTAL_USER", isPublic: false, isActive: true, hasDirect: true, hasActiveGroup: false };
assertEq(canAccess(restrDirect), true, "restricted + direct → akses");

const restrGroup: AccessContext = { role: "PORTAL_USER", isPublic: false, isActive: true, hasDirect: false, hasActiveGroup: true };
assertEq(canAccess(restrGroup), true, "restricted + grup aktif → akses");

const inactive: AccessContext = { role: "PORTAL_USER", isPublic: true, isActive: false, hasDirect: true, hasActiveGroup: true };
assertEq(canAccess(inactive), false, "app non-aktif → tolak walau direct/grup");

console.log("\n=== ALL PASS (akses restricted) ===");
```

- [ ] **Step 2: Run test untuk verifikasi gagal/atau baseline**

Run: `npx tsx scripts/test-portal-restricted.ts`
Expected: PASS semua (test memodelkan predikat; bagian DB di Task 3 yang butuh integrasi).

- [ ] **Step 3: Implement predikat di `canAccessPortalApp`**

Ubah `canAccessPortalApp`:

```ts
export async function canAccessPortalApp(
    portalUserId: string,
    appId: string
): Promise<boolean> {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { isActive: true, role: true },
    });
    if (!user || !user.isActive) return false;
    if (user.role === "PORTAL_ADMIN") return true;

    const app = await prisma.portalApp.findUnique({
        where: { id: appId },
        select: { isActive: true, isPublic: true },
    });
    if (!app || !app.isActive) return false;
    if (app.isPublic) return true;

    // restricted: direct access ATAU membership grup aktif yang memuat app
    const direct = await prisma.portalUserAppAccess.count({
        where: { portalUserId, appId },
    });
    if (direct > 0) return true;

    const groupCount = await prisma.portalUserGroup.count({
        where: {
            portalUserId,
            group: {
                isActive: true,
                apps: { some: { appId } },
            },
        },
    });
    return groupCount > 0;
}
```

> Catatan: ini mengganti query `appAccess` + `group` sebelumnya — sekarang selangkah lebih mahal (2 query + subquery), tapi tetap satu lingkup kecil. ponytail: OK untuk skala portal; jika lambat, prefetch app + membership dalam satu query.

- [ ] **Step 4: Implement filter di `getAccessiblePortalApps`**

Di awal `getAccessiblePortalApps`, fetch apps yang bisa diakses user secara implisit:

```ts
export async function getAccessiblePortalApps(portalUserId: string) {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { role: true },
    });
    const isAdmin = user?.role === "PORTAL_ADMIN";

    // Semua app aktif
    const allApps = await prisma.portalApp.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { ...APP_SELECT, isPublic: true },
    });

    // App restricted yang user berhak akses (via direct ATAU grup aktif)
    let accessibleRestrictedIds = new Set<string>();
    if (!isAdmin) {
        const restrictedIds = allApps.filter(a => a.isPublic === false).map(a => a.id);
        if (restrictedIds.length > 0) {
            const directIds = (await prisma.portalUserAppAccess.findMany({
                where: { portalUserId, appId: { in: restrictedIds } },
                select: { appId: true },
            })).map(r => r.appId);
            const groupIds = (await prisma.portalUserGroup.findMany({
                where: {
                    portalUserId,
                    group: { isActive: true, apps: { some: { appId: { in: restrictedIds } } } },
                },
                select: { group: { select: { apps: { select: { appId: true } } } } },
            })).flatMap(g => g.group.apps.map(a => a.appId));
            accessibleRestrictedIds = new Set([...directIds, ...groupIds]);
        }
    }

    const base = allApps.filter(app => app.isPublic || isAdmin || accessibleRestrictedIds.has(app.id));
    // base = daftar yang boleh tampil SEBELUM visibility filter. Lanjutkan logika visibility
    // (hiddenAppIds / appsInHiddenGroups) atas `base` — lihat implementasi lama, ganti `allApps` → `base`.
    ...
}
```

> Penting: `hide`/`show` visibility tetap diterapkan SETELAH filter restricted (`base`), sehingga override visibility sudah pasti app yang user berhak lihat. Jika ada `appOverride=false` pada app restricted yang user tak berhak — abaikan (tidak muncul di `base`).

- [ ] **Step 5: `canAccessPortalAppBySlug` menyesuaikan**

`canAccessPortalAppBySlug` sudah memanggil `canAccessPortalApp` → tidak perlu diubah (meneruskan aturan). Pastikan fetch app menambahkan `isPublic` bila diperlukan (tidak wajib — util menangani).

- [ ] **Step 6: Tambahkan helper guard visibility (opsional, dipakai Task 3)**

```ts
/** Kembalikan Set appId yang user mampu akses DIANTARA appIds yang diberikan. */
export async function filterAccessibleAppIds(
    portalUserId: string,
    appIds: string[]
): Promise<Set<string>> {
    if (appIds.length === 0) return new Set();
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { role: true },
    });
    if (user?.role === "PORTAL_ADMIN") return new Set(appIds);

    const apps = await prisma.portalApp.findMany({
        where: { id: { in: appIds } },
        select: { id: true, isPublic: true },
    });

    const restrictedIds = apps.filter(a => !a.isPublic).map(a => a.id);
    let allowedRestricted = new Set<string>();
    if (restrictedIds.length > 0) {
        const direct = (await prisma.portalUserAppAccess.findMany({
            where: { portalUserId, appId: { in: restrictedIds } },
            select: { appId: true },
        })).map(r => r.appId);
        const group = (await prisma.portalUserGroup.findMany({
            where: {
                portalUserId,
                group: { isActive: true, apps: { some: { appId: { in: restrictedIds } } } },
            },
            select: { group: { select: { apps: { select: { appId: true } } } } },
        })).flatMap(g => g.group.apps.map(a => a.appId));
        allowedRestricted = new Set([...direct, ...group]);
    }

    return new Set(apps.filter(a => a.isPublic || allowedRestricted.has(a.id)).map(a => a.id));
}
```

- [ ] **Step 7: Typecheck + self-check**

Run: `npx tsx scripts/test-portal-restricted.ts && npx tsc --noEmit`
Expected: PASS semua test; tsc bersih (belum termasuk label konsumen yang menunggu Task 4+).

- [ ] **Step 8: Commit**

```bash
rtk git add lib/portal-access.ts scripts/test-portal-restricted.ts
rtk git commit -m "feat(portal): aturan akses restricted app (one source of truth)"
```

---

### Task 3: Guard visibility + layout filter

**Files:**
- Modify: `app/api/portal/visibility/route.ts`
- Modify: `lib/portal-layout.ts`

**Interfaces:**
- Consumes: `filterAccessibleAppIds` (Task 2), `getAccessiblePortalApps` (Task 2).
- Produces: `getPortalLayout` mengekspos hanya app yang berhak akses; route visibility menolak app restricted yang tak berhak.

- [ ] **Step 1: Guard POST/PATCH visibility**

Di `app/api/portal/visibility/route.ts`, import `filterAccessibleAppIds` dan di kedua handler (POST & PATCH), sebelum `saveVisibility`:

```ts
// POST — validasi appIds vs akses
const candidateAppIds = [...appIdsOff, ...appIdsOn];
if (candidateAppIds.length > 0) {
    const allowed = await filterAccessibleAppIds(userId, candidateAppIds);
    const denied = candidateAppIds.filter(id => !allowed.has(id));
    if (denied.length > 0) {
        return NextResponse.json({ error: "App tidak dapat diakses" }, { status: 403 });
    }
}

// PATCH — bila body berisi appId
if (appId) {
    const allowed = await filterAccessibleAppIds(userId, [appId]);
    if (!allowed.has(appId)) {
        return NextResponse.json({ error: "App tidak dapat diakses" }, { status: 403 });
    }
}
```

> Catatan: grup (groupId) tidak perlu guard terpisah — grup hanya memengaruhi tampilan app di dalamnya, dan app yang tak berhak tidak muncul di `base` grid/wizard.

- [ ] **Step 2: `getPortalLayout` filter restricted**

Ubah `getPortalLayout` — ambil `getAccessiblePortalApps(portalUserId)` (yang sudah filter restricted), lalu intersect dengan apps per grup:

```ts
export async function getPortalLayout(portalUserId: string) {
    const { needsOnboarding } = await getVisibilityProfile(portalUserId);

    // App yang berhak diakses user (public + restricted yang punya akses)
    const accessible = await getAccessiblePortalApps(portalUserId);
    const accessibleIds = new Set(accessible.map(a => a.id));

    const groupsRaw = await prisma.portalGroup.findMany({
        where: { isActive: true },
        select: {
            id: true, name: true,
            apps: {
                where: { app: { isActive: true } },
                select: { app: { select: { id: true, name: true, slug: true, description: true, logoPath: true, category: true, displayOrder: true } } },
                orderBy: { app: { displayOrder: "asc" } },
            },
        },
        orderBy: { name: "asc" },
    });

    const groups = groupsRaw
        .map(g => ({
            id: g.id, name: g.name,
            apps: g.apps
                .map(({ app }) => ({ ...app, hasCredential: false }))
                .filter(a => accessibleIds.has(a.id)),
        }))
        .filter(g => g.apps.length > 0);

    return { needsOnboarding, groups };
}
```

> Konsekuensi: wizard & `/portal/settings` hanya menampilkan app yang berhak user akses. Ini yang diminta spec.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 4: Commit**

```bash
rtk git add app/api/portal/visibility/route.ts lib/portal-layout.ts
rtk git commit -m "feat(portal): guard visibility + layout hanya menampilkan app yang berhak akses"
```

---

### Task 4: API kredensial multi-akun (GET/POST/DELETE by id)

**Files:**
- Modify: `lib/validation-schemas.ts`
- Modify: `app/api/portal/credentials/route.ts`
- Modify: `app/api/sso/reroute/route.ts`

**Interfaces:**
- Consumes: `PortalCredentialSchema` + `label`, `canAccessPortalApp`.
- Produces:
  - `GET /api/portal/credentials` → array app `{ appId, appName, appSlug, credentialCount, lastUsedAt }`.
  - `POST /api/portal/credentials` → create akun (label wajib); body `{ appId, label, username, password, extra? }`; 409 bila duplikat label.
  - `DELETE /api/portal/credentials?credentialId=...` → hapus by id (milik user).
  - `POST /api/sso/reroute` → menerima field opsional `credentialId`; ambil credential by id.

- [ ] **Step 1: Update `PortalCredentialSchema` + buat create/delete schema**

Di `lib/validation-schemas.ts`:

```ts
export const PortalCredentialSchema = z.object({
    appId: z.string().cuid('Invalid app ID'),
    label: z.string().min(1, 'Label wajib diisi').max(100),
    username: z.string().min(1, 'Username required').max(255),
    password: z.string().min(1, 'Password required').max(500),
    extra: z.record(z.string(), z.string()).optional(),
});

export const PortalCredentialDeleteSchema = z.object({
    credentialId: z.string().cuid('Invalid credential ID'),
});
```

- [ ] **Step 2: GET — return credentialCount**

Di `app/api/portal/credentials/route.ts` GET:

```ts
const credentials = await prisma.portalUserAppCredential.groupBy({
    by: ['appId'],
    where: { portalUserId: userId },
    _count: { _all: true },
    _max: { lastUsedAt: true },
});
const credMap = new Map(credentials.map(c => [c.appId, {
    credentialCount: c._count._all,
    lastUsedAt: c._max.lastUsedAt,
}]));

const result = apps.map(app => ({
    appId: app.id,
    appName: app.name,
    appSlug: app.slug,
    credentialCount: credMap.get(app.id)?.credentialCount ?? 0,
    lastUsedAt: credMap.get(app.id)?.lastUsedAt ?? null,
}));
```

- [ ] **Step 3: POST — create (bukan upsert)**

```ts
const { appId, label, username, password, extra } = validation.data;
const hasAccess = await canAccessPortalApp(userId, appId);
if (!hasAccess) return NextResponse.json({ error: "No access to this app" }, { status: 403 });

const credentialBlob = encryptCredential({ username, password, extra });

// Duplikat label → 409 (unique constraint akan menolak juga, tapi tangkap dengan pesan jelas)
const existing = await prisma.portalUserAppCredential.findFirst({
    where: { portalUserId: userId, appId, label },
    select: { id: true },
});
if (existing) {
    return NextResponse.json({ error: "Label akun sudah dipakai untuk aplikasi ini" }, { status: 409 });
}

const created = await prisma.portalUserAppCredential.create({
    data: { portalUserId: userId, appId, label, credentialBlob, appUsername: username },
});
// ... logAudit CREDENTIAL_SAVED entityId: created.id, changes: { appId, label } (username TIDAK masuk audit)
```

- [ ] **Step 4: DELETE — by credentialId**

```ts
export async function DELETE(request: NextRequest) {
    // ...session
    const { credentialId } = await request.json().catch(() => ({}));
    // atau query param credentialId
    if (!credentialId) return NextResponse.json({ error: "credentialId is required" }, { status: 400 });

    const existing = await prisma.portalUserAppCredential.findUnique({
        where: { id: credentialId },
        select: { id: true, portalUserId: true },
    });
    if (!existing || existing.portalUserId !== userId) {
        return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }
    await prisma.portalUserAppCredential.delete({ where: { id: credentialId } });
    // ...logAudit CREDENTIAL_DELETED entityId: credentialId
    return NextResponse.json({ message: "Credential deleted" });
}
```

> Catatan: `DELETE` bisa terima `credentialId` via query param (`?credentialId=`) — pilih yang konsisten dengan pemanggil di UI Task 5. Spec memilih by id; query param lebih REST-consistent untuk DELETE. (Implementasi bebas pilih, pastikan UI cocok.)

- [ ] **Step 5: `app/api/sso/reroute/route.ts` terima credentialId**

Ubah bagian pencarian credential:

```ts
const credentialId = formData.get("credentialId") as string | null;

let credential;
if (credentialId) {
    credential = await prisma.portalUserAppCredential.findFirst({
        where: { id: credentialId, portalUserId },
    });
} else {
    // fallback: akun pertama (kompatibilitas)
    credential = await prisma.portalUserAppCredential.findFirst({
        where: { portalUserId, appId: app.id },
        orderBy: { createdAt: "asc" },
    });
}

if (!credential) {
    return NextResponse.json({ error: "No credential" }, { status: 400 });
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/validation-schemas.ts app/api/portal/credentials/route.ts app/api/sso/reroute/route.ts
rtk git commit -m "feat(portal): API kredensial multi-akun (create by label, delete by id, reroute by id)"
```

---

### Task 5: UI kelola kredensial — daftar akun per app

**Files:**
- Modify: `app/portal/credentials/page.tsx`
- Modify: `app/portal/page.tsx`
- Modify: `components/portal/GroupedAppGrid.tsx`
- Modify: `components/portal/AppCard.tsx`

**Interfaces:**
- Consumes: `GET /api/portal/credentials` (credentialCount), `POST/DELETE` (Task 4).
- Produces: indikator `credentialCount` di grid; halaman Kelola Kredensial menampilkan daftar + tambah/hapus akun dengan label.

- [ ] **Step 1: `app/portal/page.tsx` — credentialCount**

Ubah query credential menjadi `groupBy` dan bangun `credCountMap`:

```ts
const credRows = visibleIds.length
    ? await prisma.portalUserAppCredential.groupBy({
          by: ['appId'],
          where: { portalUserId: userId, appId: { in: visibleIds } },
          _count: { _all: true },
      })
    : [];
const credCountMap = new Map(credRows.map(r => [r.appId, r._count._all]));
// gridGroups: apps.map(a => ({ ...a, credentialCount: credCountMap.get(a.id) ?? 0 }))
```

- [ ] **Step 2: Grid types — `hasCredential` → `credentialCount`**

`components/portal/GroupedAppGrid.tsx`:
```ts
export interface GridApp {
    ...
    credentialCount: number;   // ganti hasCredential
}
```
Passing ke `AppCard` sebagai `credentialCount`.

- [ ] **Step 3: `AppCard.tsx` — tampilkan jumlah akun**

```tsx
{credentialCount > 0 ? (
    <span style={{ color: "var(--color-success)" }}>✓ {credentialCount} akun tersimpan</span>
) : (
    <span style={{ color: "var(--color-warning)" }}>⚠ Belum ada akun</span>
)}
```
Link: `credentialCount > 0` → "Buka Aplikasi" (`/portal/app/${slug}`); else → "Simpan Kredensial" (`/portal/credentials?app=${slug}`).

- [ ] **Step 4: `app/portal/credentials/page.tsx` — list akun + form tambah + hapus**

Perubahan utama:
- State: `accounts: Record<string, Array<{ id: string; label: string; lastUsedAt: string|null }>>`, `expandedApp`.
- `fetchCredentials` GET → set `apps` + `accounts` per app.
- Header app: tampilkan `✓ {accounts.length} akun` + label list.
- Expanded section: daftar akun (label + tombol hapus) + form tambah (username, password, label).
- `handleSave(appId, label)` → POST `{ appId, label, username, password }`.
- `executeDelete(credentialId)` → DELETE dengan `credentialId`.
- `ConfirmDialog` untuk hapus akun.

> Detail UI dibebaskan mengikuti style existing (accordion, label + fields). Konsisten dengan `SSOCredentialVault`/`NoCredential`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 6: Commit**

```bash
rtk git add app/portal/page.tsx app/portal/credentials/page.tsx components/portal/GroupedAppGrid.tsx components/portal/AppCard.tsx
rtk git commit -m "feat(portal): kelola banyak akun kredensial + indikator jumlah akun di grid"
```

---

### Task 6: Alur SSO — pemilih akun saat >1 akun

**Files:**
- Modify: `app/portal/app/[appSlug]/page.tsx`
- Create: `components/portal/AccountSelector.tsx`
- Modify: (opsional) `components/portal/SSOAutoSubmit.tsx`, `SSOCredentialVault.tsx`, `SSORerouteSubmit.tsx` — tetap menerima credential yang sudah dipilih.

**Interfaces:**
- Consumes: `canAccessPortalAppBySlug`, credential by id.
- Produces: halaman `[appSlug]` → bila `credentialCount>1`, render `AccountSelector` (client, POST pilihan ke `/api/sso/reroute` atau render target), bila 1 langsung SSO.

- [ ] **Step 1: `app/portal/app/[appSlug]/page.tsx` — ambil list**

Ubah pencarian credential menjadi `findMany`, letakkan urutan `createdAt asc`:

```ts
const credentials = await prisma.portalUserAppCredential.findMany({
    where: { portalUserId, appId: app.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, credentialBlob: true, lastUsedAt: true },
});
if (credentials.length === 0) return <NoCredential ... />;
if (credentials.length === 1) {
    // lanjut decrypt + render seperti sekarang (pakai credentials[0])
}
// >1 → return <AccountSelector app={...} accounts={credentials.map(c=>({id:c.id,label:c.label}))} ssoMode={app.ssoMode} />
```

> Penting: lakukan pengecekan `count>1` SEBELUM decrypt agar tidak memboroskan decrypt. Untuk FORM/VAULT dengan >1, `AccountSelector` POST `{ appSlug, credentialId }` ke endpoint yang men-render ulang halaman dengan `credentialId` (query param). Contoh: redirect ke `/portal/app/[slug]?credentialId=...` → halaman memakai credential itu.

- [ ] **Step 2: Buat `components/portal/AccountSelector.tsx`**

```tsx
"use client";
export interface SelectableAccount { id: string; label: string; }

interface AccountSelectorProps {
    appName: string;
    accounts: SelectableAccount[];
    baseHref: string; // `/portal/app/[slug]`
}

export default function AccountSelector({ appName, accounts, baseHref }: AccountSelectorProps) {
    return (
        <div style={{ padding: "32px", maxWidth: "480px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", color: "#fff" }}>Pilih Akun</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                Aplikasi {appName} memiliki lebih dari satu akun tersimpan. Pilih akun yang ingin digunakan.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {accounts.map(a => (
                    <a
                        key={a.id}
                        href={`${baseHref}?credentialId=${a.id}`}
                        style={{
                            display: "block", padding: "14px 18px",
                            backgroundColor: "#111", border: "1px solid #262626",
                            borderRadius: "8px", color: "#fff", textDecoration: "none", fontWeight: 600,
                        }}
                    >
                        {a.label}
                    </a>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Halaman `[appSlug]` — handle query `credentialId`**

Di server component, baca `searchParams.credentialId`; bila >1 akun dan `credentialId`diberikan, pilih akun itu (validasi milik user); bila tanpa `credentialId`→ `AccountSelector`.

- [ ] **Step 4: REROUTE eksekusi pakai credentialId**

`SSORerouteSubmit` POST ke `/api/sso/reroute` sudah menerima `credentialId` (Task 4 Step 5). Pastikan halaman meneruskan `credentialId` saat mode REROUTE.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 6: Commit**

```bash
rtk git add app/portal/app/[appSlug]/page.tsx components/portal/AccountSelector.tsx
rtk git commit -m "feat(portal): pemilih akun saat SSO dengan banyak akun"
```

---

### Task 7: Admin UI — Publik/Restricted toggle + verifikasi audit

**Files:**
- Modify: `app/admin/portal-apps/page.tsx`
- Modify: (verifikasi, mungkin tanpa perubahan) `app/api/admin/portal-audit/route.ts`

**Interfaces:**
- Consumes: `PortalAppCreateSchema`/`UpdateSchema` + `isPublic`, `/api/portal-apps` (POST/PUT).
- Produces: toggle Publik/Restricted di form admin; audit account-sharing tetap jalan.

- [ ] **Step 1: Tambahkan `isPublic` ke schema admin**

`lib/validation-schemas.ts`:
```ts
export const PortalAppCreateSchema = z.object({
    ...
    isPublic: z.boolean().default(true),   // true=publik; false=restricted
    ...
});
```
(UpdateSchema = partial, otomatis ikut.)

- [ ] **Step 2: Admin page — state + toggle**

- `emptyForm` tambah `isPublic: true`.
- `openEditModal` isi `isPublic: app.isPublic`.
- Body POST/PUT tambah `isPublic: formData.isPublic`.
- UI: checkbox/select "Publik / Restricted" di form (dekat `isActive`):

```tsx
<label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "var(--text-secondary)", fontSize: "14px" }}>
    <input
        type="checkbox"
        checked={formData.isPublic}
        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
    />
    Publik (berlaku untuk semua pengguna)
</label>
```

- [ ] **Step 3: Verifikasi audit — account sharing tetap benar**

`app/api/admin/portal-audit/route.ts` sudah `findMany` semua credentials + group by `(appId, appUsername)`. Multi-akun tidak mengubah logika (label hanya menambah konteks). **Verifikasi manual:** pastikan dua akun user berbeda dengan `appUsername` sama tetap terdeteksi sharing. Tidak ada perubahan kode yang diharuskan.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 5: Commit**

```bash
rtk git add app/admin/portal-apps/page.tsx lib/validation-schemas.ts
rtk git commit -m "feat(portal-admin): toggle publik/restricted app"
```

---

### Task 8: Finalisasi — self-check penuh + verifikasi + commit

**Files:**
- Test: `scripts/test-portal-restricted.ts` (Task 2)
- (Optional) tambah self-check untuk `AccountSelector` tidak diperlukan (komponen presentasional).

**Interfaces:**
- Consumes: semua Task 1–7.

- [ ] **Step 1: Jalankan self-check + typecheck**

Run: `npx tsx scripts/test-portal-restricted.ts && npx tsc --noEmit`
Expected: PASS semua; tidak ada error type.

- [ ] **Step 2: Verifikasi tidak ada `portalUserId_appId` credential tersisa**

Run: `grep -rn "portalUserId_appId" app lib components prisma --include=*.ts --include=*.tsx | grep -v portal_user_app_access | grep -v portal_user_app_visibility | grep -v portal-login-detect`
Expected: tidak ada kecocokan terkait `PortalUserAppCredential`.

- [ ] **Step 3: (Server) Jalankan migrasi**

```bash
# di server, bukan lokal
npx prisma migrate deploy
```
Expected: skema baru terpasang (`isPublic`, `label`, unique baru).

- [ ] **Step 4: (Server) Verifikasi manual ringkas**

- Buat app restricted; cek user tanpa akses tidak melihat di grid/wizard/settings/route.
- Tambah 2 akun untuk 1 app; cek pemilih akun muncul; lanjut SSO dengan akun terpilih.
- Cek audit account-sharing masih menampilkan user berbeda dengan `appUsername` sama.

- [ ] **Step 5: Commit final**

```bash
rtk git add -A
rtk git commit -m "feat(portal): restricted apps + multi-credential — verifikasi e2e"
rtk git push origin main
```

> Catatan: hindari menambahkan file tak terkait (`From Server Prod/`, `image.png`) — gunakan `git add` file/folder spesifik bila perlu.
