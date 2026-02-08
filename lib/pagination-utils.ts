/**
 * Pagination Utilities
 * Centralized pagination limits and validation
 */

// Maximum items per page
export const MAX_LIMIT = 100;

// Maximum offset to prevent deep pagination attacks
export const MAX_OFFSET = 10000;

// Default limit if not specified
export const DEFAULT_LIMIT = 20;

/**
 * Validate and sanitize pagination parameters
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Validated { limit, skip } or error
 */
export function validatePagination(
    page: number | string | null,
    limit: number | string | null
): { limit: number; skip: number; error?: string } {
    // Parse and validate limit
    const parsedLimit = limit ? parseInt(String(limit)) : DEFAULT_LIMIT;

    if (isNaN(parsedLimit) || parsedLimit < 1) {
        return {
            limit: DEFAULT_LIMIT,
            skip: 0,
            error: 'Invalid limit parameter. Must be a positive number.'
        };
    }

    if (parsedLimit > MAX_LIMIT) {
        return {
            limit: MAX_LIMIT,
            skip: 0,
            error: `Limit exceeds maximum of ${MAX_LIMIT}. Using maximum limit.`
        };
    }

    // Parse and validate page
    const parsedPage = page ? parseInt(String(page)) : 1;

    if (isNaN(parsedPage) || parsedPage < 1) {
        return {
            limit: parsedLimit,
            skip: 0,
            error: 'Invalid page parameter. Must be a positive number.'
        };
    }

    // Calculate offset
    const skip = (parsedPage - 1) * parsedLimit;

    // Check max offset
    if (skip > MAX_OFFSET) {
        const maxPage = Math.floor(MAX_OFFSET / parsedLimit) + 1;
        return {
            limit: parsedLimit,
            skip: 0,
            error: `Page offset too large. Maximum page is ${maxPage} with limit ${parsedLimit}.`
        };
    }

    return {
        limit: parsedLimit,
        skip
    };
}

/**
 * Calculate pagination metadata
 */
export function getPaginationMeta(
    page: number,
    limit: number,
    total: number
) {
    const totalPages = Math.ceil(total / limit);
    const maxPage = Math.min(totalPages, Math.ceil(MAX_OFFSET / limit));

    return {
        page,
        limit,
        total,
        totalPages,
        maxPage,
        hasNext: page < maxPage,
        hasPrev: page > 1
    };
}
