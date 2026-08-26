import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validatePagination } from '@/lib/pagination-utils';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentSiteId } from "@/lib/site-context";
import { canAccessSite, canEditOnSite } from "@/lib/site-access";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import { z } from "zod";

// WR-05: folder fisik ditentukan dari MIME tersimpan (bukan ekstensi nama file).
function isVideoMime(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

// File type configurations
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_TYPES = ["video/mp4"];
const PDF_TYPES = ["application/pdf"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (before compression)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

// Compression settings
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const QUALITY = 80;

// GET /api/media - List media (hybrid: siteId=null shows shared, siteId shows site-specific + shared)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        // Validated by validatePagination
                const pageParam = searchParams.get("page");
        const limitParam = searchParams.get("limit");
        const { limit, skip, error: paginationError } = validatePagination(pageParam, limitParam);
        if (paginationError) { console.warn(`Pagination warning: ${paginationError}`); }
        const type = searchParams.get("type"); // "image" | "video" | null (all)
        const siteIdParam = searchParams.get("siteId"); // Optional: explicit site filter
        const sharedOnly = searchParams.get("sharedOnly") === "true"; // Only show shared media
        // skip calculated by validatePagination

        // Resolve effective site: explicit param, else the current admin site cookie.
        const siteId = siteIdParam || (await getCurrentSiteId());
        const isSuperAdmin = !!session.user?.isSuperAdmin;

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        // Type filter
        if (type) {
            where.mimeType = type === "video"
                ? { startsWith: "video/" }
                : { startsWith: "image/" };
        }

        // Site filter (hybrid mode: site-specific + shared/global media)
        if (sharedOnly) {
            where.siteId = null;
        } else if (siteId) {
            if (!isSuperAdmin && session.user?.id && !(await canAccessSite(session.user.id, siteId))) {
                return NextResponse.json({ error: "No access to this site" }, { status: 403 });
            }
            where.OR = [{ siteId }, { siteId: null }];
        } else if (!isSuperAdmin) {
            // No site context and not SuperAdmin: only shared media (never leak all sites)
            where.siteId = null;
        }
        // SuperAdmin with no site context: show all media

        const [media, total] = await Promise.all([
            prisma.mediaLibrary.findMany({
                where,
                orderBy: { uploadedAt: "desc" },
                skip,
                take: limit,
                include: {
                    site: {
                        select: { name: true, slug: true, primaryColor: true },
                    },
                },
            }),
            prisma.mediaLibrary.count({ where }),
        ]);

        return NextResponse.json({
            data: media,
            pagination: {
                page: Math.floor(skip / limit) + 1,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching media:", error);
        return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
    }
}

// POST /api/media - Upload media (image or video)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const alt = formData.get("alt") as string | null;
        const siteId = formData.get("siteId") as string | null; // Optional: null = shared, otherwise site-specific

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        // CR-01: tulis media adalah jalur write — wajib gate lewat lib/site-access
        // (invariant CLAUDE.md), pola sama dengan GET/DELETE di file ini. Sebelumnya
        // siteId diterima mentah sehingga editor situs A bisa menulis ke situs mana pun.
        const isSuperAdmin = !!session.user?.isSuperAdmin;
        if (siteId) {
            if (!z.string().cuid().safeParse(siteId).success) {
                return NextResponse.json({ error: "Invalid siteId" }, { status: 400 });
            }
            if (!session.user?.id || !(await canEditOnSite(session.user.id, siteId))) {
                return NextResponse.json({ error: "No access to this site" }, { status: 403 });
            }
        } else if (!isSuperAdmin) {
            // Media bersama (siteId=null) hanya boleh dibuat SuperAdmin — selaras
            // dengan DELETE yang juga mensyaratkan SuperAdmin untuk menghapusnya.
            return NextResponse.json({ error: "Only SuperAdmin can upload shared media" }, { status: 403 });
        }

        // Determine file type
        const isImage = IMAGE_TYPES.includes(file.type);
        const isVideo = VIDEO_TYPES.includes(file.type);
        const isGif = file.type === "image/gif";
        // PDF: double validation per SPEC — accept only when the claimed MIME
        // AND the submitted filename extension both say PDF (never trust MIME alone).
        const isPdf = PDF_TYPES.includes(file.type) && file.name.toLowerCase().endsWith(".pdf");

        if (!isImage && !isVideo && !isPdf) {
            return NextResponse.json({
                error: `Format tidak didukung. Gunakan: ${IMAGE_TYPES.join(", ")}, ${VIDEO_TYPES.join(", ")}, ${PDF_TYPES.join(", ")}`
            }, { status: 400 });
        }

        // Check file size
        const maxSize = isPdf ? MAX_PDF_SIZE : (isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE);
        if (file.size > maxSize) {
            const maxMB = maxSize / (1024 * 1024);
            const typeLabel = isPdf ? 'PDF' : (isVideo ? 'video' : 'gambar');
            return NextResponse.json({
                error: `Ukuran file terlalu besar. Maksimal ${maxMB}MB untuk ${typeLabel}`
            }, { status: 400 });
        }

        // Determine folder
        const folder = isPdf ? "documents" : (isVideo ? "videos" : "images");
        const uploadDir = path.join(process.cwd(), "public", "uploads", folder);

        // Create directory if not exists
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let finalBuffer: Buffer;
        let filename: string;
        let finalMimeType: string;

        if (isPdf) {
            // PDF - raw buffer stored unmodified (sharp must not run for PDFs)
            filename = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
            finalBuffer = buffer;
            finalMimeType = "application/pdf";
        } else if (isVideo) {
            // Video - no compression (would need ffmpeg)
            filename = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
            finalBuffer = buffer;
            finalMimeType = file.type;
        } else if (isGif) {
            // GIF - preserve animation, no compression
            filename = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.gif`;
            finalBuffer = buffer;
            finalMimeType = file.type;
        } else {
            // Image - compress and convert to WebP
            filename = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`;
            finalMimeType = "image/webp";

            finalBuffer = await sharp(buffer)
                .resize(MAX_WIDTH, MAX_HEIGHT, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: QUALITY })
                .toBuffer();
        }

        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, finalBuffer);

        // Save to database (siteId: null = shared/global media; PDF alt falls
        // back to the submitted file name so the embed can show a friendly label)
        const media = await prisma.mediaLibrary.create({
            data: {
                filename,
                url: `/api/uploads/${folder}/${filename}`,
                mimeType: finalMimeType,
                size: finalBuffer.length,
                alt: isPdf ? (alt || file.name) : (alt || null),
                siteId: siteId || null, // null = shared, otherwise site-specific
            },
        });

        return NextResponse.json({
            ...media,
            originalSize: buffer.length,
            compressedSize: finalBuffer.length,
            savedPercent: Math.max(0, Math.round((1 - finalBuffer.length / buffer.length) * 100)),
        }, { status: 201 });
    } catch (error) {
        console.error("Error uploading media:", error);
        return NextResponse.json({ error: "Failed to upload media" }, { status: 500 });
    }
}

// DELETE /api/media - Delete media
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Media ID is required" }, { status: 400 });
        }

        // Authorization: site-specific media may only be deleted by users with access
        // to that site. Shared media (siteId=null) requires SuperAdmin.
        const media = await prisma.mediaLibrary.findUnique({
            where: { id },
            select: { siteId: true, mimeType: true, filename: true },
        });
        if (!media) {
            return NextResponse.json({ error: "Media not found" }, { status: 404 });
        }
        const isSuperAdmin = !!session.user?.isSuperAdmin;
        if (!isSuperAdmin) {
            if (!media.siteId) {
                return NextResponse.json({ error: "Only SuperAdmin can delete shared media" }, { status: 403 });
            }
            if (!session.user?.id || !(await canAccessSite(session.user.id, media.siteId))) {
                return NextResponse.json({ error: "No access to this site's media" }, { status: 403 });
            }
        }

        await prisma.mediaLibrary.delete({
            where: { id },
        });

        // WR-05: hapus juga file fisiknya — tanpa ini "terhapus" hanya di DB dan
        // berkas tetap terserve publik lewat /api/uploads selamanya. Best-effort:
        // kegagalan unlink tidak menggugurkan delete yang sudah berhasil.
        try {
            const folder = isVideoMime(media.mimeType) ? "videos" : (media.mimeType === "application/pdf" ? "documents" : "images");
            await unlink(path.join(process.cwd(), "public", "uploads", folder, media.filename));
        } catch (unlinkError) {
            console.error(`Orphan file left for media ${id}:`, unlinkError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting media:", error);
        return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
    }
}
