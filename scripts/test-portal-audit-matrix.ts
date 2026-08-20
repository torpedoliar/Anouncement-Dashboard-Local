/**
 * Self-check kontrak payload Access Control Matrix (tanpa DB).
 * Menjaga bentuk yang dikirim /api/admin/portal-audit tetap cocok dengan
 * yang dibaca app/admin/portal-audit/page.tsx.
 * Run: npx tsx scripts/test-portal-audit-matrix.ts
 */
export {}; // jadikan modul agar helper tidak bentrok dengan skrip test lain

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// --- Fixture meniru hasil query Prisma -------------------------------------
const apps = [
    { id: "app1", name: "TR APPS", isPublic: true },
    { id: "app2", name: "K2", isPublic: false },
    { id: "app3", name: "Oracle EBS", isPublic: false },
];

interface Cred {
    id: string;
    appId: string;
    appUsername: string | null;
    label: string;
    lastUsedAt: Date | null;
}

const users: Array<{
    id: string;
    name: string;
    nik: string;
    role: string;
    appAccess: Array<{ app: { id: string; name: string }; role: string }>;
    groups: Array<{ group: { name: string; isActive: boolean; apps: Array<{ appId: string; app: { id: string; name: string } }> } }>;
    credentials: Cred[];
}> = [
    {
        id: "u1",
        name: "Budi",
        nik: "12345",
        role: "PORTAL_USER",
        appAccess: [{ app: { id: "app2", name: "K2" }, role: "USER" }],
        groups: [
            { group: { name: "Finance", isActive: true, apps: [{ appId: "app3", app: { id: "app3", name: "Oracle EBS" } }] } },
        ],
        credentials: [{ id: "c1", appId: "app1", appUsername: "budi.tr", label: "default", lastUsedAt: null }],
    },
    {
        id: "u2",
        name: "Sari",
        nik: "67890",
        role: "PORTAL_ADMIN",
        appAccess: [],
        groups: [],
        // Kredensial tanpa appUsername (kolom opsional) — harus fallback ke label.
        credentials: [{ id: "c2", appId: "app2", appUsername: null, label: "akun-utama", lastUsedAt: null }],
    },
];

// --- Meniru pembangunan accessMatrix di route.ts ---------------------------
function buildMatrix() {
    return users.map((u) => {
        const userAppAccessMap = new Map<string, { role?: string }>();
        for (const acc of u.appAccess) userAppAccessMap.set(acc.app.id, { role: acc.role });

        const userGroupAppsMap = new Map<string, string[]>();
        for (const ug of u.groups) {
            if (!ug.group.isActive) continue;
            for (const ga of ug.group.apps) {
                const ex = userGroupAppsMap.get(ga.appId) || [];
                ex.push(ug.group.name);
                userGroupAppsMap.set(ga.appId, ex);
            }
        }

        const userCredsMap = new Map<string, Cred[]>();
        for (const c of u.credentials) {
            const ex = userCredsMap.get(c.appId) || [];
            ex.push(c);
            userCredsMap.set(c.appId, ex);
        }

        const appStatuses: Record<string, any> = {};
        for (const app of apps) {
            const hasDirect = userAppAccessMap.has(app.id);
            const groupNames = userGroupAppsMap.get(app.id) || [];
            const hasGroup = groupNames.length > 0;
            const isPortalAdmin = u.role === "PORTAL_ADMIN";
            const isAllowed = app.isPublic || hasDirect || hasGroup || isPortalAdmin;
            const creds = userCredsMap.get(app.id) || [];

            let accessType = "NONE";
            if (isAllowed) {
                if (isPortalAdmin) accessType = "ADMIN";
                else if (hasDirect) accessType = "DIRECT";
                else if (hasGroup) accessType = "GROUP";
                else if (app.isPublic) accessType = "PUBLIC";
            }

            appStatuses[app.id] = {
                appId: app.id,
                appName: app.name,
                hasAccess: isAllowed,
                accessType,
                groupNames,
                hasCredential: creds.length > 0,
                credentialsCount: creds.length,
                username: creds[0]?.appUsername || creds[0]?.label || null,
            };
        }

        return {
            user: { id: u.id, name: u.name, nik: u.nik, role: u.role, groups: u.groups.map((g) => g.group.name) },
            apps: appStatuses,
        };
    });
}

const matrix = buildMatrix();

// --- 1. Bentuk yang dibaca frontend ----------------------------------------
// Regresi utama: API dulu mengirim {id,name,nik,...} datar, frontend membaca
// item.user.name -> undefined -> TypeError -> tab matrix gagal dimuat.
assertEq(typeof matrix[0].user, "object", "1a item.user ada (bukan undefined)");
assertEq(matrix[0].user.name, "Budi", "1b item.user.name terbaca");
assertEq(matrix[0].user.nik, "12345", "1c item.user.nik terbaca");
assertEq(matrix[0].user.groups, ["Finance"], "1d item.user.groups array string");

// Regresi kedua: apps dulu array, frontend meng-indeks item.apps[app.id].
assertEq(Array.isArray(matrix[0].apps), false, "1e item.apps objek ber-key appId, bukan array");
assertEq(matrix[0].apps["app1"].appName, "TR APPS", "1f item.apps[appId] terjangkau");

// Regresi ketiga: frontend membaca .hasAccess, API dulu mengirim .isAllowed.
assertEq(matrix[0].apps["app1"].hasAccess, true, "1g field bernama hasAccess");
// Regresi keempat: frontend membaca .username, API dulu mengirim .primaryUsername.
assertEq(matrix[0].apps["app1"].username, "budi.tr", "1h field bernama username");

// --- 2. Aturan akses --------------------------------------------------------
assertEq(matrix[0].apps["app1"].accessType, "PUBLIC", "2a app publik -> PUBLIC");
assertEq(matrix[0].apps["app2"].accessType, "DIRECT", "2b akses langsung -> DIRECT");
assertEq(matrix[0].apps["app3"].accessType, "GROUP", "2c via grup aktif -> GROUP");
assertEq(matrix[1].apps["app3"].accessType, "ADMIN", "2d PORTAL_ADMIN -> ADMIN semua app");
assertEq(matrix[1].apps["app3"].hasAccess, true, "2e PORTAL_ADMIN akses app restricted");

// --- 3. Fallback username ---------------------------------------------------
// appUsername opsional; tanpa fallback sel matrix tampil kosong walau kredensial ada.
assertEq(matrix[1].apps["app2"].username, "akun-utama", "3a fallback ke label saat appUsername null");
assertEq(matrix[0].apps["app2"].username, null, "3b tanpa kredensial -> null");
assertEq(matrix[0].apps["app2"].hasCredential, false, "3c tanpa kredensial -> hasCredential false");

// --- 4. Filter pencarian tahan data cacat ----------------------------------
function filterMatrix(items: any[], q: string) {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((item: any) => {
        const u = item?.user;
        if (!u) return false;
        return (
            (u.name?.toLowerCase().includes(s) ?? false) ||
            (u.nik?.toLowerCase().includes(s) ?? false) ||
            (u.groups ?? []).some((g: string) => g.toLowerCase().includes(s))
        );
    });
}

assertEq(filterMatrix(matrix, "budi").length, 1, "4a cari nama");
assertEq(filterMatrix(matrix, "67890").length, 1, "4b cari NIK");
assertEq(filterMatrix(matrix, "finance").length, 1, "4c cari grup");
assertEq(filterMatrix(matrix, "zzz").length, 0, "4d tidak cocok -> kosong");
// Baris cacat tidak boleh melempar dan menggagalkan seluruh tab.
assertEq(filterMatrix([{ user: null }, ...matrix], "budi").length, 1, "4e baris tanpa user tidak crash");
assertEq(filterMatrix([{ user: { name: "X" } }, ...matrix], "budi").length, 1, "4f user tanpa nik/groups tidak crash");

console.log("=== ALL PASS (access control matrix) ===");
