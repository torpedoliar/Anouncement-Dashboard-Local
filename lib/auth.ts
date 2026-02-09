import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import { v4 as uuidv4 } from "uuid";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email dan password diperlukan");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    throw new Error("Email tidak ditemukan");
                }

                const isValid = await compare(credentials.password, user.passwordHash);

                if (!isValid) {
                    throw new Error("Password salah");
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isSuperAdmin: user.isSuperAdmin,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            // Only create session on initial sign-in, not on every token refresh
            if (trigger === 'signIn' && user) {
                token.id = user.id;
                token.role = (user as { role: string }).role;
                token.isSuperAdmin = (user as { isSuperAdmin: boolean }).isSuperAdmin;

                // Generate session token for tracking
                const sessionToken = uuidv4();
                token.sessionToken = sessionToken;

                // Create UserSession in database (only on sign-in)
                try {
                    await prisma.userSession.create({
                        data: {
                            userId: user.id,
                            sessionToken,
                            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                        },
                    });
                } catch (error) {
                    console.error("Failed to create user session:", error);
                }
            }

            // Continuous Session Validation (TASK-008)
            // Check if session is still valid in database on every access
            if (token.sessionToken) {
                try {
                    const sessionRecord = await prisma.userSession.findUnique({
                        where: { sessionToken: token.sessionToken as string },
                        select: { isRevoked: true, expiresAt: true },
                    });

                    // If session not found, revoked, or expired, clear the token
                    if (!sessionRecord || sessionRecord.isRevoked || new Date() > sessionRecord.expiresAt) {
                        // Clear critical fields to invalidate the session gracefully
                        // This prevents infinite login loops while still forcing logout
                        // Use type assertion to satisfy TypeScript
                        (token as Record<string, unknown>).id = null;
                        (token as Record<string, unknown>).role = null;
                        (token as Record<string, unknown>).sessionToken = null;
                        console.log("Session invalidated: revoked or expired");
                    }
                } catch (error) {
                    // On DB error, log but allow session to continue (fail-open for resilience)
                    // Security trade-off: prefer availability over strict security for DB issues
                    console.error("Session validation DB error (allowing session):", error);
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id: string }).id = token.id as string;
                (session.user as { role: string }).role = token.role as string;
                (session.user as { isSuperAdmin: boolean }).isSuperAdmin = token.isSuperAdmin as boolean;
                (session.user as { sessionToken?: string }).sessionToken = token.sessionToken as string;
            }
            return session;
        },
    },
    events: {
        // Update lastActiveAt on session access
        async session({ token }) {
            if (token?.sessionToken) {
                try {
                    await prisma.userSession.updateMany({
                        where: { sessionToken: token.sessionToken as string },
                        data: { lastActiveAt: new Date() },
                    });
                } catch (error) {
                    console.error("Failed to update session activity:", error);
                }
            }
        },
    },
    pages: {
        signIn: "/admin-login",
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },
    secret: process.env.NEXTAUTH_SECRET,
};

