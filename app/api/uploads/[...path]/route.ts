import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = resolve(process.cwd(), "public", "uploads");

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

        // Reject any segment that could escape the upload dir before touching the FS.
        if (path.some((seg) => seg === ".." || seg === "." || seg.includes("\0"))) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        // Resolve to an absolute path and verify it stays within UPLOAD_DIR.
        // Using path.resolve + a separator-bounded prefix check defeats traversal
        // (e.g. "..", encoded segments) on both POSIX and Windows.
        const filepath = resolve(UPLOAD_DIR, ...path);
        if (filepath !== UPLOAD_DIR && !filepath.startsWith(UPLOAD_DIR + sep)) {
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
