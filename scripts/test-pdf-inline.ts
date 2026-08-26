/**
 * Self-check harness for Phase 12 plan 12-01 — the PDF-inline data path.
 *
 * Proves the sanitize + serve contract WITHOUT a DB, dev server, or network:
 *   1. sanitizeHTML keeps the TipTap PDF placeholder (a div carrying the three
 *      marker data attributes) while leaving the XSS surface unchanged.
 *   2. The uploads route still maps .pdf -> application/pdf under the intact
 *      path-traversal guard.
 *
 * Run:  npx tsx scripts/test-pdf-inline.ts
 * Exit: 0 = contract holds; non-zero = a FAIL line printed, first failure thrown.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sanitizeHTML } from "../lib/validation-schemas";

const ROUTE_FILE = fileURLToPath(
    new URL("../app/api/uploads/[...path]/route.ts", import.meta.url),
);

function check(label: string, cond: boolean): void {
    if (!cond) {
        console.error(`PDF-INLINE FAIL: ${label}`);
        throw new Error(label);
    }
    console.log(`pdf-inline ok: ${label}`);
}

// --- Sanitize half: the placeholder block must survive on-write sanitization ---

function testPlaceholderSurvives(): void {
    const abs =
        '<div data-pdf data-src="https://cdn.example.com/a.pdf" data-filename="a.pdf"></div>';
    const absOut = sanitizeHTML(abs);
    check(
        "absolute https src keeps all three data attrs",
        absOut.includes("data-pdf") &&
            absOut.includes('data-src="https://cdn.example.com/a.pdf"') &&
            absOut.includes('data-filename="a.pdf"'),
    );

    const rel =
        '<div data-pdf data-src="/api/uploads/documents/x.pdf" data-filename="x.pdf"></div>';
    const relOut = sanitizeHTML(rel);
    check(
        "relative uploads src keeps all three data attrs",
        relOut.includes("data-pdf") &&
            relOut.includes('data-src="/api/uploads/documents/x.pdf"') &&
            relOut.includes('data-filename="x.pdf"'),
    );
}

// --- Sanitize half: XSS payloads must still be fully stripped ---

function testPayloadsStripped(): void {
    const imgOnError = '<img src="x" onerror="alert(1)">';
    const imgOut = sanitizeHTML(imgOnError);
    check("img onerror handler stripped", !imgOut.includes("onerror"));

    const objectPay = '<object data="javascript:alert(1)"></object>';
    const objOut = sanitizeHTML(objectPay);
    check(
        "object element removed entirely",
        !objOut.includes("<object") && !objOut.includes("javascript:"),
    );

    const videoPay = '<video data="javascript:alert(1)"></video>';
    const vidOut = sanitizeHTML(videoPay);
    check(
        "video kept but bare data attr with script URI stripped",
        vidOut.includes("<video") && !vidOut.includes("javascript:"),
    );
}

// --- Sanitize half: Video/YouTube parse markers must survive the round-trip
// (WR-06: tanpa whitelist, save→reload menghancurkan embed sah) ---

function testVideoYoutubeMarkersSurvive(): void {
    const video =
        '<div data-video data-filename="v.mp4"><video src="/api/uploads/videos/v.mp4" controls></video></div>';
    const videoOut = sanitizeHTML(video);
    check(
        "data-video marker + controls survive sanitization",
        videoOut.includes("data-video") &&
            videoOut.includes('src="/api/uploads/videos/v.mp4"') &&
            videoOut.includes("controls"),
    );

    const yt =
        '<div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe></div>';
    const ytOut = sanitizeHTML(yt);
    check(
        "data-youtube-video marker survives sanitization",
        ytOut.includes("data-youtube-video") &&
            ytOut.includes("youtube.com/embed/dQw4w9WgXcQ"),
    );
}

// --- Sanitize half: data-src must be constrained to PDF URLs at the server
// trust boundary (WR-02: editor check alone is not enough) ---

function testPdfSrcConstrained(): void {
    // Sah: path upload relatif dan URL absolut .pdf tetap utuh.
    const ok = sanitizeHTML(
        '<div data-pdf data-src="https://cdn.example.com/a.pdf" data-filename="a.pdf"></div>',
    );
    check("valid absolute .pdf src survives constraint", ok.includes('data-src="https://cdn.example.com/a.pdf"'));

    const okRel = sanitizeHTML('<div data-pdf data-src="/api/uploads/documents/x.pdf"></div>');
    check("valid relative uploads .pdf src survives constraint", okRel.includes('data-src="/api/uploads/documents/x.pdf"'));

    // Terlarang: halaman HTML eksternal menyamar sebagai sumber PDF.
    const evil = sanitizeHTML('<div data-pdf data-src="https://evil.com/phish"></div>');
    check(
        "non-PDF https src stripped from placeholder",
        !evil.includes("evil.com"),
    );

    // Terlarang: scheme berbahaya tetap (dan kini juga) hilang.
    const js = sanitizeHTML('<div data-pdf data-src="javascript:alert(1)"></div>');
    check("javascript: data-src stripped", !js.includes("javascript:"));
}

// --- Sanitize half: the default URI regex must still strip javascript:/data: ---
function testDangerousUriStripped(): void {
    const payloads: Array<[string, string]> = [
        ['data-src="javascript:alert(1)"', "javascript:"],
        [
            'data-src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="',
            "data:text/html",
        ],
    ];
    for (const [attr, needle] of payloads) {
        const out = sanitizeHTML(`<div data-pdf ${attr}></div>`);
        check(
            `dangerous data-src URI stripped (${needle})`,
            !out.includes(needle),
        );
    }
}

// --- Serve half (static): the uploads route must map pdf and keep the guard ---

function testServeContract(): void {
    const src = readFileSync(ROUTE_FILE, "utf8");
    check(
        "uploads MIME_TYPES maps pdf to application/pdf",
        /"pdf"\s*:\s*"application\/pdf"/.test(src),
    );
    check(
        "traversal segment guard still present",
        src.includes('seg === ".."') &&
            src.includes('seg === "."') &&
            src.includes('includes("\\0")'),
    );
    check(
        "resolve + separator prefix check intact",
        src.includes("UPLOAD_DIR + sep"),
    );
    check(
        "octet-stream fallback kept",
        src.includes('"application/octet-stream"'),
    );
}

function main(): void {
    console.log("pdf-inline harness: sanitize half");
    testPlaceholderSurvives();
    testPayloadsStripped();
    testVideoYoutubeMarkersSurvive();
    testPdfSrcConstrained();
    testDangerousUriStripped();
    console.log("pdf-inline harness: serve half (static)");
    testServeContract();
    console.log("PDF-INLINE SANITIZE/SERVE OK");
}

main();
