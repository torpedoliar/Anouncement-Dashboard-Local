import { NextRequest, NextResponse } from "next/server";
import { setCurrentSite, clearCurrentSite } from "@/lib/site-context";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { siteId, siteSlug, action } = body;

        if (action === "clear") {
            await clearCurrentSite();
            return NextResponse.json({ success: true });
        }

        if (!siteId || !siteSlug) {
            return NextResponse.json({ error: "Missing siteId or siteSlug" }, { status: 400 });
        }

        await setCurrentSite(siteId, siteSlug);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error setting site context:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
