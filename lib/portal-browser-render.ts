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
            input.getAttribute("aria-labelledby"),
            input.getAttribute("placeholder"),
            input.getAttribute("title"),
            input.getAttribute("role"),
            input.getAttribute("data-testid"),
            input.getAttribute("data-test-id"),
            input.getAttribute("data-test"),
            input.getAttribute("data-qa"),
            input.getAttribute("data-cy"),
            input.labels ? Array.from(input.labels).map((label) => label.textContent || "").join(" ") : "",
        ]
            .filter(Boolean)
            .join(" ")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
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
        const type = (input.getAttribute("type") || input.type || "").toLowerCase();
        const hasLayout = typeof input.getClientRects === "function" && input.getClientRects().length > 0;
        const computedStyle = typeof getComputedStyle === "function" ? getComputedStyle(input) : null;
        if (
            !hasSemanticIdentity(input) ||
            type === "hidden" ||
            (typeof input.getClientRects === "function" && !hasLayout) ||
            computedStyle?.display === "none" ||
            computedStyle?.visibility === "hidden"
        ) {
            return false;
        }
        const autocomplete = (input.getAttribute("autocomplete") || input.autocomplete || "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const hint = [
            input.getAttribute("name"),
            input.id,
            input.getAttribute("aria-label"),
            input.getAttribute("aria-labelledby"),
            input.getAttribute("placeholder"),
            input.getAttribute("title"),
            input.getAttribute("role"),
            input.getAttribute("data-testid"),
            input.getAttribute("data-test-id"),
            input.getAttribute("data-test"),
            input.getAttribute("data-qa"),
            input.getAttribute("data-cy"),
            input.labels ? Array.from(input.labels).map((label) => label.textContent || "").join(" ") : "",
        ]
            .filter(Boolean)
            .join(" ")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .toLowerCase();

        return (
            type === "password" ||
            autocomplete.includes("current-password") ||
            ((type === "text" || type === "tel" || type === "number" || type === "") && /(?:password|passwd|passcode|kata[ _-]?sandi|\bpass\b|\bpwd\b|\bpin\b)/i.test(hint))
        );
    };

    const visit = (root, baseUrl, needsProjection) => {
        if (!root || visitedRoots.has(root)) return;
        visitedRoots.add(root);

        const inputs = root.querySelectorAll ? root.querySelectorAll("input, textarea, [contenteditable=\"true\"]") : [];
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
        const isTextarea = control.tagName.toLowerCase() === "textarea";
        const copy = isButton ? document.createElement("button") : isTextarea ? document.createElement("textarea") : document.createElement("input");
        const type = isButton ? "submit" : isTextarea ? "textarea" : (control.getAttribute("type") || control.type || "text").toLowerCase();
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
            "role",
            "data-testid",
            "data-test-id",
            "data-test",
            "data-qa",
            "data-cy",
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
            const controlHint = [
                control.getAttribute("aria-label"),
                control.getAttribute("placeholder"),
                control.getAttribute("title"),
                control.getAttribute("data-testid"),
                control.getAttribute("data-test-id"),
                control.getAttribute("data-test"),
                control.getAttribute("data-qa"),
                control.getAttribute("data-cy"),
            ].filter(Boolean).join(" ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
            const inferredName =
                type === "password" || autocomplete.includes("current-password") || autocomplete.includes("password") || /(?:password|passwd|pwd|passcode|sandi|kata[ _-]?sandi)/i.test(controlHint)
                    ? "password"
                    : autocomplete.includes("email") || type === "email" || /(?:email|e-mail)/i.test(controlHint)
                      ? "email"
                      : autocomplete.includes("username") || /(?:username|user[ _-]?id|login|account|identifier|nik|nip|nrp)/i.test(controlHint)
                        ? "username"
                        : null;
            if (inferredName) copy.setAttribute("name", inferredName);
        }

        if (isButton) {
            copy.setAttribute("type", control.getAttribute("type") || "submit");
            copy.setAttribute("value", control.getAttribute("value") || control.value || "");
            copy.textContent = control.textContent || "";
        } else if (isTextarea) {
            // Never copy a secret value; the text is only useful for the parser
            // when this is a non-password control.
            if (type !== "password") copy.textContent = control.value || "";
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
        form.setAttribute("method", nativeForm?.getAttribute("method") || "POST");
        const nativeAction = nativeForm?.getAttribute("action");
        if (nativeAction) form.setAttribute("action", nativeAction);

        const controls = [];
        const addControl = (control) => {
            if (!control || controls.includes(control)) return;
            const tag = control.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "button" || control.getAttribute?.("contenteditable") === "true") controls.push(control);
        };

        if (nativeForm?.elements) {
            for (const control of Array.from(nativeForm.elements)) addControl(control);
        }
        const root = candidate.input.getRootNode();
        if (root.querySelectorAll) {
            for (const control of Array.from(root.querySelectorAll("input, textarea, button, [contenteditable=\"true\"]"))) addControl(control);
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
            const responseUrl = res.headers.get("x-response-url")?.trim() || undefined;
            // Browserless deployments do not all expose x-response-url, but the
            // caller-provided hash route is still the browser's actual route.
            const finalUrl = responseUrl || (url.includes("#") ? url : undefined);
            return { html: html.slice(0, MAX_RENDERED_HTML_BYTES), finalUrl };
        } catch {
            // Timeout / layanan mati: percobaan lain tidak akan menolong.
            return null;
        }
    }

    return null;
}
