// Utility functions for the announcement dashboard

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\-\-+/g, "-") // Replace multiple - with single -
        .replace(/^-+/, "") // Trim - from start
        .replace(/-+$/, ""); // Trim - from end
}

/**
 * Format date to Indonesian locale
 */
export function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

/**
 * Format date to short format
 */
export function formatDateShort(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, length: number = 100): string {
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + "...";
}

/**
 * Extract plain text from HTML content
 */
export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
}

/**
 * Generate excerpt from HTML content
 */
export function generateExcerpt(html: string, length: number = 150): string {
    const plainText = stripHtml(html);
    return truncate(plainText, length);
}

/**
 * Format number with thousand separator
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat("id-ID").format(num);
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 7) {
        return formatDateShort(d);
    } else if (diffDay > 0) {
        return `${diffDay} hari lalu`;
    } else if (diffHour > 0) {
        return `${diffHour} jam lalu`;
    } else if (diffMin > 0) {
        return `${diffMin} menit lalu`;
    } else {
        return "Baru saja";
    }
}

/**
 * Count words in text content
 */
export function countWords(text: string): number {
    const plainText = stripHtml(text);
    const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
}

/**
 * Calculate reading time in minutes (based on average 200 WPM)
 */
export function calculateReadingTime(content: string): number {
    const wordCount = countWords(content);
    const wordsPerMinute = 200;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    return Math.max(1, readingTime); // Minimum 1 minute
}

/**
 * Format reading time for display
 */
export function formatReadingTime(content: string): string {
    const minutes = calculateReadingTime(content);
    return `${minutes} menit baca`;
}

