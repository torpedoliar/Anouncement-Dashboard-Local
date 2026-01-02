import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

const MIME_TYPES: Record<string, string> = {
    // Images
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    // Videos
    "mp4": "video/mp4",
    "webm": "video/webm",
    "ogg": "video/ogg",
    "mov": "video/quicktime",
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;

        // Join path segments to construct file path
        // e.g., ["videos", "video_123.mp4"] -> "videos/video_123.mp4"
        const relativePath = path.join("/");
        const filepath = join(UPLOAD_DIR, ...path);

        // Security check: prevent directory traversal
        const normalizedPath = filepath.replace(/\\/g, "/");
        const normalizedUploadDir = UPLOAD_DIR.replace(/\\/g, "/");
        if (!normalizedPath.startsWith(normalizedUploadDir)) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        // Check if file exists
        if (!existsSync(filepath)) {
            console.error(`File not found: ${filepath}`);
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Read file
        const fileBuffer = await readFile(filepath);

        // Get file extension and mime type
        const filename = path[path.length - 1];
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";

        // Return file with appropriate headers
        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Accept-Ranges": "bytes",
            },
        });
    } catch (error) {
        console.error("Error serving uploaded file:", error);
        return NextResponse.json(
            { error: "Failed to serve file" },
            { status: 500 }
        );
    }
}
