import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// GET /api/backup - Download database backup
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get current timestamp for filename
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `backup_${timestamp}.sql`;

        // Run pg_dump in Docker container
        const { stdout, stderr } = await execAsync(
            `docker exec announcement-dashboard-db-1 pg_dump -U postgres announcement_db`
        );

        if (stderr && !stderr.includes("warning")) {
            console.error("pg_dump error:", stderr);
            return NextResponse.json(
                { error: "Backup failed" },
                { status: 500 }
            );
        }

        // Return SQL file as download
        return new NextResponse(stdout, {
            status: 200,
            headers: {
                "Content-Type": "application/sql",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Backup error:", error);
        return NextResponse.json(
            { error: "Failed to create backup. Make sure Docker is running." },
            { status: 500 }
        );
    }
}
