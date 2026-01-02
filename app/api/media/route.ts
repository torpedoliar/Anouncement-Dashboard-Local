import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

// GET /api/media - List media
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;

        const [media, total] = await Promise.all([
            prisma.mediaLibrary.findMany({
                orderBy: { uploadedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.mediaLibrary.count(),
        ]);

        return NextResponse.json({
            data: media,
            pagination: {
                page,
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

// POST /api/media - Upload media
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const alt = formData.get("alt") as string | null;

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
        }

        // Generate unique filename
        const ext = file.name.split(".").pop();
        const filename = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "media");
        const filepath = path.join(uploadDir, filename);

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        // Save to database
        const media = await prisma.mediaLibrary.create({
            data: {
                filename,
                url: `/uploads/media/${filename}`,
                mimeType: file.type,
                size: file.size,
                alt: alt || null,
            },
        });

        return NextResponse.json(media, { status: 201 });
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
