import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { resolve, sep } from "path";
import { Readable } from "stream";

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
    "m4v": "video/mp4",
    // Documents
    "pdf": "application/pdf",
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;

        // IN-02: GET /api/uploads/ tanpa segmen lolos guard di bawah lalu readFile(dir)
        // melempar EISDIR → 500. Tolak eksplisit sebagai request yang salah.
        if (!path || path.length === 0) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

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
            console.debug(`File not found: ${filepath}`);
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const fileStat = await stat(filepath);
        if (fileStat.isDirectory()) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 });
        }

        const filename = path[path.length - 1];
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";
        const fileSize = fileStat.size;

        const rangeHeader = request.headers.get("range");

        // Dukung HTTP 206 Partial Content untuk media player / video streaming HTML5
        if (rangeHeader) {
            const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
            if (!match) {
                return new NextResponse(null, {
                    status: 416,
                    headers: {
                        "Content-Range": `bytes */${fileSize}`,
                    },
                });
            }

            let start = match[1] ? parseInt(match[1], 10) : NaN;
            let end = match[2] ? parseInt(match[2], 10) : NaN;

            if (isNaN(start) && isNaN(end)) {
                return new NextResponse(null, {
                    status: 416,
                    headers: {
                        "Content-Range": `bytes */${fileSize}`,
                    },
                });
            }

            if (isNaN(start)) {
                // Suffix byte range: e.g. bytes=-500 (500 byte terakhir)
                start = Math.max(0, fileSize - end);
                end = fileSize - 1;
            } else if (isNaN(end)) {
                // Open-ended byte range: e.g. bytes=500- (dari 500 sampai akhir)
                end = fileSize - 1;
            }

            if (start >= fileSize || end >= fileSize || start > end) {
                return new NextResponse(null, {
                    status: 416,
                    headers: {
                        "Content-Range": `bytes */${fileSize}`,
                    },
                });
            }

            const contentLength = end - start + 1;
            const nodeStream = createReadStream(filepath, { start, end });
            const webStream = Readable.toWeb(nodeStream) as ReadableStream;

            return new NextResponse(webStream, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": contentLength.toString(),
                    "Content-Type": mimeType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Content-Type-Options": "nosniff",
                },
            });
        }

        // Request biasa (tanpa Range) dialirkan langsung via stream
        const nodeStream = createReadStream(filepath);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new NextResponse(webStream, {
            status: 200,
            headers: {
                "Content-Length": fileSize.toString(),
                "Content-Type": mimeType,
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
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

export async function HEAD(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params;
        if (!path || path.length === 0) {
            return new NextResponse(null, { status: 400 });
        }
        if (path.some((seg) => seg === ".." || seg === "." || seg.includes("\0"))) {
            return new NextResponse(null, { status: 400 });
        }
        const filepath = resolve(UPLOAD_DIR, ...path);
        if (filepath !== UPLOAD_DIR && !filepath.startsWith(UPLOAD_DIR + sep)) {
            return new NextResponse(null, { status: 400 });
        }
        if (!existsSync(filepath)) {
            return new NextResponse(null, { status: 404 });
        }
        const fileStat = await stat(filepath);
        if (fileStat.isDirectory()) {
            return new NextResponse(null, { status: 400 });
        }
        const filename = path[path.length - 1];
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";

        return new NextResponse(null, {
            status: 200,
            headers: {
                "Content-Length": fileStat.size.toString(),
                "Content-Type": mimeType,
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return new NextResponse(null, { status: 500 });
    }
}
