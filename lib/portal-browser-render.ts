export interface RenderResult {
    html: string;
    /** URL akhir yang dilaporkan Chromium setelah navigasi dan redirect. */
    finalUrl?: string;
}

const MAX_RENDERED_HTML_BYTES = 512 * 1024;
const MAX_LOGIN_FORM_WAIT_MS = 8_000;

/**
 * Fungsi ini dijalankan Browserless setelah navigasi. Selain menunggu field yang
 * benar-benar dapat dikirim, ia memproyeksikan kontrol dari open Shadow DOM dan
 * iframe same-origin ke HTML biasa. `page.content()` Browserless tidak selalu
 * menyertakan dua struktur tersebut, sehingga parser HTML server sebelumnya tidak
 * pernah melihat password yang sebenarnya sudah tampil di browser.
 *
 * Iframe lintas-origin sengaja tidak dipaksa: browser menolak akses DOM-nya dan
 * SSO berbasis form tidak dapat dijamin aman tanpa kontrak federasi yang eksplisit.
 */
const LOGIN_FORM_READY_FUNCTION = String.raw`() => {
    const snapshotId = "__portal_login_detector_snapshot__";
    const visitedRoots = new Set();
    const passwordCandidates = [];

    const hasSemanticIdentity = (input) => {
        const type = (input.getAttribute("type") || input.type || "").toLowerCase();
        const autocomplete = (input.getAttribute("autocomplete") || input.autocomplete || "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const hint = [
            input.getAttribute("name"),
            input.id,
            input.getAttribute("aria-label"),
            input.getAttribute("placeholder"),
            input.getAttribute("title"),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return (
            Boolean(input.getAttribute("name") || input.id) ||
            type === "password" ||
            autocomplete.includes("username") ||
            autocomplete.includes("email") ||
            autocomplete.includes("current-password") ||
            autocomplete.includes("password") ||
            /(?:username|user[ _-]?id|login|email|password|passwd|passcode|kata[ _-]?sandi|\bpass\b|\bpwd\b)/i.test(hint)
        );
    };

    const isPasswordCandidate = (input) => {
        if (!hasSemanticIdentity(input) || input.disabled || input.readOnly || input.getAttribute("aria-disabled") === "true") {
            return false;
        }

        const type = (input.getAttribute("type") || input.type || "").toLowerCase();
        const autocomplete = (input.getAttribute("autocomplete") || input.autocomplete || "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const hint = [
            input.getAttribute("name"),
            input.id,
            input.getAttribute("aria-label"),
            input.getAttribute("placeholder"),
            input.getAttribute("title"),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return (
            type === "password" ||
            autocomplete.includes("current-password") ||
            ((type === "text" || type === "") && /(?:password|passwd|passcode|kata[ _-]?sandi|\bpass\b|\bpwd\b|\bpin\b)/i.test(hint))
        );
    };

    const visit = (root, baseUrl, needsProjection) => {
        if (!root || visitedRoots.has(root)) return;
        visitedRoots.add(root);

        const inputs = root.querySelectorAll ? root.querySelectorAll("input") : [];
        for (const input of inputs) {
            if (isPasswordCandidate(input)) {
                passwordCandidates.push({
                    input,
                    baseUrl,
                    // Kontrol tanpa name/id perlu diproyeksikan ke snapshot dengan
                    // nama sintetis dari autocomplete/type agar parser server bisa
                    // menghasilkan kunci yang dapat diuji.
                    needsProjection: needsProjection || !input.getAttribute("name") && !input.id,
                });
            }
        }

        const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
        for (const element of elements) {
            if (element.shadowRoot) {
                visit(element.shadowRoot, baseUrl, true);
            }
            if (element.tagName === "IFRAME") {
                try {
                    const childDocument = element.contentDocument;
                    if (childDocument) {
                        const childUrl = childDocument.location?.href || baseUrl;
                        visit(childDocument, childUrl, true);
                    }
                } catch {
                    // Cross-origin iframe tidak dapat dibaca dari konteks halaman ini.
                }
            }
        }
    };

    visit(document, location.href, false);
    if (passwordCandidates.length === 0) return false;

    const candidatesNeedingProjection = passwordCandidates.filter((candidate) => candidate.needsProjection);
    if (candidatesNeedingProjection.length === 0) return true;

    document.getElementById(snapshotId)?.remove();
    const snapshot = document.createElement("div");
    snapshot.id = snapshotId;
    snapshot.hidden = true;
    snapshot.setAttribute("aria-hidden", "true");

    const copyControl = (control) => {
        const isButton = control.tagName.toLowerCase() === "button";
        const copy = document.createElement(isButton ? "button" : "input");
        const type = isButton ? "submit" : (control.getAttribute("type") || control.type || "text").toLowerCase();
        const autocomplete = (control.getAttribute("autocomplete") || control.autocomplete || "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const attributeNames = [
            "name",
            "id",
            "autocomplete",
            "placeholder",
            "aria-label",
            "aria-labelledby",
            "title",
            "formaction",
        ];

        for (const attributeName of attributeNames) {
            const value = control.getAttribute(attributeName);
            if (value !== null) copy.setAttribute(attributeName, value);
        }

        // React/Vue controlled inputs frequently omit name/id. Infer stable keys
        // from HTML autocomplete semantics so detectLoginFields can consume the
        // rendered snapshot without pretending the original DOM had those attrs.
        if (!isButton && !control.getAttribute("name") && !control.id) {
            const inferredName =
                type === "password" || autocomplete.includes("current-password") || autocomplete.includes("password")
                    ? "password"
                    : autocomplete.includes("email") || type === "email"
                      ? "email"
                      : autocomplete.includes("username")
                        ? "username"
                        : null;
            if (inferredName) copy.setAttribute("name", inferredName);
        }

        if (isButton) {
            copy.setAttribute("type", control.getAttribute("type") || "submit");
            copy.setAttribute("value", control.getAttribute("value") || control.value || "");
            copy.textContent = control.textContent || "";
        } else {
            copy.setAttribute("type", type);
            // Nilai field password TIDAK pernah disalin: snapshot ini dikirim ke server
            // portal, dan deteksi hanya butuh nama field, bukan isinya.
            if (type !== "password") {
                copy.setAttribute("value", control.value || control.getAttribute("value") || "");
            }
        }

        if (control.disabled || control.getAttribute("aria-disabled") === "true") copy.setAttribute("disabled", "");
        if (control.readOnly || control.getAttribute("aria-readonly") === "true") copy.setAttribute("readonly", "");

        if (!copy.getAttribute("aria-label") && control.labels?.length) {
            const labelText = Array.from(control.labels)
                .map((label) => label.textContent?.trim())
                .filter(Boolean)
                .join(" ")
                .slice(0, 300);
            if (labelText) copy.setAttribute("aria-label", labelText);
        }

        return copy;
    };

    const projectedSources = new Set();
    for (const candidate of candidatesNeedingProjection) {
        const nativeForm = candidate.input.form;
        const source = nativeForm || candidate.input.getRootNode();
        if (projectedSources.has(source)) continue;
        projectedSources.add(source);

        const form = document.createElement("form");
        form.setAttribute("method", nativeForm?.method || "POST");
        form.setAttribute("action", nativeForm?.action || candidate.baseUrl || location.href);

        const controls = [];
        const addControl = (control) => {
            if (!control || controls.includes(control)) return;
            const tag = control.tagName?.toLowerCase();
            if (tag === "input" || tag === "button") controls.push(control);
        };

        if (nativeForm?.elements) {
            for (const control of Array.from(nativeForm.elements)) addControl(control);
        }
        const root = candidate.input.getRootNode();
        if (root.querySelectorAll) {
            for (const control of Array.from(root.querySelectorAll("input, button"))) addControl(control);
        }
        addControl(candidate.input);

        for (const control of controls) form.append(copyControl(control));
        snapshot.append(form);
    }

    (document.body || document.documentElement).append(snapshot);
    return true;
}`;

/**
 * Kontrak /content berbeda antar generasi Browserless: v2 memakai
 * `waitForFunction` + `bestAttempt`, sedangkan v1 (`browserless/chrome`) memakai
 * satu properti `waitFor`. Payload dicoba berurutan supaya deployment yang masih
 * memakai image lama tetap mendapat penungguan form, dan payload minimal menjadi
 * jaring terakhir agar hasilnya tidak pernah lebih buruk dari perilaku sebelumnya.
 */
function renderAttempts(url: string, formWaitMs: number): Array<Record<string, unknown>> {
    const gotoOptions = { waitUntil: "domcontentloaded", timeout: formWaitMs };
    return [
        {
            url,
            gotoOptions,
            waitForFunction: { fn: LOGIN_FORM_READY_FUNCTION, timeout: formWaitMs },
            // Form bisa memang tidak tersedia (MFA/CAPTCHA/federasi). Dalam kasus itu,
            // kembalikan DOM terakhir alih-alih menganggap renderer mati.
            bestAttempt: true,
        },
        { url, gotoOptions, waitFor: LOGIN_FORM_READY_FUNCTION },
        { url },
    ];
}

/**
 * Render halaman login dengan browser sungguhan (container Chromium terpisah).
 *
 * Browserless menunggu field autentikasi yang dapat dikirim, bukan sekadar event
 * `load`; ini mencakup SPA React/Angular/Vue yang menambahkan form setelah bundle
 * JavaScript dan permintaan API selesai. Halaman yang tetap tidak menyajikan form
 * dikembalikan apa adanya, sehingga pemanggil bisa menjelaskan alasannya alih-alih
 * menyamarkannya sebagai layanan mati.
 */
export async function renderLoginPage(url: string, timeoutMs = 10_000): Promise<RenderResult | null> {
    const endpoint = process.env.PORTAL_BROWSER_URL?.trim();
    if (!endpoint) return null;

    // Sisakan waktu untuk Browserless mengirim respons sebelum AbortSignal portal aktif.
    const formWaitMs = Math.max(1_000, Math.min(MAX_LOGIN_FORM_WAIT_MS, timeoutMs - 1_500));
    const deadline = Date.now() + timeoutMs;

    for (const body of renderAttempts(url, formWaitMs)) {
        const remainingMs = deadline - Date.now();
        // Percobaan berikutnya hanya berguna bila masih ada waktu bermakna.
        if (remainingMs < 1_200) break;

        try {
            const res = await fetch(`${endpoint}/content`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(remainingMs),
            });
            // Kontrak tidak dikenali atau tunggu form gagal → coba bentuk payload berikutnya.
            if (!res.ok) continue;

            const html = await res.text();
            const finalUrl = res.headers.get("x-response-url")?.trim() || undefined;
            return { html: html.slice(0, MAX_RENDERED_HTML_BYTES), finalUrl };
        } catch {
            // Timeout / layanan mati: percobaan lain tidak akan menolong.
            return null;
        }
    }

    return null;
}
