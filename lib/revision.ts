//
// Revision History Utility
// Manages announcement revision snapshots and restoration
//

import prisma from "@/lib/prisma";
import { ChangeType } from "@prisma/client";

interface CreateRevisionParams {
    announcementId: string;
    authorId: string;
    changeType?: ChangeType;
    changeSummary?: string;
}

/**
 * Get the next version number for an announcement
 */
export async function getNextVersion(announcementId: string): Promise<number> {
    const lastRevision = await prisma.announcementRevision.findFirst({
        where: { announcementId },
        orderBy: { version: "desc" },
        select: { version: true },
    });

    return (lastRevision?.version ?? 0) + 1;
}

/**
 * Create a revision snapshot of the current announcement state
 */
export async function createRevision({
    announcementId,
    authorId,
    changeType = "EDIT",
    changeSummary,
}: CreateRevisionParams) {
    // Get current announcement state
    const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
        select: {
            title: true,
            content: true,
            excerpt: true,
            imagePath: true,
        },
    });

    if (!announcement) {
        throw new Error("Announcement not found");
    }

    const version = await getNextVersion(announcementId);

    const revision = await prisma.announcementRevision.create({
        data: {
            announcementId,
            title: announcement.title,
            content: announcement.content,
            excerpt: announcement.excerpt,
            imagePath: announcement.imagePath,
            version,
            changeType,
            changeSummary,
            authorId,
        },
    });

    return revision;
}

/**
 * Restore an announcement to a specific revision
 */
export async function restoreRevision(revisionId: string, authorId: string) {
    const revision = await prisma.announcementRevision.findUnique({
        where: { id: revisionId },
    });

    if (!revision) {
        throw new Error("Revision not found");
    }

    // Create a snapshot of current state before restoring
    await createRevision({
        announcementId: revision.announcementId,
        authorId,
        changeType: "RESTORE",
        changeSummary: `Restored to version ${revision.version}`,
    });

    // Restore the announcement to the revision state
    const restored = await prisma.announcement.update({
        where: { id: revision.announcementId },
        data: {
            title: revision.title,
            content: revision.content,
            excerpt: revision.excerpt,
            imagePath: revision.imagePath,
        },
    });

    return restored;
}

/**
 * Get revision history for an announcement
 */
export async function getRevisionHistory(
    announcementId: string,
    limit = 20,
    offset = 0
) {
    const [revisions, total] = await Promise.all([
        prisma.announcementRevision.findMany({
            where: { announcementId },
            orderBy: { version: "desc" },
            take: limit,
            skip: offset,
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        }),
        prisma.announcementRevision.count({ where: { announcementId } }),
    ]);

    return { revisions, total };
}

/**
 * Compare two revisions
 */
export async function compareRevisions(revisionId1: string, revisionId2: string) {
    const [rev1, rev2] = await Promise.all([
        prisma.announcementRevision.findUnique({
            where: { id: revisionId1 },
        }),
        prisma.announcementRevision.findUnique({
            where: { id: revisionId2 },
        }),
    ]);

    if (!rev1 || !rev2) {
        throw new Error("One or both revisions not found");
    }

    return {
        revision1: rev1,
        revision2: rev2,
        changes: {
            title: rev1.title !== rev2.title,
            content: rev1.content !== rev2.content,
            excerpt: rev1.excerpt !== rev2.excerpt,
            imagePath: rev1.imagePath !== rev2.imagePath,
        },
    };
}
