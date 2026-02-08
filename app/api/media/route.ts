import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validatePagination } from '@/lib/pagination-utils';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";

// File type configurations
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_TYPES = ["video/mp4"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (before compression)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

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
        const siteId = searchParams.get("siteId"); // Optional: filter by site
        const sharedOnly = searchParams.get("sharedOnly") === "true"; // Only show shared media
        // skip calculated by validatePagination

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};

        // Type filter
        if (type) {
            where.mimeType = type === "video"
                ? { startsWith: "video/" }
                : { startsWith: "image/" };
        }

        // Site filter (hybrid mode)
        if (sharedOnly) {
            // Only shared/global media
            where.siteId = null;
        } else if (siteId) {
            // Site-specific + shared media
            where.OR = [
                { siteId: siteId },
                { siteId: null },
            ];
        }
        // If no siteId filter, show all media (for SuperAdmin)

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

        // Determine file type
        const isImage = IMAGE_TYPES.includes(file.type);
        const isVideo = VIDEO_TYPES.includes(file.type);
        const isGif = file.type === "image/gif";

        if (!isImage && !isVideo) {
            return NextResponse.json({
                error: `Format tidak didukung. Gunakan: ${IMAGE_TYPES.join(", ")}, ${VIDEO_TYPES.join(", ")}`
            }, { status: 400 });
        }

        // Check file size
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > maxSize) {
            const maxMB = maxSize / (1024 * 1024);
            return NextResponse.json({
                error: `Ukuran file terlalu besar. Maksimal ${maxMB}MB untuk ${isVideo ? 'video' : 'gambar'}`
            }, { status: 400 });
        }

        // Determine folder
        const folder = isVideo ? "videos" : "images";
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

        if (isVideo) {
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

        // Save to database (siteId: null = shared/global media)
        const media = await prisma.mediaLibrary.create({
            data: {
                filename,
                url: `/api/uploads/${folder}/${filename}`,
                mimeType: finalMimeType,
                size: finalBuffer.length,
                alt: alt || null,
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

        await prisma.mediaLibrary.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting media:", error);
        return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
    }
}
