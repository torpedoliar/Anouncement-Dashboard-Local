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

        const { html, finalUrl, setCookies, redirected, loopDetected } = await fetchLoginPage(parsed.href);

        // Token antiforgery yang dipasangkan dengan cookie (ASP.NET MVC, Django, Rails).
        // SSO FORM tidak bisa menghandle ini (browser pengguna tidak punya cookie pasangannya),
        // tapi SSO POST bisa: portal mengambil token + cookie sendiri lewat relay server-side.
        const cookiePaired = setCookies.some((c) =>
            /^(?:__RequestVerificationToken|csrftoken|_csrf|XSRF-TOKEN)/i.test(c.split("=")[0].trim())
        );

        const result = detectLoginFields(html);

        if (!result.passwordField) {
            // Gagal menemukan form. Loop redirect turut dijelaskan agar admin paham
            // bahwa server hidup tapi URL yang diisi tidak mengarah ke formulir.
            const loopNote = loopDetected
                ? ` URL memantul dalam loop pengalihan (berakhir di ${finalUrl}) — server tampak hidup, tapi halaman tidak pernah berhenti dialihkan.`
                : "";
            const detail = !loopDetected && redirected
                ? ` Halaman dialihkan ke ${finalUrl} — kemungkinan URL login kehilangan parameter query yang diperlukan (mis. ReturnUrl / wa / wtrealm). Salin URL login LENGKAP dari address bar browser.`
                : "";
            return NextResponse.json(
                {
                    error: `Tidak ditemukan form login (input password) di halaman tersebut.${loopNote}${detail}`,
                    finalUrl,
                    redirected,
                    loopDetected: loopDetected ?? false,
                    recommendedMode: "VAULT",
                    recommendationReason: loopDetected
                        ? "Halaman login memantul dalam loop pengalihan dan tidak pernah menyajikan form. " +
                          "Gunakan SSO Mode VAULT, atau isi LOGIN URL dengan endpoint formulir yang lengkap (bukan host polos)."
                        : redirected
                          ? "Halaman login dialihkan ke alamat lain dan tidak menyajikan form yang bisa dikirim langsung. " +
                            "Ini pola khas SSO federasi (WS-Federation/SAML/OAuth). Gunakan SSO Mode VAULT."
                          : "Halaman tidak memuat form login yang bisa dikirim langsung. Gunakan SSO Mode VAULT agar portal " +
                            "menyimpan kredensial dan pengguna login sendiri di halaman aslinya.",
                },
                { status: 422 }
            );
        }

        const warnings = [...(result.warnings ?? [])];
        if (redirected && !loopDetected) {
            warnings.push(`Halaman dialihkan ke ${finalUrl}. Pastikan LOGIN URL yang disimpan adalah URL akhir ini.`);
        }

        // Tentukan mode SSO yang tepat berdasarkan bukti dari halaman.
        let recommendedMode: "FORM" | "VAULT" | "POST" = "FORM";
        let recommendationReason =
            "Halaman menyajikan form login biasa yang bisa dikirim langsung, jadi SSO Mode FORM sesuai.";

        if (cookiePaired) {
            recommendedMode = "POST";
            recommendationReason =
                "Halaman ini menerbitkan token antiforgery yang terikat cookie sesi. SSO Mode FORM akan selalu ditolak " +
                "karena browser pengguna tidak memiliki cookie pasangannya. SSO Mode POST memperbaiki ini: portal " +
                "mengambil token dan cookie sendiri di server, lalu mengirim kredensial, tanpa bergantung pada cookie browser.";
            warnings.push(
                "Aplikasi ini memakai token antiforgery yang terikat cookie sesi. SSO Mode FORM tidak akan berhasil " +
                    "karena browser pengguna tidak memiliki cookie pasangannya. SSO Mode POST lebih sesuai."
            );
        } else if (loopDetected) {
            recommendedMode = "FORM";
            recommendationReason =
                "Formulir login ditemukan meski URL sempat memantul. SSO Mode FORM dipakai dengan refresh token otomatis.";
        }

        return NextResponse.json({
            ...result,
            warnings,
            finalUrl,
            redirected,
            loopDetected: loopDetected ?? false,
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