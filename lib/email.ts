//
// Email Service - Nodemailer with Internal SMTP Support
// Handles email sending for newsletter, notifications, etc.
//

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import Handlebars from "handlebars";
import prisma from "@/lib/prisma";

let transporter: Transporter | null = null;

/**
 * Get or create Nodemailer transporter with SMTP settings from database
 */
export async function getTransporter(): Promise<Transporter> {
    if (transporter) return transporter;

    const settings = await prisma.emailSettings.findFirst();

    transporter = nodemailer.createTransport({
        host: settings?.smtpHost || "localhost",
        port: settings?.smtpPort || 25,
        secure: settings?.smtpSecure ?? false,
        // Optional auth for internal SMTP servers that require it
        ...(settings?.smtpUser && settings?.smtpPass && {
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPass,
            },
        }),
        // For internal SMTP servers - disable TLS verification
        tls: {
            rejectUnauthorized: false,
        },
        // Connection timeout
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });

    return transporter;
}

/**
 * Reset transporter (call after settings change)
 */
export function resetTransporter() {
    transporter = null;
}

/**
 * Get sender info from settings
 */
async function getSenderInfo() {
    const settings = await prisma.emailSettings.findFirst();
    return {
        from: `"${settings?.fromName || "Santos Jaya Abadi"}" <${settings?.fromEmail || "news@example.com"}>`,
        replyTo: settings?.replyToEmail || undefined,
    };
}

/**
 * Compile Handlebars template with data
 */
function compileTemplate(template: string, data: Record<string, unknown>): string {
    const compiled = Handlebars.compile(template);
    return compiled(data);
}

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
    templateName?: string;
    announcementId?: string;
}

/**
 * Send a single email
 */
export async function sendEmail({
    to,
    subject,
    html,
    text,
    templateName = "custom",
    announcementId,
}: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const transport = await getTransporter();
        const sender = await getSenderInfo();

        const result = await transport.sendMail({
            ...sender,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML if no text provided
        });

        // Log successful send
        await prisma.emailLog.create({
            data: {
                recipientEmail: to,
                templateName,
                subject,
                status: "SENT",
                sentAt: new Date(),
                announcementId,
            },
        });

        return { success: true, messageId: result.messageId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Log failed send
        await prisma.emailLog.create({
            data: {
                recipientEmail: to,
                templateName,
                subject,
                status: "FAILED",
                failedAt: new Date(),
                errorMessage,
                announcementId,
            },
        });

        return { success: false, error: errorMessage };
    }
}

/**
 * Send email using a template from database
 */
export async function sendTemplatedEmail(
    templateSlug: string,
    to: string,
    data: Record<string, unknown>,
    announcementId?: string
) {
    const template = await prisma.emailTemplate.findUnique({
        where: { slug: templateSlug },
    });

    if (!template || !template.isActive) {
        return { success: false, error: "Template not found or inactive" };
    }

    const subject = compileTemplate(template.subject, data);
    const html = compileTemplate(template.htmlContent, data);
    const text = template.textContent ? compileTemplate(template.textContent, data) : undefined;

    return sendEmail({
        to,
        subject,
        html,
        text,
        templateName: template.name,
        announcementId,
    });
}

/**
 * Send bulk emails (for newsletter)
 */
export async function sendBulkEmails(
    emails: Array<{ to: string; data: Record<string, unknown> }>,
    templateSlug: string,
    announcementId?: string
) {
    const template = await prisma.emailTemplate.findUnique({
        where: { slug: templateSlug },
    });

    if (!template || !template.isActive) {
        return { success: false, error: "Template not found or inactive", sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const email of emails) {
        const subject = compileTemplate(template.subject, email.data);
        const html = compileTemplate(template.htmlContent, email.data);

        const result = await sendEmail({
            to: email.to,
            subject,
            html,
            templateName: template.name,
            announcementId,
        });

        if (result.success) {
            sent++;
        } else {
            failed++;
        }

        // Add small delay between emails to avoid overwhelming SMTP server
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { success: true, sent, failed };
}

/**
 * Test SMTP connection
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
        const transport = await getTransporter();
        await transport.verify();
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Connection failed"
        };
    }
}
