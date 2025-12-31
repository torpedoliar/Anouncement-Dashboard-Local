import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// GET /api/version - Return the current app version from version.json
export async function GET() {
    try {
        // Read version from version.json file
        const versionPath = join(process.cwd(), "version.json");
        const versionData = readFileSync(versionPath, "utf-8");
        const version = JSON.parse(versionData);

        return NextResponse.json({
            version: version.version,
            buildDate: version.buildDate,
            schemaVersion: version.schemaVersion,
            releaseNotes: version.releaseNotes,
            repository: version.repository,
        });
    } catch (error) {
        console.error("Version API error:", error);
        // Fallback if version.json is not found
        return NextResponse.json({
            version: "1.0.0",
            buildDate: "unknown",
            schemaVersion: "1",
            releaseNotes: "Version file not found",
        });
    }
}
