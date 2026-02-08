/**
 * Validation Schemas for API Endpoints
 * TASK-005: Input Validation & Sanitization
 * 
 * Centralized Zod schemas for all API input validation.
 * Use these schemas in API routes to validate request bodies.
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// -----------------------------------------
// Sanitization Helpers
// -----------------------------------------

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags for rich text content.
 */
export function sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'a', 'img', 'video', 'iframe',
            'blockquote', 'pre', 'code',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'div', 'span', 'hr',
        ],
        ALLOWED_ATTR: [
            'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
            'class', 'id', 'style', 'frameborder', 'allowfullscreen', 'allow',
        ],
        ALLOW_DATA_ATTR: false,
    });
}

/**
 * Sanitize plain text (strip all HTML).
 */
export function sanitizeText(text: string): string {
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

// -----------------------------------------
// Common Validation Patterns
// -----------------------------------------

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;

// -----------------------------------------
// Announcement Schemas
// -----------------------------------------

export const AnnouncementCreateSchema = z.object({
    title: z.string()
        .min(3, 'Title must be at least 3 characters')
        .max(200, 'Title must be at most 200 characters')
        .transform(sanitizeText),
    content: z.string()
        .min(10, 'Content must be at least 10 characters')
        .max(100000, 'Content too long')
        .transform(sanitizeHTML),
    categoryId: z.string().cuid('Invalid category ID'),
    imagePath: z.string().nullable().optional(),
    videoPath: z.string().nullable().optional(),
    videoType: z.enum(['upload', 'youtube']).nullable().optional(),
    youtubeUrl: z.string().url('Invalid YouTube URL').nullable().optional(),
    isHero: z.boolean().default(false),
    isPinned: z.boolean().default(false),
    isPublished: z.boolean().default(false),
    scheduledAt: z.string().datetime().nullable().optional(),
    takedownAt: z.string().datetime().nullable().optional(),
    siteIds: z.array(z.string().cuid()).optional(),
    primarySiteId: z.string().cuid().nullable().optional(),
});

export const AnnouncementUpdateSchema = AnnouncementCreateSchema.partial();

// -----------------------------------------
// Category Schemas
// -----------------------------------------

export const CategoryCreateSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be at most 50 characters')
        .transform(sanitizeText),
    color: z.string()
        .regex(hexColorPattern, 'Invalid hex color format')
        .default('#ED1C24'),
    siteId: z.string().cuid().optional(),
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial();

// -----------------------------------------
// Site Schemas
// -----------------------------------------

export const SiteCreateSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be at most 100 characters')
        .transform(sanitizeText),
    slug: z.string()
        .min(2, 'Slug must be at least 2 characters')
        .max(50, 'Slug must be at most 50 characters')
        .regex(slugPattern, 'Slug must be lowercase with hyphens only'),
    description: z.string().max(500).transform(sanitizeText).nullable().optional(),
    logoPath: z.string().nullable().optional(),
    faviconPath: z.string().nullable().optional(),
    primaryColor: z.string().regex(hexColorPattern).default('#ED1C24'),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
});

export const SiteUpdateSchema = SiteCreateSchema.partial();

// -----------------------------------------
// Comment Schemas (Public - most critical for XSS)
// -----------------------------------------

export const CommentCreateSchema = z.object({
    authorName: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be at most 100 characters')
        .transform(sanitizeText),
    authorEmail: z.string()
        .email('Invalid email format')
        .max(255)
        .optional()
        .nullable(),
    content: z.string()
        .min(2, 'Content must be at least 2 characters')
        .max(5000, 'Content must be at most 5000 characters')
        .transform(sanitizeText), // Comments are plain text only
    parentId: z.string().cuid().nullable().optional(),
});

// -----------------------------------------
// User Schemas
// -----------------------------------------

export const UserCreateSchema = z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password too long'),
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be at most 100 characters')
        .transform(sanitizeText),
    role: z.enum(['ADMIN', 'EDITOR']).default('EDITOR'),
    isSuperAdmin: z.boolean().default(false),
});

export const UserUpdateSchema = UserCreateSchema.partial().omit({ password: true });

// -----------------------------------------
// Newsletter Schemas
// -----------------------------------------

export const NewsletterSubscribeSchema = z.object({
    email: z.string().email('Invalid email format').max(255),
    name: z.string()
        .max(100)
        .transform(sanitizeText)
        .optional()
        .nullable(),
    siteId: z.string().cuid().optional(),
    siteSlug: z.string().optional(),
});

// -----------------------------------------
// Validation Helper
// -----------------------------------------

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; errors: z.ZodError };

/**
 * Validate data against a schema.
 * Returns sanitized data on success, or validation errors on failure.
 */
export function validateInput<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): ValidationResult<T> {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}

/**
 * Format Zod errors for API response.
 */
export function formatZodErrors(errors: z.ZodError): { field: string; message: string }[] {
    return errors.issues.map((issue: z.ZodIssue) => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));
}
