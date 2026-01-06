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
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role: string }).role;

                // Generate session token for tracking
                const sessionToken = uuidv4();
                token.sessionToken = sessionToken;

                // Create UserSession in database
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
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id: string }).id = token.id as string;
                (session.user as { role: string }).role = token.role as string;
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

