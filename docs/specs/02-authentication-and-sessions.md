# 02 — Authentication & Sessions (Portal)

> Instance NextAuth terpisah untuk portal user. Sesi portal ≠ sesi admin CMS.
> Pattern mengikuti `lib/auth.ts` yang sudah ada (JWT + DB-backed revocation).

## 1. Konfigurasi auth portal

File baru: `lib/portal-auth.ts`

```ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { v4 as uuidv4 } from "uuid";

export const portalAuthOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "portal-credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email dan password diperlukan");
                }
                const user = await prisma.portalUser.findUnique({
                    where: { email: credentials.email },
                });
                if (!user) {
                    // logAudit: LOGIN_FAILED (actorType=PORTAL_USER, outcome=FAILURE)
                    throw new Error("Email tidak ditemukan");
                }
                if (!user.isActive) {
                    throw new Error("Akun dinonaktifkan. Hubungi administrator.");
                }
                if (user.lockedUntil && new Date() < user.lockedUntil) {
                    const remaining = Math.ceil(
                        (user.lockedUntil.getTime() - Date.now()) / 60000
                    );
                    throw new Error(`Akun terkunci. Coba lagi dalam ${remaining} menit.`);
                }
                const isValid = await compare(credentials.password, user.passwordHash);
                if (!isValid) {
                    // Inkrementasi failedLoginCount; kunci jika >= 5; logAudit LOGIN_FAILED
                    throw new Error("Password salah");
                }
                return { id: user.id, email: user.email, name: user.name, role: user.role };
            },
        }),
    ],
    cookies: {
        sessionToken: {
            name: "portal-auth.session-token",
            options: { httpOnly: true, sameSite: "lax", path: "/" },
        },
        callbackUrl: { name: "portal-auth.callback-url", options: { sameSite: "lax", path: "/" } },
        csrfToken: { name: "portal-auth.csrf-token", options: { httpOnly: true, sameSite: "lax", path: "/" } },
    },
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (trigger === "signIn" && user) {
                token.id = user.id;
                token.role = (user as { role: string }).role;
                const sessionToken = uuidv4();
                token.sessionToken = sessionToken;
                try {
                    await prisma.portalSession.create({
                        data: {
                            portalUserId: user.id,
                            sessionToken,
                            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
                        },
                    });
                } catch (error) {
                    console.error("Failed to create portal session:", error);
                }
            }
            if (token.sessionToken) {
                try {
                    const record = await prisma.portalSession.findUnique({
                        where: { sessionToken: token.sessionToken as string },
                        select: { isRevoked: true, expiresAt: true },
                    });
                    if (!record || record.isRevoked || new Date() > record.expiresAt) {
                        (token as Record<string, unknown>).id = null;
                        (token as Record<string, unknown>).role = null;
                        (token as Record<string, unknown>).sessionToken = null;
                    }
                } catch (error) {
                    console.error("Portal session validation DB error:", error);
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id: string }).id = token.id as string;
                (session.user as { role: string }).role = token.role as string;
            }
            return session;
        },
    },
    pages: { signIn: "/portal-login" },
    session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // 12 jam
    secret: process.env.NEXTAUTH_SECRET, // reuse secret yang sama
};
```

## 2. Route handler

File baru: `app/api/portal-auth/[...nextauth]/route.ts`

```ts
import NextAuth from "next-auth";
import { portalAuthOptions } from "@/lib/portal-auth";
const handler = NextAuth(portalAuthOptions);
export { handler as GET, handler as POST };
```
## 3. Lockout akun (anti brute-force)

Konstanta: `MAX_FAILED_ATTEMPTS = 5`, `LOCKOUT_DURATION_MS = 15 * 60 * 1000` (15 menit).

Logika di `authorize()` saat password salah:

```ts
const newCount = user.failedLoginCount + 1;
if (newCount >= MAX_FAILED_ATTEMPTS) {
    await prisma.portalUser.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
    });
    // logAudit: action="ACCOUNT_LOCKED", category=SECURITY, outcome=FAILURE
} else {
    await prisma.portalUser.update({
        where: { id: user.id },
        data: { failedLoginCount: newCount },
    });
    // logAudit: action="LOGIN_FAILED", category=AUTH, outcome=FAILURE
}
```

Saat login sukses: reset `failedLoginCount = 0`, `lockedUntil = null`.
> Lockout bekerja sama dengan rate-limit middleware per-IP (lihat `08-security.md`).

## 4. Lupa & ubah password

### Lupa password (`/portal/forgot-password`)
1. User input email → cari `PortalUser` by email.
2. Generate reset token (UUID), simpan `resetTokenHash` + `resetTokenExpiresAt` di `PortalUser`.
3. Kirim email reset link via `lib/email.ts` (nodemailer + handlebars — sudah ada).
4. User klik link → `/portal/reset-password?token=...` → validasi → set password baru.
5. Audit: `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED` (category=AUTH).

### Ubah password sendiri (`/portal/settings`)
1. User input password lama + password baru. Verifikasi via `compare`.
2. Hash password baru via `bcrypt.hash(password, 10)` (pola `app/api/users/route.ts`).
3. Audit: `PORTAL_PASSWORD_CHANGE` (category=AUTH, outcome=SUCCESS/FAILURE).

### Admin reset password portal user (`/admin/portal-users`)
1. SuperAdmin klik "Reset Password" → input password baru.
2. Hash + simpan. Audit: `ADMIN_RESET_PORTAL_PASSWORD` (actorType=ADMIN_USER).

## 5. Manajemen sesi portal

### Helper: `lib/portal-access.ts`
```ts
export async function getPortalSession(request?): Promise<PortalSession|null>
export async function revokePortalSession(sessionId: string, actorId: string): Promise<void>
export async function getPortalUserSessions(portalUserId: string): Promise<PortalSession[]>
```

### API: `/api/portal-sessions`
- `GET` — daftar sesi (SuperAdmin: semua; PORTAL_USER: milik sendiri). Pakai `validatePagination`.
- `DELETE` — revoke sesi by id. Audit: `PORTAL_SESSION_REVOKED` (category=AUTH).

### Admin page: `/admin/portal-sessions`
- Mirror `/admin/sessions` CMS. Tampilkan: user, IP, perangkat, status, lastActive, revoke.

## 6. Env baru

| Env | Wajib | Default | Keterangan |
|-----|-------|---------|------------|
| `PORTAL_CREDENTIAL_KEY` | **YA** | — | 64-char hex (32 byte) untuk AES-256-GCM |
| `AUDIT_RETENTION_DAYS` | Tidak | `365` | Retensi audit log (0 = selamanya) |
| `PORTAL_SESSION_MAX_AGE` | Tidak | `43200` | Detik (12 jam) |

> Validasi env saat startup: jika `PORTAL_CREDENTIAL_KEY` invalid, aplikasi `throw` (fail-closed).

## 7. Tipe NextAuth portal

Update `types/next-auth.d.ts` — `role: string` mendukung portal role (`PORTAL_ADMIN`/`PORTAL_USER`).

```ts
declare module "next-auth" {
    interface Session {
        user: { id: string; role: string; isSuperAdmin?: boolean; } & DefaultSession["user"];
    }
}
```

> Dua instance NextAuth memakai tipe yang sama; `role` tetap `string`; cek spesifik di guard.

## 8. Perbandingan sesi CMS vs Portal

| Aspek | CMS (`lib/auth.ts`) | Portal (`lib/portal-auth.ts`) |
|-------|---------------------|-------------------------------|
| Tabel user | `users` | `portal_users` |
| Tabel sesi | `user_sessions` | `portal_sessions` |
| Cookie prefix | `next-auth.*` (default) | `portal-auth.*` |
| Login page | `/admin-login` | `/portal-login` |
| Redirect setelah login | `/admin` | `/portal` |
| Max age | 24 jam | 12 jam |
| Lockout | Tidak ada | Ya (5 percobaan → 15 menit) |
| SuperAdmin | `isSuperAdmin` boolean | `role === PORTAL_ADMIN` (future) |

