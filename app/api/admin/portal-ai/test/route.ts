import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { testAiConnection } from "@/lib/portal-llm-analyze";

// POST /api/admin/portal-ai/test — uji koneksi chat completions.
// Body opsional { baseUrl, model, apiKey } untuk menguji nilai form SEBELUM
// disimpan; kosong = pakai konfigurasi tersimpan. Auth: SuperAdmin only.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.isSuperAdmin) {
            return NextResponse.json({ error: "Forbidden: SuperAdmin only" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const override = {
            baseUrl: typeof body?.baseUrl === "string" ? body.baseUrl.trim() || undefined : undefined,
            model: typeof body?.model === "string" ? body.model.trim() || undefined : undefined,
            // apiKey kosong string = pakai key tersimpan; undefined = pakai tersimpan juga.
            apiKey: typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : undefined,
        };

        const result = await testAiConnection(override);
        return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    } catch (error) {
        console.error("POST /api/admin/portal-ai/test:", error);
        return NextResponse.json({ ok: false, error: "Gagal menguji koneksi AI" }, { status: 500 });
    }
}
