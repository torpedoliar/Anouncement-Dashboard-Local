# 04 — SSO Credential Forwarding

> Mekanisme SSO: portal menyimpan kredensial terenkripsi per (user, app), lalu
> auto-submit form ke loginUrl app saat user membuka aplikasi.

## 1. Enkripsi kredensial (AES-256-GCM)

File baru: `lib/portal-crypto.ts` — memakai `node:crypto` (tanpa dependency baru).

```ts
import crypto from "node:crypto";

function getKey(): Buffer {
    const hex = process.env.PORTAL_CREDENTIAL_KEY;
    if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
        throw new Error("PORTAL_CREDENTIAL_KEY must be 64 hex chars (32 bytes)");
    }
    return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(blob: string): string {
    const key = getKey();
    const data = Buffer.from(blob, "base64");
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
}

export interface CredentialData {
    username: string;
    password: string;
    extra?: Record<string, string>;
}

export function encryptCredential(cred: CredentialData): string {
    return encrypt(JSON.stringify(cred));
}

export function decryptCredential(blob: string): CredentialData {
    return JSON.parse(decrypt(blob)) as CredentialData;
}
```

**Keamanan:**
- AES-256-GCM: confidentiality + integrity (auth tag mencegah tampering).
- IV random per encrypt (12 byte) — tidak reuse.
- Key dari env, tidak pernah di-hardcode, tidak di-log.
- `decrypt` throw jika tag mismatch (data korup/dimanipulasi).
- Validasi key saat startup (fail-closed jika key invalid).

## 2. Alur SSO launch (form-based)

```
User klik app di /portal
  │ ▼
GET /portal/app/[appSlug] (server component)
  ├─ 1. getServerSession(portalAuthOptions) → cek login portal
  │     └─ Tidak login → redirect /portal-login
  ├─ 2. canAccessPortalAppBySlug(userId, slug) → cek RBAC
  │     └─ Tidak ada akses → 403 "Tidak punya akses"
  ├─ 3. prisma.portalUserAppCredential.findUnique(userId, appId)
  │     └─ Tidak ada kredensial → prompt "Simpan kredensial dulu"
  ├─ 4. decryptCredential(credentialBlob) → CredentialData
  │     └─ Decrypt gagal → error "Kredensial korup, ulang simpan"
  ├─ 5. Render auto-submit form (target=_blank) ke app.loginUrl
  ├─ 6. Update lastUsedAt pada credential
  └─ 7. logAudit: action="SSO_LAUNCH", category=SECURITY, outcome=SUCCESS
```

## 3. Auto-submit form (server-rendered)

File baru: `app/portal/app/[appSlug]/page.tsx`

```ts
import { getServerSession } from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
import prisma from "@/lib/prisma";
import { canAccessPortalAppBySlug } from "@/lib/portal-access";
import { decryptCredential } from "@/lib/portal-crypto";
import { logAudit } from "@/lib/audit";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SsoLaunchPage({ params }: { params: { appSlug: string } }) {
    const session = await getServerSession(portalAuthOptions);
    if (!session?.user?.id) notFound();
    const userId = session.user.id;
    const app = await prisma.portalApp.findUnique({ where: { slug: params.appSlug } });
    if (!app || !app.isActive) notFound();

    const hasAccess = await canAccessPortalAppBySlug(userId, params.appSlug);
    if (!hasAccess) return <AccessDenied appName={app.name} />;

    const credRecord = await prisma.portalUserAppCredential.findUnique({
        where: { portalUserId_appId: { portalUserId: userId, appId: app.id } },
    });
    if (!credRecord) return <NoCredential appName={app.name} appSlug={app.slug} />;

    let cred;
    try { cred = decryptCredential(credRecord.credentialBlob); }
    catch { return <CorruptCredential appName={app.name} appSlug={app.slug} />; }

    await prisma.portalUserAppCredential.update({
        where: { id: credRecord.id }, data: { lastUsedAt: new Date() },
    });
    await logAudit({
        actorType: "PORTAL_USER", actorId: userId,
        category: "SECURITY", action: "SSO_LAUNCH",
        entityType: "PORTAL_APP", entityId: app.id,
        appId: app.id, outcome: "SUCCESS",
    });

    const extraFields = (app.extraFields as Array<{name:string;value:string}>) || [];
    return (
        <html>
            <body onLoad="document.forms[0].submit()">
                <p style={{ textAlign:"center", paddingTop:"40px", fontFamily:"sans-serif" }}>
                    Mengalihkan ke {app.name}...
                </p>
                <form method={app.httpMethod.toLowerCase()} action={app.loginUrl} target="_blank">
                    <input type="hidden" name={app.usernameField} value={cred.username} />
                    <input type="hidden" name={app.passwordField} value={cred.password} />
                    {extraFields.map((f, i) => (
                        <input key={i} type="hidden" name={f.name} value={f.value} />
                    ))}
                </form>
            </body>
        </html>
    );
}
```
## 4. CSRF token handling

Beberapa aplikasi web memerlukan CSRF token di form login. `PortalApp.extraFields` mendukung ini:

### Static token (tidak berubah):
```json
[{"name": "csrf_token", "type": "static", "value": "fixed-abc123"}]
```

### Dynamic token (future — fetch dari halaman login app):
```json
[{"name": "csrf_token", "type": "fetch", "selector": "input[name=csrf_token]", "url": "/login-page"}]
```
> Mode `fetch` memerlukan server-side fetch untuk ekstrak token. Diimplementasi fase berikutnya.

### Extra fixed fields (mis. company code, tenant):
```json
[
    {"name": "company", "type": "fixed", "value": "SJA"},
    {"name": "remember", "type": "fixed", "value": "true"}
]
```

## 5. Failure UX

| Skenario | Tampilan | Aksi user |
|----------|----------|-----------|
| Tidak login | Redirect `/portal-login` | Login |
| Tidak ada akses (RBAC) | "Anda tidak punya akses ke [AppName]" | Kembali ke `/portal` |
| Kredensial belum disimpan | "Anda belum menyimpan kredensial" + tombol | Link ke `/portal/credentials?app=[slug]` |
| Kredensial korup (decrypt gagal) | "Kredensial rusak, silakan simpan ulang" | Link ke `/portal/credentials?app=[slug]` |
| App nonaktif | 404 (notFound) | — |
| Submit gagal di app | App eksternal menampilkan error sendiri | User lihat pesan app |

> Karena form POST ke domain app eksternal, portal tidak bisa mendeteksi hasil login
> (cross-origin, no callback). Ini **limitasi** mode FORM (lihat `08-security.md`).

## 6. Health indicator (kredensial sudah ada?)

Di grid `/portal`, tiap app card menampilkan indikator:

```
┌─────────────────────┐
│ [Logo] AppName      │
│ Deskripsi app...     │
│ ✓ Kredensial tersimpan│  ← hasCredential() = true
│ [Buka Aplikasi]      │
└─────────────────────┘

┌─────────────────────┐
│ [Logo] AppName      │
│ Deskripsi app...     │
│ ⚠ Belum ada kredensial│  ← hasCredential() = false
│ [Simpan Kredensial]  │
└─────────────────────┘
```

Server component `/portal` query `hasCredential()` per app. Optimasi: left-join credential.

## 7. Mode SSO extensible

`PortalSsoMode` enum dirancang untuk berkembang:

| Mode | Status | Deskripsi |
|------|--------|-----------|
| `FORM` | ✅ MVP | Credential forwarding via auto-submit form (spec ini) |
| `REDIRECT` | 🔜 future | Redirect ke app dengan token di URL |
| `PROXY` | 🔜 future | Reverse proxy + inject header auth |
| `TOKEN` | 🔜 future | OIDC/OAuth2: portal sebagai IdP |

> `lib/portal-crypto.ts` dan struktur data tetap relevan untuk semua mode.

## 8. API credential (user self-service)

### POST `/api/portal/credentials` — simpan/update
```json
{ "appId": "cuid", "username": "john", "password": "secret", "extra": {} }
```
- Auth: portal session + `canAccessPortalApp(userId, appId)`.
- `encryptCredential({username, password, extra})` → upsert `credentialBlob`.
- Audit: `CREDENTIAL_SAVED` (category=SECURITY).

### DELETE `/api/portal/credentials?appId=[cuid]` — hapus
- Auth: portal session + owner check. Audit: `CREDENTIAL_DELETED`.

### GET `/api/portal/credentials` — daftar app + status
- Response: `[{ appId, appName, appSlug, hasCredential, lastUsedAt }]`
- **Tidak mengembalikan plaintext** — hanya status.

> **Penting:** plaintext kredensial hanya ada di memory saat SSO launch. API credential
> tidak pernah mengembalikan plaintext ke client.

