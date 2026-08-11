# Portal Per-User App Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User menentukan sendiri app mana yang tampil di grid `/portal` (onboarding wizard saat login pertama + toggle grup/app di `/portal/settings`), admin hanya mengelompokkan aplikasi.

**Architecture:** Semua app aktif tersedia untuk semua user. Preferensi per-user disimpan di tabel baru `PortalUserAppVisibility` dengan semantik **default-visible** (tidak ada row = tampil; hanya menyimpan row override yang off/hidden). Flag `PortalUser.onboardingDone` menandai user sudah melewati wizard (expldisit — tidak bergantung pada jumlah row). `POST /api/portal/visibility` mengganti semua rows + set flag; `PATCH /api/portal/visibility` ubah satu row.

**Tech Stack:** Next.js 15 App Router, Prisma 5 (PostgreSQL), NextAuth (portal-auth), React 19, Zod (lib/validation-schemas.ts), TypeScript. Script test: `npx tsx`.

## Global Constraints

- Prisma client diimpor dari `@/lib/prisma` (singleton). Setelah ubah `schema.prisma`, jalankan `npx prisma generate`.
- UI strings & commit messages dalam Bahasa Indonesia.
- Deteksi onboarding: `PortalUser.onboardingDone == false` (JANGAN pakai "tidak ada row visibility" — tombol Lewati menghasilkan nol row).
- App baru default TAMPAIL untuk semua user yang `onboardingDone=true`; kalau grupnya user sembunyikan, app baru di grup itu tetap tersembunyi (konsisten grup override).
- `PortalUserGroup` / `PortalUserAppAccess` tetap di schema, TIDAK dihapus — hanya tidak dipakai filter grid.
- YAGNI (jangan buat): admin mengatur visibility user, audit "siapa menyembunyikan apa", urutan grup kustom, fitur pin, animasi wizard bertahap.
- Audit log memakai `logAudit()` dari `@/lib/audit` (non-blocking, `.catch(() => {})`).
- Komponen UI memakai pola gaya inline yang sudah ada (`var(--bg-card)`, `var(--border-color)`, `#0a0a0a`, dll) — konsisten dengan komponen portal existing.
- `getAccessiblePortalApps` juga dipakai oleh `app/api/portal/credentials` GET → setelah perubahan, halaman "Kelola Kredensial" menampilkan **semua app aktif** (bukan hanya yang visible). Ini benar (user bisa set credential app yang disembunyikan) — jangan "perbaiki" menjadi filter visible.

---

### Task 1: Prisma schema — `PortalUserAppVisibility` + `onboardingDone`

**Files:**
- Modify: `prisma/schema.prisma` (tambah model + kolom)
- Test: (tidak ada — schema-only; verifikasi via `npx prisma validate`)

**Interfaces:**
- Consumes: model `PortalUser`, `PortalGroup`, `PortalApp` yang ada.
- Produces: model `PortalUserAppVisibility` (field: `id, portalUserId, groupId?, appId?, visible`; unique `[portalUserId, groupId]` & `[portalUserId, appId]`), kolom `onboardingDone Boolean @default(false)` di `PortalUser`. Prisma client dengan model ini.

- [ ] **Step 1: Tambah model ke schema**

Tambahkan model baru di `prisma/schema.prisma` (dekat model portal lain):

```prisma
model PortalUserAppVisibility {
  id            String   @id @default(cuid())
  portalUserId  String
  groupId       String?
  appId         String?
  visible       Boolean

  portalUser    PortalUser   @relation(fields: [portalUserId], references: [id], onDelete: Cascade)
  group         PortalGroup? @relation(fields: [groupId], references: [id], onDelete: Cascade)
  app           PortalApp?   @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@unique([portalUserId, groupId])
  @@unique([portalUserId, appId])
  @@index([portalUserId])
  @@index([groupId])
  @@index([appId])
  @@map("portal_user_app_visibility")
}
```

- [ ] **Step 2: Tambah relasi back + kolom onboardingDone**

Di model `PortalUser` tambah:
```prisma
  onboardingDone Boolean @default(false)
  visibility     PortalUserAppVisibility[]
```
Di model `PortalGroup` tambah:
```prisma
  visibility PortalUserAppVisibility[]
```
Di model `PortalApp` tambah:
```prisma
  visibility PortalUserAppVisibility[]
```

- [ ] **Step 3: Validasi schema + generate client**

Run: `npx prisma validate && npx prisma generate`
Expected: sukses, tidak ada error.

- [ ] **Step 4: Buat & jalankan migration**

Run: `npx prisma migrate dev --name add_portal_user_app_visibility`
Expected: migration dibuat & diaplikasikan ke dev DB.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(prisma): model PortalUserAppVisibility + onboardingDone"
```

---

### Task 2: Helper — `getVisibilityProfile`, `saveVisibility`, dan grouping

**Files:**
- Modify: `lib/portal-access.ts`
- Test: `scripts/test-visibility.ts` (baru)

**Interfaces:**
- Consumes: model `PortalUserAppVisibility`, `PortalUser.onboardingDone`, `PortalGroup`/`PortalApp`.
- Produces:
  - `getVisibilityProfile(portalUserId): Promise<{ needsOnboarding: boolean; groupOverrides: Map<string, boolean>; appOverrides: Map<string, boolean> }>` — `needsOnboarding = !onboardingDone`.
  - `getGroupedApps(userId, visibility)` — internal helper yang mengembalikan daftar grup dengan app yang tampil (lihat Task 3 signature).
  - `saveVisibility(portalUserId, { groupIdsOff, appIdsOff, appIdsOn, skip }): Promise<void>` — replace all rows + set `onboardingDone=true` dalam satu `$transaction`.

- [ ] **Step 1: Tulis test yang gagal dulu**

Buat `scripts/test-visibility.ts`:

```ts
/**
 * Self-check untuk getVisibilityProfile + saveVisibility + filter grid.
 * Run: npx tsx scripts/test-visibility.ts
 * Membutuhkan DATABASE_URL (dev db prisma seed).
 */

import dotenv from "dotenv";
dotenv.config();
import prisma from "@/lib/prisma"; // pakai path alias — jalankan dengan npx tsx dari root

async function main() {
  console.log("=== Test: Portal User App Visibility ===");

  // 1. Buat user test (upsert, idempotent)
  const nik = `test-vis-${Date.now()}`;
  const user = await prisma.portalUser.create({
    data: { nik, passwordHash: "x", name: "Test Visibility" },
  });
  const uid = user.id;

  // 2. Buat grup + 2 app (upsert by unique name/slug)
  const group = await prisma.portalGroup.upsert({
    where: { name: "Test-Grup-Vis" },
    update: {},
    create: { name: "Test-Grup-Vis", description: "temp" },
  });
  const appA = await prisma.portalApp.upsert({
    where: { slug: "test-vis-a" },
    update: {},
    create: { slug: "test-vis-a", name: "Test Vis A", url: "https://a.test", isActive: true },
  });
  const appB = await prisma.portalApp.upsert({
    where: { slug: "test-vis-b" },
    update: {},
    create: { slug: "test-vis-b", name: "Test Vis B", url: "https://b.test", isActive: true },
  });
  await prisma.portalGroupApp.upsert({
    where: { groupId_appId: { groupId: group.id, appId: appA.id } },
    update: {},
    create: { groupId: group.id, appId: appA.id },
  });
  await prisma.portalGroupApp.upsert({
    where: { groupId_appId: { groupId: group.id, appId: appB.id } },
    update: {},
    create: { groupId: group.id, appId: appB.id },
  });

  // import AFTER db setup untuk reduce churn — helpers butuh prisma current
  const { getVisibilityProfile, saveVisibility } = await import("../lib/portal-access");

  try {
    // 3. Fresh user: needsOnboarding = true
    let profile = await getVisibilityProfile(uid);
    assertEq(profile.needsOnboarding, true, "fresh user needsOnboarding");

    // 4. Lewati (skip) → onboardingDone=true, 0 rows, wizard tidak muncul lagi
    await saveVisibility(uid, { groupIdsOff: [], appIdsOff: [], appIdsOn: [], skip: true });
    profile = await getVisibilityProfile(uid);
    assertEq(profile.needsOnboarding, false, "skip sets onboardingDone");
    assertEq(profile.groupOverrides.size, 0, "skip → no group rows");

    // 5. Sembunyikan grup (materialisasi ulang: simpan full state)
    await saveVisibility(uid, { groupIdsOff: [group.id], appIdsOff: [], appIdsOn: [], skip: false });
    profile = await getVisibilityProfile(uid);
    assertEq(profile.groupOverrides.get(group.id), false, "group hidden");
    assertEq(profile.appOverrides.size, 0, "no app rows");

    // 6. Simpan: sembunyikan grup tapi override appB on → grid menampilkan appB saja
    await saveVisibility(uid, { groupIdsOff: [group.id], appIdsOff: [], appIdsOn: [appB.id], skip: false });
    profile = await getVisibilityProfile(uid);
    assertEq(profile.appOverrides.get(appB.id), true, "appB override on");

    console.log("\n=== ALL PASS ===");
  } finally {
    // Cleanup — jangan menyisakan data test
    await prisma.visibility.deleteMany({ where: { portalUserId: uid } });
    await prisma.portalUser.delete({ where: { id: uid } }).catch(() => {});
    await prisma.portalGroupApp.deleteMany({ where: { groupId: group.id } }).catch(() => {});
    await prisma.portalGroup.delete({ where: { id: group.id } }).catch(() => {});
    await prisma.portalApp.deleteMany({ where: { slug: { in: ["test-vis-a", "test-vis-b"] } } }).catch(() => {});
  }
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
```

> Catatan untuk implementer: guard `prisma.visibility` — Prisma menghasilkan accessor berdasarkan nama model (di sini `portal_user_app_visibility` → `prisma.portalUserAppVisibility`). Gunakan `prisma.portalUserAppVisibility`, bukan `prisma.visibility`.

- [ ] **Step 2: Run test untuk verifikasi gagal**

Run: `npx tsx scripts/test-visibility.ts`
Expected: FAIL di langkah 3 (`needsOnboarding` tidak terdefinisi — helper belum ada).

- [ ] **Step 3: Implementasi helper**

Tambahkan ke `lib/portal-access.ts`:

```ts
import prisma from "@/lib/prisma";

// (sudah ada APP_SELECT di atas — jangan duplikasi, pakai yang ada)

export interface VisibilityProfile {
    needsOnboarding: boolean;
    groupOverrides: Map<string, boolean>;
    appOverrides: Map<string, boolean>;
}

/**
 * Profil visibility per user.
 * needsOnboarding = !PortalUser.onboardingDone (flag eksplisit, bukan jumlah row).
 */
export async function getVisibilityProfile(portalUserId: string): Promise<VisibilityProfile> {
    const user = await prisma.portalUser.findUnique({
        where: { id: portalUserId },
        select: { onboardingDone: true },
    });
    if (!user) {
        return { needsOnboarding: true, groupOverrides: new Map(), appOverrides: new Map() };
    }

    const rows = await prisma.portalUserAppVisibility.findMany({
        where: { portalUserId },
        select: { groupId: true, appId: true, visible: true },
    });

    const groupOverrides = new Map<string, boolean>();
    const appOverrides = new Map<string, boolean>();
    for (const r of rows) {
        if (r.groupId) groupOverrides.set(r.groupId, r.visible);
        if (r.appId) appOverrides.set(r.appId, r.visible);
    }

    return { needsOnboarding: !user.onboardingDone, groupOverrides, appOverrides };
}

export interface SaveVisibilityInput {
    groupIdsOff: string[];
    appIdsOff: string[];
    appIdsOn: string[];
    skip?: boolean;
}

/**
 * Simpan/replace seluruh preferensi visibility user + tandai onboardingDone.
 * Transactional: hapus semua rows → buat ulang dari input (atau skip=true → tak buat apa-apa).
 * Semua yang tidak tercantum di groupIdsOff/appIdsOff = visible (default-on).
 */
export async function saveVisibility(portalUserId: string, input: SaveVisibilityInput): Promise<void> {
    const { groupIdsOff, appIdsOff, appIdsOn, skip } = input;
    const onGroupIds = new Set<string>();
    const groupVisibleSet = new Set<string>(groupIdsOff); // dianrtikan: yang off
    // NOTE: groupIdsOff menyimpan grup yang akan di-HIDE. Tidak ada 'groupIdsOn' di API onboarding
    // (semua grup default on selain yang di-off). Tetap perlu dedup dengan app params jika overlap.

    const appVisibleSet = new Set<string>(appIdsOn); // override ON
    const appOffSet = new Set<string>(appIdsOff);    // override OFF

    await prisma.$transaction(async (tx) => {
        await tx.portalUserAppVisibility.deleteMany({ where: { portalUserId } });

        if (skip) {
            await tx.portalUser.update({
                where: { id: portalUserId },
                data: { onboardingDone: true },
            });
            return; // hanya flag, tanpa rows
        }

        const groupRows = [...groupVisibleSet].map((groupId) => ({
            portalUserId,
            groupId,
            appId: null as string | null,
            visible: false,
        }));

        const appRows: Array<{ portalUserId: string; groupId: string | null; appId: string; visible: boolean }> = [];
        for (const appId of appVisibleSet) appRows.push({ portalUserId, groupId: null, appId, visible: true });
        for (const appId of appOffSet) appRows.push({ portalUserId, groupId: null, appId, visible: false });

        await tx.portalUserAppVisibility.createMany({ data: groupRows });
        await tx.portalUserAppVisibility.createMany({ data: appRows });

        await tx.portalUser.update({
            where: { id: portalUserId },
            data: { onboardingDone: true },
        });
    });

    _ = onGroupIds; // placeholder guard (belum dipakai)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ = undefined;
```

> Catatan implementer: ada dua baris yang membingungkan (`onGroupIds`, `_ =`). Silakan bersihkan — tujuannya hanya: `groupIdsOff` → row `visible=false` per grup; `appIdsOn` → row `visible=true` per app; `appIdsOff` → row `visible=false` per app; `skip=true` → tanpa row, hanya set `onboardingDone`. Hapus `onGroupIds` dan placeholder jiplak di komit final.

- [ ] **Step 4: Perbaiki nama accessor + jalankan ulang test**

Pastikan `prisma.portalUserAppVisibility` (bukan typo), jalankan:
Run: `npx tsx scripts/test-visibility.ts`
Expected: **PASS semua** (5 kasus: fresh, skip, sembunyikan grup, override appB).

- [ ] **Step 5: Commit**

```bash
git add lib/portal-access.ts scripts/test-visibility.ts
git commit -m "feat(portal): helper visibility profile & save + self-check test"
```

---

### Task 3: Ubah `getAccessiblePortalApps` — semua app aktif + filter visibility + kelompokkan

**Files:**
- Modify: `lib/portal-access.ts`

**Interfaces:**
- Consumes: `getVisibilityProfile` (Task 2), `PortalGroupApp`, `PortalApp`.
- Produces: `getAccessiblePortalApps(userId)` sekarang mengembalikan `Array<{ ...app; groupName: string | null }>`? **Tidak** — lihat catatan. Lihat konsumen lama: `app/portal/page.tsx` dan `app/api/portal/credentials` GET memakai array polos `AppCardProps` (list `id`, `name`, `slug`, `description`, `logoPath`, `category`, `displayOrder`). **Pertahankan bentuk return lama** (array app polos) agar tidak merusak konsumen; grid mengelompokkan nanti di layer komponen (Task 6). Fungsi ini hanya memfilter visibility.

- [ ] **Step 1: Ganti implementasi**

Timpa `getAccessiblePortalApps` di `lib/portal-access.ts`:

```ts
export async function getAccessiblePortalApps(portalUserId: string) {
    // Semua app aktif tersedia untuk semua user (tidak lagi filter group/direct).
    const allApps = await prisma.portalApp.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: APP_SELECT,
    });

    const { groupOverrides, appOverrides } = await getVisibilityProfile(portalUserId);

    // Semua app yang di-hide karena override app=false
    const hiddenAppIds = new Set<string>();
    for (const [appId, v] of appOverrides) if (v === false) hiddenAppIds.add(appId);

    // Grup-hidden (untuk app yang tidak punya override app=true)
    const hiddenGroupIds = new Set<string>();
    for (const [gid, v] of groupOverrides) if (v === false) hiddenGroupIds.add(gid);

    // perlu mapping appId → group untuk deteksi app di grup hidden
    const groupLinks = await prisma.portalGroupApp.findMany({
        where: { groupId: { in: [...hiddenGroupIds] } },
        select: { appId: true, groupId: true },
    });
    const appsInHiddenGroups = new Set<string>(groupLinks.map((l) => l.appId));

    const result = allApps.filter((app) => {
        if (hiddenAppIds.has(app.id)) return false;
        if (appsInHiddenGroups.has(app.id) && !(appOverrides.get(app.id) === true)) return false;
        return true;
    });

    return result;
}
```

- [ ] **Step 2: Update test visibility → sertakan `getAccessiblePortalApps`**

Tambahkan ke `scripts/test-visibility.ts` (setelah kasus 6, sebelum ALL PASS):

```ts
    const { getAccessiblePortalApps } = await import("../lib/portal-access");
    // user menyembunyikan grup (appB override on). Grid harus hanya berisi appB.
    let grid = await getAccessiblePortalApps(uid);
    const gridIds = grid.map((a) => a.slug);
    assertEq(gridIds.includes("test-vis-a"), false, "appA hidden (via group)");
    assertEq(gridIds.includes("test-vis-b"), true, "appB shown (app override on)");

    // App baru (tanpa visibility row) → tampil default
    const appC = await prisma.portalApp.create({
        data: { slug: "test-vis-c", name: "Test Vis C", url: "https://c.test", isActive: true },
    });
    await prisma.portalGroupApp.create({ data: { groupId: group.id, appId: appC.id } });
    grid = await getAccessiblePortalApps(uid);
    assertEq(grid.map((a) => a.slug).includes("test-vis-c"), false, "appC in hidden group stays hidden");
    // (grup masih hidden → appC juga tersembunyi, konsisten)

    // App baru di grup NON-hidden → tampil
    const group2 = await prisma.portalGroup.create({ data: { name: "Test-Grup-Vis2", description: "temp" } });
    const appD = await prisma.portalApp.create({
        data: { slug: "test-vis-d", name: "Test Vis D", url: "https://d.test", isActive: true },
    });
    await prisma.portalGroupApp.create({ data: { groupId: group2.id, appId: appD.id } });
    grid = await getAccessiblePortalApps(uid);
    assertEq(grid.map((a) => a.slug).includes("test-vis-d"), true, "appD in visible group shows");
    await prisma.portalGroup.delete({ where: { id: group2.id } }).catch(() => {});
    await prisma.portalApp.deleteMany({ where: { slug: { in: ["test-vis-c", "test-vis-d"] } } }).catch(() => {});
```

- [ ] **Step 3: Run test**

Run: `npx tsx scripts/test-visibility.ts`
Expected: PASS (5 kasus lama + 4 baru).

- [ ] **Step 4: Commit**

```bash
git add lib/portal-access.ts scripts/test-visibility.ts
git commit -m "feat(portal): getAccessiblePortalApps — semua app aktif + filter visibility"
```

---

### Task 4: API `POST /api/portal/visibility` (onboarding save)

**Files:**
- Create: `app/api/portal/visibility/route.ts`
- Modify: `lib/validation-schemas.ts`

**Interfaces:**
- Consumes: `saveVisibility` (Task 2), `portalAuthOptions`, `validateInput`/`formatZodErrors`, `logAudit`.
- Produces: `POST /api/portal/visibility` — body `{ groupIdsOff?: string[], appIdsOff?: string[], appIdsOn?: string[], skip?: boolean }` → 200 `{ message: "ok" }`; 401 / 400 / 500. Schema `saveVisibilitySchema` di `lib/validation-schemas.ts`.

- [ ] **Step 1: Tambah schema Zod**

Di `lib/validation-schemas.ts` (di dekat schema portal lain):

```ts
export const saveVisibilitySchema = z.object({
    groupIdsOff: z.array(z.string().cuid()).default([]),
    appIdsOff: z.array(z.string().cuid()).default([]),
    appIdsOn: z.array(z.string().cuid()).default([]),
    skip: z.boolean().optional().default(false),
});

export const patchVisibilitySchema = z.object({
    groupId: z.string().cuid().optional(),
    appId: z.string().cuid().optional(),
    visible: z.boolean(),
});
```

- [ ] **Step 2: Tulis route**

Buat `app/api/portal/visibility/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { saveVisibility } from "@/lib/portal-access";
import { saveVisibilitySchema, patchVisibilitySchema, validateInput, formatZodErrors } from "@/lib/validation-schemas";
import { logAudit } from "@/lib/audit";

// POST /api/portal/visibility — onboarding/reset preferensi user.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const userId = session.user.id;

        const body = await request.json();
        const validation = validateInput(saveVisibilitySchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { groupIdsOff, appIdsOff, appIdsOn, skip } = validation.data;
        await saveVisibility(userId, { groupIdsOff, appIdsOff, appIdsOn, skip });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "CONFIG",
            action: "VISIBILITY_SAVE",
            entityType: "PORTAL_USER",
            entityId: userId,
            metadata: { groupIdsOff: groupIdsOff.length, appIdsOff: appIdsOff.length, appIdsOn: appIdsOn.length, skip: !!skip },
        }).catch(() => {});

        return NextResponse.json({ message: "ok" });
    } catch (err) {
        console.error("POST /api/portal/visibility:", err);
        return NextResponse.json({ error: "Failed to save visibility" }, { status: 500 });
    }
}

// PATCH /api/portal/visibility — ubah satu row (groupId ATAU appId).
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(portalAuthOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const userId = session.user.id;

        const body = await request.json();
        const validation = validateInput(patchVisibilitySchema, body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: formatZodErrors(validation.errors) },
                { status: 400 }
            );
        }

        const { groupId, appId, visible } = validation.data;
        if (!!groupId === !!appId) {
            // harus salah satu (xor)
            return NextResponse.json({ error: "Exactly one of groupId/appId required" }, { status: 400 });
        }

        await saveVisibilityPartial(userId, { groupId, appId, visible });

        await logAudit({
            actorType: "PORTAL_USER",
            actorId: userId,
            category: "CONFIG",
            action: "VISIBILITY_UPDATE",
            entityType: "PORTAL_USER",
            entityId: userId,
            metadata: { groupId, appId, visible },
        }).catch(() => {});

        return NextResponse.json({ message: "ok" });
    } catch (err) {
        console.error("PATCH /api/portal/visibility:", err);
        return NextResponse.json({ error: "Failed to update visibility" }, { status: 500 });
    }
}
```

- [ ] **Step 3: Tambah helper `saveVisibilityPartial`**

Tambahkan di `lib/portal-access.ts`:

```ts
/**
 * Ubah visibility satu entitas (groupId ATAU appId).
 * visible=true → hapus row (default show); visible=false → upsert row visible=false.
 */
export async function saveVisibilityPartial(
    portalUserId: string,
    input: { groupId?: string; appId?: string; visible: boolean }
): Promise<void> {
    const { groupId, appId, visible } = input;

    const whereGroup = groupId ? { portalUserId_groupId: { portalUserId, groupId } } : undefined;
    const whereApp = appId ? { portalUserId_appId: { portalUserId, appId } } : undefined;
    const where = whereGroup ?? whereApp;

    if (!where) throw new Error("saveVisibilityPartial: need groupId or appId");

    if (visible) {
        // Default show → hapus override row
        await prisma.portalUserAppVisibility.deleteMany({ where: { portalUserId, ...(groupId ? { groupId } : { appId }) } });
    } else {
        await prisma.portalUserAppVisibility.upsert({
            where,
            update: { visible: false },
            create: {
                portalUserId,
                groupId: groupId ?? null,
                appId: appId ?? null,
                visible: false,
            },
        });
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/portal/visibility/route.ts lib/portal-access.ts lib/validation-schemas.ts
git commit -m "feat(portal): API visibility POST/PATCH + partial helper"
```

---

### Task 5: Grid `/portal` — render wizard overlay saat onboarding

**Files:**
- Modify: `app/portal/page.tsx`
- Create: `components/portal/OnboardingWizard.tsx`, `components/portal/GroupedAppGrid.tsx`

**Interfaces:**
- Consumes: `getVisibilityProfile` (Task 2), `getAccessiblePortalApps` (Task 3), `PortalGroupApp`/`PortalApp` (untuk struktur grup).
- Produces: `/portal` merender wizard (bila `needsOnboarding`) atau grid app berkelompok per-grup.

- [ ] **Step 1: Update `app/portal/page.tsx`**

`app/portal/page.tsx` menjadi server component: ambil `profile = await getVisibilityProfile(userId)` dan `apps = await getAccessiblePortalApps(userId)`, lalu:

```tsx
import OnboardingWizard from "@/components/portal/OnboardingWizard";
import GroupedAppGrid from "@/components/portal/GroupedAppGrid";

// ... (server component, setelah ambil profile & apps)

if (profile.needsOnboarding) {
    return <OnboardingWizard appSlug={/* optional */} />;
}

// else: grouped grid
return <GroupedAppGrid apps={apps} credStatus={credStatus} />;
```

> Catatan: `credStatus` dihitung seperti sekarang (`hasCredential` per app). Pindahkan logika AppCard ke dalam `GroupedAppGrid`. Grid pakai `AppCard` (component existing) — jangan ubah props-nya.

- [ ] **Step 2: Buat `OnboardingWizard.tsx`**

Client component. Props: `{ onDone: () => void }` (atau langsung redirect ke `/portal` setelah POST). Data grup+app diambil dari `GET /api/portal/visibility-data` (lihat Task 6) ATAU di-build server-side dan di-pass sebagai props. Simplenya: pass `groups` sebagai props dari server component:

```tsx
"use client";
import { useState } from "react";

export interface OnboardingGroup {
    id: string;
    name: string;
    apps: { id: string; name: string; logoPath?: string | null }[];
}

export default function OnboardingWizard({ groups }: { groups: OnboardingGroup[] }) {
    const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
    const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    const toggleGroup = (gid: string) => {
        const next = new Set(hiddenGroups);
        next.has(gid) ? next.delete(gid) : next.add(gid);
        setHiddenGroups(next);
    };
    const toggleApp = (aid: string) => {
        const next = new Set(hiddenApps);
        next.has(aid) ? next.delete(aid) : next.add(aid);
        setHiddenApps(next);
    };

    const submit = async (skip: boolean) => {
        setSaving(true);
        await fetch("/api/portal/visibility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                groupIdsOff: [...hiddenGroups],
                appIdsOff: [...hiddenApps],
                appIdsOn: [],
                skip,
            }),
        });
        window.location.href = "/portal";
    };

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", color: "#fff" }}>Pilih Aplikasi Anda</h1>
            <p style={{ color: "var(--text-muted)" }}>Tentukan aplikasi yang ingin ditampilkan di beranda. Semua on secara default.</p>
            {groups.map((g) => (
                <div key={g.id} style={{ marginBottom: "16px", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontWeight: 600 }}>
                        <input type="checkbox" checked={!hiddenGroups.has(g.id)} onChange={() => toggleGroup(g.id)} />
                        {g.name}
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px", paddingLeft: "24px" }}>
                        {g.apps.map((a) => (
                            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
                                <input type="checkbox" checked={!hiddenApps.has(a.id)} onChange={() => toggleApp(a.id)} />
                                {a.name}
                            </label>
                        ))}
                    </div>
                </div>
            ))}
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button onClick={() => submit(false)} disabled={saving} style={{ padding: "10px 20px", backgroundColor: "var(--brand-red)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                    {saving ? "Menyimpan..." : "Simpan"}
                </button>
                <button onClick={() => submit(true)} disabled={saving} style={{ padding: "10px 20px", backgroundColor: "var(--border-color)", color: "var(--text-secondary)", border: "none", borderRadius: "8px", cursor: "pointer" }}>
                    Lewati
                </button>
            </div>
        </div>
    );
}
```

> Catatan: child checkbox dalam grup yang induknya off akan tetap "checked=true" visual, tapi karena induk off, efektif semua app di grup tersembunyi — konsisten. Di wizard ini, men-hide grup otomatis menandai semua child hidden untuk submit; app override yang perlu di-submit hanya yang user uncheck-kan langsung di child.

- [ ] **Step 3: Buat `GroupedAppGrid.tsx`**

Client/server safe component yang menerima `apps` (AppCard props array) + `groups` (struktur) dan merender grup demi grup:

```tsx
import AppCard from "@/components/portal/AppCard";

export default function GroupedAppGrid({
    groups,
}: {
    groups: Array<{ id: string; name: string; apps: Array<any> }>;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {groups.map((g) => (
                <section key={g.id}>
                    <h2 style={{ color: "var(--text-secondary)", fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>{g.name}</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                        {g.apps.map((app) => (
                            <AppCard key={app.id} {...app} hasCredential={false} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
```

> catatan: props dari server component; `hasCredential` diisi oleh server sebelum pass, jangan hardcode false. Lihat Task 6 untuk bangun `groups` dari `apps` + struktur grup.

- [ ] **Step 4: Commit**

```bash
git add app/portal/page.tsx components/portal/OnboardingWizard.tsx components/portal/GroupedAppGrid.tsx
git commit -m "feat(portal): onboarding wizard + grouped grid di /portal"
```

---

### Task 6: Struktur grup untuk wizard & grid — API/data pass

**Files:**
- Modify: `app/portal/page.tsx`
- Create: `lib/portal-layout.ts` (baru)

**Interfaces:**
- Consumes: `getVisibilityProfile`, `getAccessiblePortalApps` (Task 2/3), `PortalGroupApp`/`PortalApp`.
- Produces: `getPortalLayout(userId): Promise<{ groups: OnboardingGroup[]; visibleApps: AppCardProps[]; needsOnboarding: boolean }>` — dipakai oleh `app/portal/page.tsx` dan `app/portal/settings/page.tsx` (Task 7).

- [ ] **Step 1: Buat `lib/portal-layout.ts`**

```ts
import prisma from "@/lib/prisma";
import { getVisibilityProfile, getAccessiblePortalApps } from "@/lib/portal-access";

export interface PortalLayoutGroup {
    id: string;
    name: string;
    apps: Array<{
        id: string; name: string; slug: string; description?: string | null;
        logoPath?: string | null; category?: string | null; hasCredential: boolean;
    }>;
}

export interface PortalLayout {
    needsOnboarding: boolean;
    groups: PortalLayoutGroup[];
}

/**
 * Bangun struktur grup → apps untuk wizard & settings.
 * - needsOnboarding = !onboardingDone
 * - groups = semua grup aktif yang memuat ≥1 app (apps di dalamnya = SEMUA app di grup, termasuk yang hidden, agar settings bisa reveal)
 */
export async function getPortalLayout(portalUserId: string): Promise<PortalLayout> {
    const { needsOnboarding } = await getVisibilityProfile(portalUserId);

    const groupsRaw = await prisma.portalGroup.findMany({
        where: { isActive: true },
        select: {
            id: true, name: true,
            apps: {
                where: { app: { isActive: true } },
                select: {
                    app: {
                        select: {
                            id: true, name: true, slug: true, description: true,
                            logoPath: true, category: true, displayOrder: true,
                        },
                    },
                },
                orderBy: { app: { displayOrder: "asc" as const } },
            },
        },
        orderBy: { name: "asc" },
    });

    const groups: PortalLayoutGroup[] = groupsRaw.map((g) => ({
        id: g.id,
        name: g.name,
        apps: g.apps.map(({ app }) => ({ ...app, hasCredential: false })),
    }));

    return { needsOnboarding, groups };
}
```

> Catatan: `hasCredential` diisi oleh konsumen (task 7/pages) — helper ini return `false` placeholder; pages menghitung via `prisma.portalUserAppCredential` seperti sekarang di `app/portal/page.tsx`.

- [ ] **Step 2: Integrasikan ke `app/portal/page.tsx`**

Ganti body halaman: ambil `layout = await getPortalLayout(userId)`. Kalau `layout.needsOnboarding` → render `<OnboardingWizard groups={layout.groups} />`. Selainnya render `GroupedAppGrid`. Isi `hasCredential` per app dengan query credential existing (sama seperti sekarang).

- [ ] **Step 3: Typecheck + run app secara manual**

Run: `npx tsc --noEmit`
Expected: tidak ada error.

Run dev: `npm run dev`, buka `http://localhost:3000/portal-login`, login (user portal). Verifikasi:
- User dengan `onboardingDone=false` → wizard muncul.
- Klik Lewati → grid (semua app on).
- (Manual toggle di settings ada di Task 7.)

- [ ] **Step 4: Commit**

```bash
git add app/portal/page.tsx lib/portal-layout.ts components/portal/OnboardingWizard.tsx components/portal/GroupedAppGrid.tsx
git commit -m "feat(portal): portal layout helper + wizard/grid render"
```

---

### Task 7: Halaman `/portal/settings` + link di header

**Files:**
- Create: `app/portal/settings/page.tsx`, `components/portal/VisibilitySettings.tsx`
- Modify: `components/portal/PortalHeader.tsx`

**Interfaces:**
- Consumes: `getPortalLayout` (Task 6), `saveVisibilityPartial` (Task 4), `PATCH /api/portal/visibility`.
- Produces: `/portal/settings` menampilkan SEMUA grup+app (termasuk yang hidden) dengan toggle; perubahan langsung PATCH.

- [ ] **Step 1: Buat `Page` (server) + `VisibilitySettings` (client)**

`app/portal/settings/page.tsx`:
```tsx
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import { getPortalLayout } from "@/lib/portal-layout";
import VisibilitySettings from "@/components/portal/VisibilitySettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const session = await getServerSession(portalAuthOptions);
    const userId = session!.user!.id as string;
    const { groups } = await getPortalLayout(userId);

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", color: "#fff" }}>Pengaturan Aplikasi</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                Pilih aplikasi yang tampil di beranda Anda. Perubahan langsung tersimpan.
            </p>
            <VisibilitySettings groups={groups} />
        </div>
    );
}
```

`components/portal/VisibilitySettings.tsx` (client) — hanya render `OnboardingWizard` yang sama tapi dengan mode persistent:
```tsx
"use client";
import OnboardingWizard from "@/components/portal/OnboardingWizard";

export default function VisibilitySettings({ groups }: { groups: any[] }) {
    // Reuse wizard UI tanpa tombol Lewati, dan PATCH per-toggle custom.
    // (Bisa fork kecil dari OnboardingWizard; cukup pada Task ini gunakan OnboardingWizard
    // tapi dengan prop `mode="settings"` & onToggle → PATCH.)
    return <OnboardingWizard groups={groups} mode="settings" />;
}
```

> Implementer: perjelas. Sederhananya — buat `VisibilitySettings` sebagai versi dari wizard yang: (a) tiap toggle langsung PATCH (bukan simpan penuh), (b) tanpa tombol "Lewati", (c) tampilkan semua apps termasuk yang hidden. Refactor ringan: rubah `OnboardingWizard` agar menerima `mode: "onboarding" | "settings"`. Jangan duplikasi besar.

- [ ] **Step 2: Tambah toggle per-entity + PATCH**

Dalam `VisibilitySettings`, untuk tiap grup/app toggle on/off → `fetch("/api/portal/visibility", { method: "PATCH", body: JSON.stringify({ groupId | appId, visible }) })`. `visible=true` → hapus row; `visible=false` → upsert false. Setelah response, refresh state (re-fetch dari `getPortalLayout` via router refresh).

- [ ] **Step 3: Tambah link di header**

Di `components/portal/PortalHeader.tsx`, tambahkan nav item:
```tsx
import { FiSettings } from "react-icons/fi";
// di array navItems:
{ href: "/portal/settings", icon: FiSettings, label: "Pengaturan" },
```

- [ ] **Step 4: Test manual + commit**

Run dev → login → buka `/portal/settings` → toggle grup/app → grid `/portal` berubah seketika. App tersembunyi muncul kembali di settings (reveal).
Run: `npx tsc --noEmit` → bersih.
Commit:
```bash
git add app/portal/settings/page.tsx components/portal/VisibilitySettings.tsx components/portal/PortalHeader.tsx components/portal/OnboardingWizard.tsx
git commit -m "feat(portal): halaman /portal/settings + toggle PATCH + link header"
```

---

### Task 8: Verify end-to-end + finalize

**Files:**
- Modify: (opsional) `README.md` / `docs`

**Interfaces:**
- Consumes: semua task di atas.

- [ ] **Step 1: Jalankan seluruh self-check**

Run: `npx tsx scripts/test-visibility.ts` → PASS.
Run: `npx tsc --noEmit` → bersih.
Run: `npm run build` → sukses.

- [ ] **Step 2: Test manual penuh di dev**

- User baru (`onboardingDone=false`) → login → wizard muncul.
- Pilih beberapa app off + "Simpan" → grid sesuai.
- Login ulang (session baru) → wizard TIDAK muncul.
- `/portal/settings` → toggle grup → grid berubah. Toggle app → grid berubah. Reveal app yang hidden.
- Tambah app baru di admin → muncul untuk user yang sudah onboarding (kecuali grupnya hidden).

- [ ] **Step 3: Update dokumentasi (opsional singkat)**

Tambahkan catatan singkat di `README.md` tentang fitur visibility per-user + endpoint baru. (Non-blocking.)

- [ ] **Step 4: Commit final + push**

```bash
git add -A
git commit -m "feat(portal): per-user app visibility — verifikasi e2e"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Model + `onboardingDone` → Task 1.
- Semantik default-visible + override → Task 2 (test 5/6) & Task 3.
- `getAccessiblePortalApps` filter + semua app aktif → Task 3.
- `POST` (skip, set onboardingDone) → Task 4; `PATCH` partial → Task 4 (helper `saveVisibilityPartial`).
- Wizard login pertama (deteksi via flag) → Task 5+6.
- Grid `/portal` grouped + wizard overlay → Task 5/6.
- `/portal/settings` reveal hidden → Task 7.
- Link header → Task 7.
- Validasi Zod → Task 4 (schema).
- Error handling (transaction, auth, audit) → Task 2/4.
- Test kecil → Task 2/3.
- YAGNI items — tidak dibuat task (dinyatakan di Global Constraints).

**Placeholder scan:** tidak ada "TBD"/"implement later". Semua step berisi kode. Satu catatan "sederhananya/implementer perjelas" di Task 7 untuk mode settings — sudah diberi arah konkret (refactor `OnboardingWizard` mode). Ini sengaja tersisa kecil agar implementer tidak duplikasi UI.

**Type consistency:** `saveVisibility` signature `{ groupIdsOff, appIdsOff, appIdsOn, skip }` konsisten Task 2 → Task 4. `getVisibilityProfile` return `{ needsOnboarding, groupOverrides, appOverrides }` konsisten Task 2 → Task 3. `getPortalLayout` return `{ needsOnboarding, groups }` konsisten Task 6 → Task 7. `AppCardProps` tidak berubah.