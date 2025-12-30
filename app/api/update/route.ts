import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// POST /api/update - Perform one-click update
export async function POST() {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if auto-update is enabled
        if (process.env.ENABLE_AUTO_UPDATE !== "true") {
            return NextResponse.json(
                { error: "Auto-update tidak diaktifkan. Set ENABLE_AUTO_UPDATE=true di docker-compose.yml" },
                { status: 403 }
            );
        }

        const steps: { step: string; status: string; output?: string }[] = [];

        // Step 1: Backup database
        try {
            steps.push({ step: "Backup database", status: "running" });
            const backupResult = await execAsync(
                'docker exec announcement-dashboard-db-1 pg_dump -U postgres announcement_db > /tmp/backup_before_update.sql',
                { timeout: 60000 }
            );
            steps[steps.length - 1] = { step: "Backup database", status: "success", output: "Backup created" };
        } catch (backupError) {
            steps[steps.length - 1] = { step: "Backup database", status: "warning", output: "Backup skipped (non-critical)" };
        }

        // Step 2: Git pull
        try {
            steps.push({ step: "Pulling latest code", status: "running" });
            const gitResult = await execAsync('cd /app/repo && git pull origin main', { timeout: 120000 });
            steps[steps.length - 1] = {
                step: "Pulling latest code",
                status: "success",
                output: gitResult.stdout.trim() || "Already up to date"
            };
        } catch (gitError: unknown) {
            const errorMessage = gitError instanceof Error ? gitError.message : "Unknown error";
            steps[steps.length - 1] = { step: "Pulling latest code", status: "error", output: errorMessage };
            return NextResponse.json({
                success: false,
                message: "Git pull failed",
                steps,
            }, { status: 500 });
        }

        // Step 3: Run Prisma migrations
        try {
            steps.push({ step: "Updating database schema", status: "running" });
            const prismaResult = await execAsync('npx prisma db push --accept-data-loss', { timeout: 120000 });
            steps[steps.length - 1] = { step: "Updating database schema", status: "success", output: "Schema updated" };
        } catch (prismaError: unknown) {
            const errorMessage = prismaError instanceof Error ? prismaError.message : "Unknown error";
            steps[steps.length - 1] = { step: "Updating database schema", status: "warning", output: "Migration skipped" };
        }

        // Step 4: Schedule container restart (async)
        steps.push({ step: "Restarting application", status: "scheduled" });

        // Return success before restart
        const response = NextResponse.json({
            success: true,
            message: "Update berhasil! Aplikasi akan restart dalam beberapa detik...",
            steps,
            requiresRestart: true,
        });

        // Schedule restart in background (after response is sent)
        setTimeout(async () => {
            try {
                // Restart the web container
                await execAsync('docker restart announcement-dashboard-web-1', { timeout: 60000 });
            } catch (restartError) {
                console.error("Container restart failed:", restartError);
            }
        }, 2000);

        return response;
    } catch (error) {
        console.error("Update error:", error);
        return NextResponse.json(
            { error: "Update failed", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// GET /api/update - Check update status
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({
            autoUpdateEnabled: process.env.ENABLE_AUTO_UPDATE === "true",
            message: process.env.ENABLE_AUTO_UPDATE === "true"
                ? "Auto-update diaktifkan"
                : "Auto-update tidak diaktifkan. Set ENABLE_AUTO_UPDATE=true di docker-compose.yml",
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
    }
}
