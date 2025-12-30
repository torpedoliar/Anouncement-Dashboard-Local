import { NextResponse } from "next/server";

// GET /api/version - Return the current app version
// This is hardcoded so it works in Docker standalone mode
export async function GET() {
    try {
        // Return current version (hardcoded for Docker compatibility)
        return NextResponse.json({
            version: "1.0.0",
            buildDate: "2025-12-29",
            schemaVersion: "1",
            releaseNotes: "Initial release",
        });
    } catch (error) {
        console.error("Version API error:", error);
        return NextResponse.json(
            { error: "Failed to get version" },
            { status: 500 }
        );
    }
}
