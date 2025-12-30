import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/torpedoliar/Anouncement-Dashboard-Local/main/version.json";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface VersionInfo {
    version: string;
    buildDate: string;
    schemaVersion: string;
    releaseNotes: string;
}

interface CheckResult {
    hasUpdate: boolean;
    hasSchemaUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    currentSchemaVersion: string;
    latestSchemaVersion: string;
    releaseNotes: string;
    lastChecked: string;
    error?: string;
}

// Simple in-memory cache
let cachedResult: CheckResult | null = null;
let lastCheckTime: number = 0;

// GET /api/version/check - Compare local vs GitHub version
export async function GET() {
    try {
        const now = Date.now();

        // Return cached result if still valid
        if (cachedResult && (now - lastCheckTime) < CACHE_DURATION) {
            return NextResponse.json(cachedResult);
        }

        // Read local version
        const versionPath = path.join(process.cwd(), "version.json");
        let localVersion: VersionInfo = {
            version: "1.0.0",
            buildDate: "",
            schemaVersion: "1",
            releaseNotes: "",
        };

        if (fs.existsSync(versionPath)) {
            localVersion = JSON.parse(fs.readFileSync(versionPath, "utf8"));
        }

        // Fetch GitHub version
        let remoteVersion: VersionInfo;
        try {
            const response = await fetch(GITHUB_RAW_URL, {
                cache: "no-store",
                headers: {
                    "Accept": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`GitHub returned ${response.status}`);
            }

            remoteVersion = await response.json();
        } catch (fetchError) {
            console.error("Failed to fetch GitHub version:", fetchError);
            const result: CheckResult = {
                hasUpdate: false,
                hasSchemaUpdate: false,
                currentVersion: localVersion.version,
                latestVersion: localVersion.version,
                currentSchemaVersion: localVersion.schemaVersion,
                latestSchemaVersion: localVersion.schemaVersion,
                releaseNotes: "",
                lastChecked: new Date().toISOString(),
                error: "Tidak dapat terhubung ke GitHub",
            };
            return NextResponse.json(result);
        }

        // Compare versions
        const hasUpdate = compareVersions(remoteVersion.version, localVersion.version) > 0;
        const hasSchemaUpdate = parseInt(remoteVersion.schemaVersion || "1") > parseInt(localVersion.schemaVersion || "1");

        const result: CheckResult = {
            hasUpdate,
            hasSchemaUpdate,
            currentVersion: localVersion.version,
            latestVersion: remoteVersion.version,
            currentSchemaVersion: localVersion.schemaVersion || "1",
            latestSchemaVersion: remoteVersion.schemaVersion || "1",
            releaseNotes: remoteVersion.releaseNotes || "",
            lastChecked: new Date().toISOString(),
        };

        // Cache the result
        cachedResult = result;
        lastCheckTime = now;

        return NextResponse.json(result);
    } catch (error) {
        console.error("Version check error:", error);
        return NextResponse.json(
            { error: "Failed to check version" },
            { status: 500 }
        );
    }
}

// Compare semver versions: returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a: string, b: string): number {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}
