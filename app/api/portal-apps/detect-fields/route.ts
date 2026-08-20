import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectLoginFields } from "@/lib/portal-login-detect";
import { fetchLoginPage, FetchError } from "@/lib/portal-fetch-html";

// POST /api/portal-apps/detect-fields — SuperAdmin & ADMIN. Body { url }
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { isSuperAdmin?: boolean; role?: string } | undefined;
        if (!user || (!user.isSuperAdmin && user.role !== "ADMIN")) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const url = body?.url;
        if (typeof url !== "string" || url.length > 500) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        let parsed: URL;
        try {
            parsed = new URL(url.trim());
        } catch {
            return NextResponse.json({ error: "Format URL tidak valid" }, { status: 400 });
        }

        const { html, finalUrl, setCookies } = await fetchLoginPage(parsed.href);
        const redirected = finalUrl !== parsed.href;

        // Token antiforgery yang dipasangkan dengan cookie (ASP.NET MVC, Django, Rails)
        // tidak bisa diteruskan lewat SSO FORM: browser pengguna tidak punya cookie pasangannya.
        const cookiePaired = setCookies.some((c) =>
            /^(?:__RequestVerificationToken|csrftoken|_csrf|XSRF-TOKEN)/i.test(c.split("=")[0].trim())
        );

        const result = detectLoginFields(html);

        if (!result.passwordField) {
            // Gagal menemukan form. Tetap beri rekomendasi mode, jangan hanya menolak —
            // aplikasi seperti K2 (WS-Federation) memang tidak pernah menyajikan form
            // yang bisa di-POST langsung, jadi FORM bukan pilihan yang benar untuknya.
            const detail = redirected
                ? ` Halaman dialihkan ke ${finalUrl} — kemungkinan URL login kehilangan parameter query yang diperlukan (mis. ReturnUrl / wa / wtrealm). Salin URL login LENGKAP dari address bar browser.`
                : "";
            return NextResponse.json(
                {
                    error: `Tidak ditemukan form login (input password) di halaman tersebut.${detail}`,
                    finalUrl,
                    redirected,
                    recommendedMode: "VAULT",
                    recommendationReason: redirected
                        ? "Halaman login dialihkan ke alamat lain dan tidak menyajikan form yang bisa dikirim langsung. " +
                          "Ini pola khas SSO federasi (WS-Federation/SAML/OAuth). SSO Mode FORM tidak akan berhasil — gunakan VAULT."
                        : "Halaman tidak memuat form login yang bisa dikirim langsung. Gunakan SSO Mode VAULT agar portal " +
                          "menyimpan kredensial dan pengguna login sendiri di halaman aslinya.",
                },
                { status: 422 }
            );
        }

        const warnings = [...(result.warnings ?? [])];
        if (redirected) {
            warnings.push(`Halaman dialihkan ke ${finalUrl}. Pastikan LOGIN URL yang disimpan adalah URL akhir ini.`);
        }

        // Tentukan mode SSO yang tepat berdasarkan bukti dari halaman.
        let recommendedMode: "FORM" | "VAULT" = "FORM";
        let recommendationReason =
            "Halaman menyajikan form login biasa yang bisa dikirim langsung, jadi SSO Mode FORM sesuai.";

        if (cookiePaired) {
            recommendedMode = "VAULT";
            recommendationReason =
                "Halaman ini menerbitkan token antiforgery yang terikat cookie sesi. Token hanya sah bila dipakai " +
                "bersama cookie pasangannya, sedangkan browser pengguna tidak memilikinya saat portal mengirim form. " +
                "SSO Mode FORM akan selalu ditolak — gunakan VAULT.";
            warnings.push(
                "Aplikasi ini memakai token antiforgery yang terikat cookie sesi. SSO Mode FORM tidak akan berhasil " +
                    "karena browser pengguna tidak memiliki cookie pasangannya. Gunakan SSO Mode VAULT untuk aplikasi ini."
            );
        }

        return NextResponse.json({
            ...result,
            warnings,
            finalUrl,
            redirected,
            cookiePaired,
            recommendedMode,
            recommendationReason,
        });
    } catch (err) {
        if (err instanceof FetchError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        console.error("POST /api/portal-apps/detect-fields:", err);
        return NextResponse.json({ error: "Gagal mengambil halaman login" }, { status: 422 });
    }
}
