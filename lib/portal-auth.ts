import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { v4 as uuidv4 } from "uuid";
import { logAudit } from "./audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 menit

export const portalAuthOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "portal-credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email dan password diperlukan");
                }

                const user = await prisma.portalUser.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    await logAudit({
                        actorType: "PORTAL_USER",
                        category: "AUTH",
                        action: "PORTAL_LOGIN_FAILED",
                        entityType: "PORTAL_SESSION",
                        outcome: "FAILURE",
                        errorMessage: "Email tidak ditemukan",
                    }).catch(() => {});
                    throw new Error("Email tidak ditemukan");
                }

                if (!user.isActive) {
                    throw new Error("Akun dinonaktifkan. Hubungi administrator.");
                }

                if (user.lockedUntil && new Date() < user.lockedUntil) {
                    const remaining = Math.ceil(
                        (user.lockedUntil.getTime() - Date.now()) / 60000
                    );
                    throw new Error(
                        `Akun terkunci. Coba lagi dalam ${remaining} menit.`
                    );
                }

                const isValid = await compare(
                    credentials.password,
                    user.passwordHash
                );

                if (!isValid) {
                    // Inkrementasi failedLoginCount; kunci jika >= 5
                    const newCount = user.failedLoginCount + 1;
                    if (newCount >= MAX_FAILED_ATTEMPTS) {
                        await prisma.portalUser.update({
                            where: { id: user.id },
                            data: {
                                failedLoginCount: 0,
                                lockedUntil: new Date(
                                    Date.now() + LOCKOUT_DURATION_MS
                                ),
                            },
                        });
                        await logAudit({
                            actorType: "PORTAL_USER",
                            actorId: user.id,
                            category: "SECURITY",
                            action: "ACCOUNT_LOCKED",
                            entityType: "PORTAL_USER",
                            entityId: user.id,
                            outcome: "FAILURE",
                            errorMessage: "5x login gagal, akun terkunci 15 menit",
                        }).catch(() => {});
                    } else {
                        await prisma.portalUser.update({
                            where: { id: user.id },
                            data: { failedLoginCount: newCount },
                        });
                        await logAudit({
                            actorType: "PORTAL_USER",
                            actorId: user.id,
                            category: "AUTH",
                            action: "PORTAL_LOGIN_FAILED",
                            entityType: "PORTAL_SESSION",
                            outcome: "FAILURE",
                            errorMessage: "Password salah",
                        }).catch(() => {});
                    }
                    throw new Error("Password salah");
                }

                // Login sukses: reset lockout counter
                if (user.failedLoginCount > 0 || user.lockedUntil) {
                    await prisma.portalUser.update({
                        where: { id: user.id },
                        data: { failedLoginCount: 0, lockedUntil: null },
                    });
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isSuperAdmin: false,
                };
            },
        }),
    ],
    cookies: {
        sessionToken: {
            name: "portal-auth.session-token",
            options: { httpOnly: true, sameSite: "lax", path: "/" },
        },
        callbackUrl: {
            name: "portal-auth.callback-url",
            options: { sameSite: "lax", path: "/" },
        },
        csrfToken: {
            name: "portal-auth.csrf-token",
            options: { httpOnly: true, sameSite: "lax", path: "/" },
        },
    },
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (trigger === "signIn" && user) {
                token.id = user.id;
                token.role = (user as { role: string }).role;

                const sessionToken = uuidv4();
                token.sessionToken = sessionToken;

                try {
                    const maxAge = parseInt(
                        process.env.PORTAL_SESSION_MAX_AGE || "43200"
                    );
                    await prisma.portalSession.create({
                        data: {
                            portalUserId: user.id,
                            sessionToken,
                            expiresAt: new Date(Date.now() + maxAge * 1000),
                        },
                    });
                    await logAudit({
                        actorType: "PORTAL_USER",
                        actorId: user.id,
                        category: "AUTH",
                        action: "PORTAL_LOGIN_SUCCESS",
                        entityType: "PORTAL_SESSION",
                        outcome: "SUCCESS",
                    }).catch(() => {});
                } catch (error) {
                    console.error("Failed to create portal session:", error);
                }
            }

            // Continuous Session Validation
            if (token.sessionToken) {
                try {
                    const record = await prisma.portalSession.findUnique({
                        where: { sessionToken: token.sessionToken as string },
                        select: { isRevoked: true, expiresAt: true },
                    });

                    if (
                        !record ||
                        record.isRevoked ||
                        new Date() > record.expiresAt
                    ) {
                        (token as Record<string, unknown>).id = null;
                        (token as Record<string, unknown>).role = null;
                        (token as Record<string, unknown>).sessionToken = null;
                    }
                } catch (error) {
                    // Fail-open for resilience (same pattern as CMS auth)
                    console.error(
                        "Portal session validation DB error (allowing session):",
                        error
                    );
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
    events: {
        async session({ token }) {
            if (token?.sessionToken) {
                try {
                    await prisma.portalSession.updateMany({
                        where: {
                            sessionToken: token.sessionToken as string,
                        },
                        data: { lastActiveAt: new Date() },
                    });
                } catch (error) {
                    console.error(
                        "Failed to update portal session activity:",
                        error
                    );
                }
            }
        },
    },
    pages: {
        signIn: "/portal-login",
    },
    session: {
        strategy: "jwt",
        maxAge: 12 * 60 * 60, // 12 hours
    },
    secret: process.env.NEXTAUTH_SECRET,
};
