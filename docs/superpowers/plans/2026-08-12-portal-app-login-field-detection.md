# Portal App: Deteksi Otomatis Field Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tombol "Deteksi Otomatis" di form `/admin/portal-apps` yang fetch halaman login aplikasi (server-side), parse HTML, dan mengisi otomatis `usernameField`, `passwordField`, dan `extraFields`.

**Architecture:** Parser adalah **pure function** `detectLoginFields(html)` di `lib/portal-login-detect.ts` memakai **parse5** (sudah ter-install sebagai transitive dependency — TIDAK tambah dependency baru). API baru `POST /api/portal-apps/detect-fields` (SuperAdmin only) melakukan SSRF-safe fetch URL → HTML → panggil parser → return JSON. Client `page.tsx` menampilkan tombol, memanggil API, dan mengisi form.

**Tech Stack:** Next.js 15 App Router, parse5 8.0 (transitive), Zod (validation-schemas), TypeScript, `npx tsx` untuk self-check parser.

## Global Constraints

- **Tidak menambah dependency.** Parse5 sudah tersedia (via `jsdom`/`isomorphic-dompurify`). Impor: `import { parse } from "parse5"`.
- UI strings & commit messages dalam **Bahasa Indonesia**.
- `extraFields` format **`Record<string,string>`** (object) — KONSISTEN dengan `PortalApp.extraFields` di DB & `CredentialData.extra`. JANGAN array.
- API admin SuperAdmin only: `getServerSession(authOptions)` + `!session?.user?.isSuperAdmin` → 403.
- SSRF-safe: URL hanya `http/https`, tolak localhost/loopback/privat/link-local, `AbortSignal.timeout(8000)`, body cap 64KB.
- Parser TIDAK mengeksekusi JS (HTML statis). Tidak ada perubahan schema Prisma / migration.
- Self-check lewat `scripts/test-login-detect.ts` (tanpa DB) — pattern `npx tsx`.
- Gaya UI inline-style konsisten (`var(--brand-red)`, `var(--border-color)`, dll).

---

### Task 1: Parser murni `detectLoginFields` (TDD)

**Files:**
- Create: `lib/portal-login-detect.ts`
- Test: `scripts/test-login-detect.ts`

**Interfaces:**
- Consumes: `parse5` (transitive dep).
- Produces:
  ```ts
  export interface DetectedFields {
      usernameField: string | null;
      passwordField: string | null;
      extraFields: Record<string, string>;
  }
  export function detectLoginFields(html: string): DetectedFields
  ```
  Dipakai Task 2 (route) & Task 4 (self-check).

- [ ] **Step 1: Write the failing test**

Buat `scripts/test-login-detect.ts`:

```ts
/**
 * Self-check untuk lib/portal-login-detect.ts (tanpa DB).
 * Run: npx tsx scripts/test-login-detect.ts
 */
import { detectLoginFields } from "../lib/portal-login-detect";

function assertEq(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"} | ${label} | got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    if (!ok) process.exitCode = 1;
}

// 1. Form klasik: username + password
const r1 = detectLoginFields(`<form><input name="username" type="text"><input name="password" type="password"><button>Login</button></form>`);
assertEq(r1.usernameField, "username", "1a username name detected");
assertEq(r1.passwordField, "password", "1b password detected");
assertEq(r1.extraFields, {}, "1c no extra fields");

// 2. autocomplete="username" menang atas urutan DOM
const r2 = detectLoginFields(`<form><input name="email" type="email"><input name="username" autocomplete="username" type="text"><input name="pass" type="password"></form>`);
assertEq(r2.usernameField, "username", "2 autocomplete username wins");

// 3. Tanpa autocomplete → nama mengandung 'user'/'email' menang
const r3 = detectLoginFields(`<form><input name="first_name" type="text"><input name="user_id" type="text"><input name="pw" type="password"></form>`);
assertEq(r3.usernameField, "user_id", "3 keyword user wins");

// 4. Email field sebagai username
const r4 = detectLoginFields(`<form><input name="email" type="email"><input name="password" type="password"></form>`);
assertEq(r4.usernameField, "email", "4 email as username");

// 5. Hidden CSRF terdeteksi sebagai extraFields
const r5 = detectLoginFields(`<form><input type="hidden" name="_token" value="abc123"><input name="username" type="text"><input name="password" type="password"></form>`);
assertEq(r5.extraFields, { _token: "abc123" }, "5 hidden csrf captured");

// 6. Tanpa password → usernameField null
const r6 = detectLoginFields(`<form><input name="username" type="text"></form>`);
assertEq(r6.usernameField, null, "6 no password → null username");
assertEq(r6.passwordField, null, "6b no password → null password");

// 7. Tanpa form sama sekali
const r7 = detectLoginFields(`<html><body><p>Hello</p></body></html>`);
assertEq(r7.usernameField, null, "7 no form → null");
assertEq(r7.extraFields, {}, "7b no form → empty extra");

// 8. Multipel form — hanya form berisi password yang dipertimbangkan
const r8 = detectLoginFields(`<form><input name="search" type="search"></form><form><input name="username" type="text"><input type="password" name="pass"></form>`);
assertEq(r8.usernameField, "username", "8 picks login form not search");
assertEq(r8.passwordField, "pass", "8b password from login form");

// 9. Fallback: tanpa keyword → input non-password pertama
const r9 = detectLoginFields(`<form><input name="a" type="text"><input name="b" type="text"><input name="pw" type="password"></form>`);
assertEq(r9.usernameField, "a", "9 first text input fallback");

// 10. Input tanpa type (default text) bisa jadi username; input tanpa name di-skip
const r10 = detectLoginFields(`<form><input name="login" value=""><input name="passwd" type="password"></form>`);
assertEq(r10.usernameField, "login", "10 no-type input as username");

console.log("\n=== ALL PASS ===");
```

- [ ] **Step 2: Run test — harus FAIL (module belum ada)**

Run: `npx tsx scripts/test-login-detect.ts`
Expected: error `Cannot find module '../lib/portal-login-detect'`.

- [ ] **Step 3: Implementasi parser**

Buat `lib/portal-login-detect.ts`:

```ts
import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

export interface DetectedFields {
    usernameField: string | null;
    passwordField: string | null;
    extraFields: Record<string, string>;
}

const USERNAME_KEYWORDS = ["user", "login", "email", "account"];

interface FieldInfo {
    name: string | null;
    id: string | null;
    type: string;
    autocomplete: string | null;
    value: string;
}

function isElement(n: Node): n is Element {
    return n.nodeName !== "#text" && n.nodeName !== "#comment" && n.tagName !== undefined;
}

function elementName(el: Element): string {
    return el.attrs.find((a) => a.name.toLowerCase() === "name")?.value ?? null;
}

function elementAttr(el: Element, attr: string): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === attr)?.value ?? null;
}

function collectInputs(el: Element, acc: FieldInfo[]): void {
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
        const type = (elementAttr(el, "type") ?? "text").toLowerCase();
        acc.push({
            name: elementName(el),
            id: elementAttr(el, "id"),
            type,
            autocomplete: clusterAutocomplete(elementAttr(el, "autocomplete")),
            value: elementAttr(el, "value") ?? "",
        });
    }
    if (el.childNodes) {
        for (const child of el.childNodes) {
            if (isElement(child)) collectInputs(child, acc);
        }
    }
}

// autocomplete bisa "username" atau "username something" → ambil kata pertama
function clusterAutocomplete(raw: string | null): string | null {
    if (!raw) return null;
    return raw.toLowerCase().split(/\s+/)[0] ?? null;
}

function usernameScore(f: FieldInfo): number {
    if (f.type !== "text" && f.type !== "email" && f.type !== "tel" && f.type !== "search") return -1;
    if (f.autocomplete === "username") return 100;
    const hay = `${f.name ?? ""} ${f.id ?? ""}`.toLowerCase();
    if (USERNAME_KEYWORDS.some((k) => hay.includes(k))) return 50;
    return 0;
}

export function detectLoginFields(html: string): DetectedFields {
    const doc = parse(html);
    let usernameField: string | null = null;
    let passwordField: string | null = null;
    const extraFields: Record<string, string> = {};

    function visit(node: Node): void {
        if (!isElement(node)) return;
        const tag = node.tagName.toLowerCase();
        if (tag === "form") {
            // Kumpulkan input dalam form ini
            const inputs: FieldInfo[] = [];
            for (const child of node.childNodes ?? []) {
                if (isElement(child)) collectInputs(child, inputs);
            }
            const passwordInput = inputs.find((f) => f.type === "password");
            // Hanya form login (memiliki password) yang diproses
            if (passwordInput) {
                // Extra fields — hidden / no-type
                const extras: Record<string, string> = {};
                for (const f of inputs) {
                    if (f.name && (f.type === "hidden") && f.value) {
                        extras[f.name] = f.value;
                    }
                }
                Object.assign(extraFields, extras);

                // Username paling cocok
                let bestIdx = -1;
                let bestScore = -1;
                for (let i = 0; i < inputs.length; i++) {
                    const s = usernameScore(inputs[i]);
                    if (s > bestScore) { bestScore = s; bestIdx = i; }
                }
                const pw = passwordInput.name ?? passwordInput.id;
                if (bestIdx >= 0) usernameField = inputs[bestIdx].name ?? inputs[bestIdx].id;
                passwordField = pw;
            }
        }
        // Rekursi ke semua elemen (form bisa nested? tidak, tapi anak biasa di luar form pun mungkin)
        if (node.childNodes) {
            for (const child of node.childNodes) {
                if (isElement(child)) visit(child);
            }
        }
    }

    for (const child of doc.childNodes) {
        if (isElement(child)) visit(child);
    }

    return { usernameField, passwordField, extraFields };
}
```

> Catatan: parse5 `DefaultTreeAdapterMap` — jika versi TS tipe penerjemahan mengeluhkan, fallback:
> `type Node = any; type Element = any;` (aman, hanya internal parser).
> `Password` diambil dari `.name ?? .id` → nama field final.

- [ ] **Step 4: Run test — harus PASS**

Run: `npx tsx scripts/test-login-detect.ts`
Expected: 17 baris PASS, `=== ALL PASS ===`.

- [ ] **Step 5: Commit**

```bash
git add lib/portal-login-detect.ts scripts/test-login-detect.ts
git commit -m "feat(portal): parser deteksi field login (pure function, parse5)"
```

---

### Task 2: API `POST /api/portal-apps/detect-fields` (SSRF-safe fetch)

**Files:**
- Create: `app/api/portal-apps/detect-fields/route.ts`

**Interfaces:**
- Consumes: `detectLoginFields` (Task 1), `getServerSession`/`authOptions`, `validateInput`/`formatZodErrors`.
- Produces: `POST /api/portal-apps/detect-fields` — body `{ url: string }` → 200 `{ usernameField, passwordField, extraFields }` | 400 (URL invalid) | 403 | 422 (fetch gagal/tidak ada form) | 500.

- [ ] **Step 1: Tulis route**

Buat `app/api/portal-apps/detect-fields/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectLoginFields } from "@/lib/portal-login-detect";

const MAX_BODY = 64 * 1024; // 64KB cap

// SSRF harden dasar — tolak host internal/link-local
function isBlockedHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".localhost")) return true;
    // IPv4 privat / loopback / link-local
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (ipv4) {
        const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        return a >= 224; // multicast/unspecified
    }
    return false;
}

async function fetchHtml(url: string): Promise<string> {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("INVALID_PROTOCOL");
    }
    if (isBlockedHost(parsed.hostname)) {
        throw new Error("BLOCKED_HOST");
    }
    const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "PortalDetect/1.0" },
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml")) {
        throw new Error("NOT_HTML");
    }
    // Cap body 64KB
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
        const buffer = new Uint8Array(MAX_BODY);
        let offset = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value ?? new Uint8Array(0);
            if (offset + chunk.length > MAX_BODY) {
                // potong
                const slice = chunk.subarray(0, MAX_BODY - offset);
                buffer.set(slice, offset);
                offset += slice.length;
                break;
            }
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        html = new TextDecoder().decode(buffer.subarray(0, offset));
    } else {
        html = (await res.text()).substring(0, MAX_BODY);
    }
    return html;
}

// POST /api/portal-apps/detect-fields — SuperAdmin only. Body { url }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const url = body?.url;
        if (typeof url !== "string" || url.length > 500) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return NextResponse.json({ error: "URL must be http/https" }, { status: 400 });
        }
        if (isBlockedHost(parsed.hostname)) {
            return NextResponse.json({ error: "Host tidak diizinkan" }, { status: 400 });
        }

        const html = await fetchHtml(parsed.href);
        const result = detectLoginFields(html);
        if (!result.passwordField) {
            return NextResponse.json(
                { error: "Tidak ditemukan form login (input password) di halaman tersebut" },
                { status: 422 }
            );
        }
        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Fetch gagal";
        const status = message === "HTTP_404" ? 422 : 422; // semua kegagalan fetch jadi 422
        console.error("POST /api/portal-apps/detect-fields:", err);
        return NextResponse.json({ error: "Gagal mengambil halaman login" }, { status });
    }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tidak ada error baru (selain warning pre-existing).

- [ ] **Step 3: Test manual UI (opsional, butuh dev server)**

Run dev → `/admin/portal-apps` → Tambah Aplikasi → isi `LOGIN URL` → klik (belum ada tombol, tapi cek route dengan curl):
```bash
curl -X POST http://localhost:3000/api/portal-apps/detect-fields -H "Content-Type: application/json" -d '{"url":"https://example.com/login"}'
```
Expected (tanpa session): `{"error":"Forbidden: SuperAdmin only"}` status 403. (Berarti auth aman.)

- [ ] **Step 4: Commit**

```bash
git add app/api/portal-apps/detect-fields/route.ts
git commit -m "feat(portal): API deteksi field login (SSRF-safe fetch)"
```

---

### Task 3: Tombol + isi otomatis di form admin

**Files:**
- Modify: `app/admin/portal-apps/page.tsx`

**Interfaces:**
- Consumes: `POST /api/portal-apps/detect-fields` (Task 2), `formData` state existing.
- Produces: tombol "Deteksi Otomatis" di baris LOGIN URL; handler `handleDetect` yang memanggil API, menampilkan status, dan mengisi `usernameField`/`passwordField`/`extraFields` saat berhasil.

- [ ] **Step 1: Tambah state + handler**

Di `app/admin/portal-apps/page.tsx`, tambah state di dekat state lain (setelah `isSaving`):

```tsx
const [detecting, setDetecting] = useState(false);
const [detectMsg, setDetectMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
```

Tambahkan handler (setelah `handleSubmit`):

```tsx
const handleDetect = async () => {
    const target = (formData.loginUrl || "").trim();
    if (!target) {
        setDetectMsg({ type: "err", text: "Isi LOGIN URL terlebih dahulu." });
        return;
    }
    setDetecting(true);
    setDetectMsg(null);
    try {
        const res = await fetch("/api/portal-apps/detect-fields", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: target }),
        });
        const data = await res.json();
        if (!res.ok) {
            setDetectMsg({ type: "err", text: data.error || "Deteksi gagal" });
            return;
        }
        setFormData((prev) => ({
            ...prev,
            usernameField: data.usernameField ?? prev.usernameField,
            passwordField: data.passwordField ?? prev.passwordField,
            extraFields: Object.keys(data.extraFields || {}).length
                ? JSON.stringify(data.extraFields, null, 2)
                : prev.extraFields,
        }));
        setDetectMsg({ type: "ok", text: "Field terdeteksi. Review sebelum simpan." });
    } catch {
        setDetectMsg({ type: "err", text: "Terjadi kesalahan saat deteksi." });
    } finally {
        setDetecting(false);
    }
};
```

- [ ] **Step 2: Tambah tombol + status di UI LOGIN URL**

Ubah blok LOGIN URL (sebelumnya kolom input saja). Ganti:

```tsx
<div style={{ marginBottom: "16px" }}>
    <label style={{ display: "block", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>LOGIN URL</label>
    <input
        type="text"
        value={formData.loginUrl}
        onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
        placeholder="https://app.example.com/login"
        style={inputStyle}
    />
</div>
```

menjadi:

```tsx
<div style={{ marginBottom: "16px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <label style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>LOGIN URL</label>
        <button
            type="button"
            onClick={handleDetect}
            disabled={detecting}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: detecting ? "var(--border-color)" : "rgba(59, 130, 246, 0.2)",
                color: detecting ? "var(--text-muted)" : "var(--color-info)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: detecting ? "not-allowed" : "pointer",
            }}
        >
            {detecting ? <span>Mendeteksi...</span> : <span>Deteksi Otomatis</span>}
        </button>
    </div>
    <input
        type="text"
        value={formData.loginUrl}
        onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
        placeholder="https://app.example.com/login"
        style={inputStyle}
    />
    {detectMsg && (
        <p style={{
            marginTop: "8px",
            fontSize: "12px",
            color: detectMsg.type === "ok" ? "var(--color-success)" : "var(--color-error)",
        }}>
            {detectMsg.text}
        </p>
    )}
</div>
```

> Catatan: `spinner` di tombol diganti teks "Mendeteksi..." — sederhana, tidak butuh CSS keyframe ekstra. `type="button"` penting agar tidak submit form.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Run: `npx eslint app/admin/portal-apps/page.tsx` (atau `/ponytail-review`)
Expected: bersih dari error (warning pre-existing di file lain tak apa).

- [ ] **Step 4: Commit**

```bash
git add app/admin/portal-apps/page.tsx
git commit -m "feat(portal): tombol Deteksi Otomatis + isi otomatis field login"
```

---

### Task 4: Self-check penuh + finalisasi

**Files:**
- Modify: (tidak ada; hanya verifikasi)

- [ ] **Step 1: Jalankan self-check parser**

Run: `npx tsx scripts/test-login-detect.ts`
Expected: `=== ALL PASS ===` (17 assertion).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Test manual penuh (dev server, bila ada)**

- Tambah Aplikasi → isi LOGIN URL → klik Deteksi → username/password/extra terisi.
- LOGIN URL kosong → pesan "Isi LOGIN URL terlebih dahulu."
- URL privat (`http://192.168.1.1`) → "Host tidak diizinkan".
- URL non-http (`ftp://...`) → "URL harus http/https".

- [ ] **Step 4: Commit final + push**

```bash
git add -A
git commit -m "feat(portal): deteksi otomatis field login aplikasi — verifikasi e2e"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Parser `detectLoginFields` → Task 1 (TDD, 17 assertion).
- API SSRF-safe → Task 2 (protokol, host block, timeout, body cap).
- Tombol + isi otomatis → Task 3.
- Format `extraFields` object `Record<string,string>` → Task 1 (`extras[f.name]=f.value`) & Task 3 (`JSON.stringify(data.extraFields)`).
- Keamanan SuperAdmin only → Task 2 (`isSuperAdmin`).
- Error tidak me-leak HTML → Task 2 (`res.ok` cek + pesan singkat).
- YAGNI items — tidak dibuat task.

**Placeholder scan:** tidak ada "TBD"/"implement later". Setiap step berisi kode nyata.

**Type consistency:**
- `detectLoginFields(html): DetectedFields{usernameField,passwordField,extraFields}` konsisten Task 1 → Task 2.
- `DetectedFields.extraFields: Record<string,string>` konsisten Task 1 → Task 2 → Task 3.
- `POST .../detect-fields` return shape `{ usernameField, passwordField, extraFields }` konsisten Task 2 → Task 3 (`data.usernameField`, `data.extraFields`).

**Catatan delibrate simplification (`ponytail:`):**
- Spinner diganti teks "Mendeteksi..." (Task 3) — upgrade ke animasi ketika ada kebutuhan.
- `fetchHtml` body cap via reader manual — sedikit verbose tapi menghindari `res.text()` penuh 10MB.
- Parsing memakai `parse5` tree walker manual (bukan cheerio/jsdom) — `parse5` adalah lapisan terendah yang cukup; tidak perlu dep baru.
