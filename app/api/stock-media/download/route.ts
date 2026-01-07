import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import prisma from "@/lib/prisma";

// POST /api/stock-media/download - Download stock media and save locally
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { url, type, photographer, alt } = body;

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Download the file
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Failed to download file");
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Determine folder and filename
        const isVideo = type === "video";
        const folder = isVideo ? "videos" : "images";
        const uploadDir = path.join(process.cwd(), "public", "uploads", folder);

        // Create directory if not exists
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        let finalBuffer: Buffer;
        let filename: string;
        let mimeType: string;

        if (isVideo) {
            // Video - save as is
            filename = `stock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
            finalBuffer = buffer;
            mimeType = "video/mp4";
        } else {
            // Image - compress and convert to WebP
            filename = `stock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`;
            mimeType = "image/webp";

            finalBuffer = await sharp(buffer)
                .resize(1920, 1080, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality: 80 })
                .toBuffer();
        }

        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, finalBuffer);

        // Save to database
        const media = await prisma.mediaLibrary.create({
            data: {
                filename,
                url: `/api/uploads/${folder}/${filename}`,
                mimeType,
                size: finalBuffer.length,
                alt: alt || `Stock ${type} by ${photographer}`,
            },
        });

        return NextResponse.json({
            success: true,
            url: media.url,
            id: media.id,
            filename: media.filename,
        }, { status: 201 });
    } catch (error) {
        console.error("Error downloading stock media:", error);
        return NextResponse.json({ error: "Failed to download media" }, { status: 500 });
    }
}
