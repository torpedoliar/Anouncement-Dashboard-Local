import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (original size before compression)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Compression settings
const MAX_WIDTH = 1920;  // Max width for images
const MAX_HEIGHT = 1080; // Max height for images
const QUALITY = 80;      // WebP quality (0-100)

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const skipCompression = formData.get("skipCompression") === "true";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 10MB." },
                { status: 400 }
            );
        }

        // Ensure upload directory exists
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let finalBuffer: Buffer;
        let filename: string;

        if (skipCompression || file.type === "image/gif") {
            // Skip compression for GIFs (to preserve animation) or if explicitly requested
            const ext = file.name.split(".").pop();
            filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            finalBuffer = buffer;
        } else {
            // Compress and convert to WebP
            filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

            finalBuffer = await sharp(buffer)
                .resize(MAX_WIDTH, MAX_HEIGHT, {
                    fit: 'inside',           // Maintain aspect ratio, fit within bounds
                    withoutEnlargement: true // Don't upscale small images
                })
                .webp({ quality: QUALITY })
                .toBuffer();
        }

        const filepath = join(UPLOAD_DIR, filename);
        await writeFile(filepath, finalBuffer);

        // Calculate compression ratio
        const originalSize = buffer.length;
        const compressedSize = finalBuffer.length;
        const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);

        // Use API route for serving files (works in Docker standalone mode)
        const url = `/api/uploads/${filename}`;

        return NextResponse.json({
            url,
            filename,
            originalSize,
            compressedSize,
            savedPercent: savedPercent > 0 ? savedPercent : 0,
        });
    } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}
