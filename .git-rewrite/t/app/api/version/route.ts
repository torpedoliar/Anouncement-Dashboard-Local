import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// GET /api/version - Return local version info
export async function GET() {
    try {
        const versionPath = path.join(process.cwd(), "version.json");

        if (!fs.existsSync(versionPath)) {
            return NextResponse.json({
                version: "unknown",
                buildDate: null,
                schemaVersion: null,
                releaseNotes: null,
            });
        }

        const versionData = JSON.parse(fs.readFileSync(versionPath, "utf8"));

        return NextResponse.json(versionData);
    } catch (error) {
        console.error("Error reading version:", error);
        return NextResponse.json(
            { error: "Failed to read version" },
            { status: 500 }
        );
    }
}
