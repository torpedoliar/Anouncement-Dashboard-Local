import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type TextNode = DefaultTreeAdapterMap["textNode"];

export interface DetectedFields {
    usernameField: string | null;
    passwordField: string | null;
    httpMethod?: string;
    formAction?: string | null;
    extraFields: Record<string, string>;
    confidence?: number;
    /** Peringatan konfigurasi yang ditemukan saat deteksi (bukan error fatal). */
    warnings?: string[];
}

interface FieldInfo {
    name: string | null;
    id: string | null;
    type: string;
    autocomplete: string | null;
    placeholder: string | null;
    ariaLabel: string | null;
    title: string | null;
    labelText: string | null;
    value: string;
    isDisabled: boolean;
    isReadOnly: boolean;
    formIndex: number;
    formMethod: string | null;
    formAction: string | null;
}

function isElement(n: Node): n is Element {
    if (!n) return false;
    if (n.nodeName === "#text" || n.nodeName === "#comment" || n.nodeName === "#documentType") return false;
    return "tagName" in n;
}

function isTextNode(n: Node): n is TextNode {
    return n && n.nodeName === "#text" && "value" in n;
}

function extractText(node: Node): string {
    if (isTextNode(node)) return node.value || "";
    if (!isElement(node)) return "";
    let text = "";
    for (const child of node.childNodes || []) {
        text += extractText(child) + " ";
    }
    return text.trim();
}

function elementName(el: Element): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === "name")?.value ?? null;
}

function elementAttr(el: Element, attr: string): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === attr.toLowerCase())?.value ?? null;
}

function hasAttr(el: Element, attr: string): boolean {
    return el.attrs.some((a) => a.name.toLowerCase() === attr.toLowerCase());
}

function firstAutocompleteWord(raw: string | null): string | null {
    if (!raw) return null;
    return raw.toLowerCase().split(/\s+/)[0] ?? null;
}

/** Semua <input> di dalam sebuah elemen (untuk label yang membungkus inputnya). */
function descendantInputs(node: Node): Element[] {
    const out: Element[] = [];
    const walk = (n: Node) => {
        if (isElement(n) && n.tagName.toLowerCase() === "input") out.push(n);
        if ("childNodes" in n && Array.isArray(n.childNodes)) n.childNodes.forEach(walk);
    };
    walk(node);
    return out;
}

/**
 * Ekstrak nama kontrol terminal (mis. "txtNikHris" dari "ctl00$ContentPlaceHolder1$txtNikHris"
 * atau "ctl00_ContentPlaceHolder1_txtPassword")
 */
function getTerminalControlName(identifier: string | null): string {
    if (!identifier) return "";
    const parts = identifier.split(/[$_.:]/);
    return parts[parts.length - 1] || identifier;
}

/**
 * Nama kontrol tanpa prefix framework, TAPI mempertahankan underscore internal.
 * getTerminalControlName memecah di "_" sehingga "user_id" jadi "id" dan kata kuncinya
 * hilang. Ini hanya membuang prefix ASP.NET ("ctl00$Panel$user_id" -> "user_id").
 */
function getControlNameKeepUnderscore(identifier: string | null): string {
    if (!identifier) return "";
    const parts = identifier.split(/[$.:]/);
    return parts[parts.length - 1] || identifier;
}

/**
 * Heuristik deteksi username / identity field
 */
function scoreUsername(f: FieldInfo): number {
    if (f.isDisabled || f.isReadOnly) return -500;
    if (f.type === "password" || f.type === "hidden" || f.type === "submit" || f.type === "button" || f.type === "checkbox" || f.type === "radio") {
        return -500;
    }

    const rawName = (f.name ?? "").toLowerCase();
    const rawId = (f.id ?? "").toLowerCase();
    // Dua bentuk: segmen terakhir (buang prefix ASP.NET) dan versi yang mempertahankan
    // underscore, supaya "user_id" tidak menyusut jadi "id".
    const terminalName = `${getTerminalControlName(f.name)} ${getControlNameKeepUnderscore(f.name)}`.toLowerCase();
    const terminalId = `${getTerminalControlName(f.id)} ${getControlNameKeepUnderscore(f.id)}`.toLowerCase();

    const placeholder = (f.placeholder ?? "").toLowerCase();
    const aria = (f.ariaLabel ?? "").toLowerCase();
    const title = (f.title ?? "").toLowerCase();
    const label = (f.labelText ?? "").toLowerCase();
    const value = (f.value ?? "").toLowerCase();

    const fullHaystack = `${rawName} ${rawId} ${terminalName} ${terminalId} ${placeholder} ${aria} ${title} ${label} ${value}`.toLowerCase();

    // 1. Filter out search / query / captcha / OTP boxes
    if (/\b(?:search|cari|filter|query|keyword|find|pencarian|q)\b/i.test(fullHaystack) || /^q$/i.test(rawName)) {
        return -500;
    }
    if (/(?:captcha|recaptcha|seccode|security_code|otp_token|kode_keamanan)/i.test(fullHaystack)) {
        return -300;
    }

    // Baseline score for any valid text input in a login form
    let score = 100;

    // 2. Autocomplete standard (HTML5)
    if (f.autocomplete === "username" || f.autocomplete === "email") {
        score += 350;
    }

    // 3. Priority Tier 1: Indonesian Enterprise HRIS / SJA Specific Patterns
    // Examples: txtNikHris, txtNik, nikhris, ctl00$ContentPlaceHolder1$txtNikHris, txtPegawai, txtKaryawan
    if (/(?:nikhris|txtnik|nik_hris|_nik|nik$)/i.test(terminalName) || /(?:nikhris|txtnik|nik_hris|_nik|nik$)/i.test(terminalId)) {
        score += 350;
    } else if (/\bnik\b/i.test(fullHaystack) || /nomor\s*induk/i.test(fullHaystack)) {
        score += 300;
    } else if (/(?:hris|pegawai|karyawan|nip|nrp|badge|pin_user|empid|emp_id)/i.test(terminalName) || /(?:hris|pegawai|karyawan|nip|nrp)/i.test(terminalId)) {
        score += 280;
    }

    // 4. Priority Tier 2: Standard Username keywords
    if (/(?:username|user_name|user_id|userid|txtusername|txtuser|txtlogin|uname|login_id|auth_user|account_id)/i.test(terminalName) ||
        /(?:username|user_name|user_id|userid|txtusername|txtuser|txtlogin|uname)/i.test(terminalId)) {
        score += 260;
    } else if (/(?:email|e_mail|mail_address|txtemail)/i.test(terminalName) || /(?:email|e_mail)/i.test(terminalId)) {
        score += 240;
    } else if (/(?:user|login|akun|member|identity|operator|usr)/i.test(terminalName) || /(?:user|login|akun|member)/i.test(terminalId)) {
        score += 200;
    }

    // 5. DevExpress / ASP.NET canonical primary control pattern
    // Examples: ASPxTextBox1, TextBox1, txt1, ctl00$ContentPlaceHolder1$ASPxTextBox1
    if (/^(?:aspxtextbox1|textbox1|txt1|input1)$/i.test(terminalName) ||
        /^(?:aspxtextbox1_i|aspxtextbox1|textbox1|txt1)$/i.test(terminalId)) {
        score += 250;
    }

    // 6. Label, Placeholder, Value, or Aria semantic clues
    if (/(?:nik|username|user id|id pengguna|email|nomor induk|nama pengguna|login|akun|masukan email|masukan nik|masukan user)/i.test(label) ||
        /(?:nik|username|user id|id pengguna|email|nomor induk|nama pengguna|login|akun|masukan email|masukan nik|masukan user)/i.test(placeholder) ||
        /(?:nik|username|user id|id pengguna|email|nomor induk|nama pengguna|login|akun|masukan email|masukan nik|masukan user)/i.test(value) ||
        /(?:nik|username|user id|id pengguna|email|nomor induk|nama pengguna|login|akun)/i.test(aria)) {
        score += 220;
    }

    // 7. Input type bonus
    if (f.type === "email") score += 80;
    if (f.type === "text" || f.type === "tel" || f.type === "number") score += 20;

    return score;
}

/**
 * Heuristik deteksi password field
 */
function scorePassword(f: FieldInfo): number {
    if (f.isDisabled || f.isReadOnly) return -500;
    if (f.type !== "password" && f.type !== "text" && f.type !== "") return -500;

    const rawName = (f.name ?? "").toLowerCase();
    const rawId = (f.id ?? "").toLowerCase();
    const terminalName = `${getTerminalControlName(f.name)} ${getControlNameKeepUnderscore(f.name)}`.toLowerCase();
    const terminalId = `${getTerminalControlName(f.id)} ${getControlNameKeepUnderscore(f.id)}`.toLowerCase();

    const placeholder = (f.placeholder ?? "").toLowerCase();
    const aria = (f.ariaLabel ?? "").toLowerCase();
    const title = (f.title ?? "").toLowerCase();
    const label = (f.labelText ?? "").toLowerCase();
    const value = (f.value ?? "").toLowerCase();

    const fullHaystack = `${rawName} ${rawId} ${terminalName} ${terminalId} ${placeholder} ${aria} ${title} ${label} ${value}`.toLowerCase();

    // Confirm password penalty
    if (/(?:confirm|repeat|ulang|retype|konfirmasi|verifikasi|second)/i.test(fullHaystack)) {
        return -300;
    }

    let score = 0;

    // 1. type="password" is the strongest baseline indicator
    if (f.type === "password") {
        score += 350;
    }

    // 2. Autocomplete standard
    if (f.autocomplete === "current-password" || f.autocomplete === "password") {
        score += 300;
    }

    // 3. Specific ASP.NET / HRIS / Enterprise password patterns
    // e.g. ctl00$ContentPlaceHolder1$txtPassword, txtPassword, txtPass, txtPwd, txtKataSandi
    if (/(?:txtpassword|txtpass|txtpwd|txtkatasandi|txt_password)/i.test(terminalName) ||
        /(?:txtpassword|txtpass|txtpwd|txtkatasandi|txt_password)/i.test(terminalId)) {
        score += 300;
    } else if (/(?:password|passwd|passcode|katasandi|kata_sandi|passwort)/i.test(terminalName) ||
               /(?:password|passwd|passcode|katasandi|kata_sandi)/i.test(terminalId)) {
        score += 260;
    } else if (/(?:pass|pwd|sandi|pin)/i.test(terminalName) || /(?:pass|pwd|sandi)/i.test(terminalId)) {
        score += 180;
    }

    // 4. DevExpress / ASP.NET canonical password control pattern
    // Examples: ASPxTextBox2, TextBox2, txt2, ctl00$ContentPlaceHolder1$ASPxTextBox2
    if (/^(?:aspxtextbox2|textbox2|txt2|input2)$/i.test(terminalName) ||
        /^(?:aspxtextbox2_i|aspxtextbox2|textbox2|txt2)$/i.test(terminalId)) {
        score += 260;
    }

    // 5. Label / Placeholder / Aria clues
    if (/(?:password|kata sandi|sandi|passcode|pin|pwd|masukan password|masukan kata sandi)/i.test(label) ||
        /(?:password|kata sandi|sandi|passcode|pin|pwd|masukan password|masukan kata sandi)/i.test(placeholder) ||
        /(?:password|kata sandi|sandi|passcode|pin|pwd)/i.test(aria)) {
        score += 200;
    }

    return score;
}

export function detectLoginFields(html: string): DetectedFields {
    const doc = parse(html);

    // Map: id -> label text
    const labelMap = new Map<string, string>();
    // Map: id elemen mana pun -> teksnya (untuk aria-labelledby)
    const textByIdMap = new Map<string, string>();
    // Collect all forms and all inputs
    const allInputs: FieldInfo[] = [];
    const extraFields: Record<string, string> = {};
    // Tombol submit per form: WebForms/DevExpress hanya menjalankan handler klik
    // server-side kalau name tombol ikut di-POST.
    const submitButtons = new Map<
        number,
        { name: string; value: string; isPositive: boolean; formAction: string | null }
    >();

    let currentFormIndex = -1;
    let currentFormMethod: string | null = null;
    let currentFormAction: string | null = null;

    // First pass: collect labels and hidden tokens
    function collectLabelsAndStructure(node: Node, currentLabelTarget: string | null = null): void {
        if (!node) return;

        if (isElement(node)) {
            const tag = node.tagName.toLowerCase();

            if (tag === "label") {
                const forAttr = elementAttr(node, "for");
                const text = extractText(node);
                if (forAttr && text) {
                    labelMap.set(forAttr.toLowerCase(), text);
                }
                // <label>NIK <input name="f1"></label> — label membungkus input tanpa
                // atribut for. Umum di aplikasi internal; tanpa ini teks label hilang.
                if (text) {
                    for (const el of descendantInputs(node)) {
                        const key = elementName(el) ?? elementAttr(el, "id");
                        if (key && !labelMap.has(`@wrap:${key.toLowerCase()}`)) {
                            labelMap.set(`@wrap:${key.toLowerCase()}`, text);
                        }
                    }
                }
            }

            // Elemen apa pun yang punya id dan teks bisa jadi target aria-labelledby.
            const ownId = elementAttr(node, "id");
            if (ownId && tag !== "input" && tag !== "form") {
                const t = extractText(node);
                if (t && t.length < 120) textByIdMap.set(ownId.toLowerCase(), t);
            }

            // ASP.NET ViewState & Security hidden tokens
            if (tag === "input") {
                const type = (elementAttr(node, "type") ?? "text").toLowerCase();
                const name = elementName(node);
                const value = elementAttr(node, "value") ?? "";
                if (type === "hidden" && name && value) {
                    // Keep ASP.NET and CSRF tokens
                    if (/^(?:__VIEWSTATE|__VIEWSTATEGENERATOR|__EVENTVALIDATION|__EVENTTARGET|__EVENTARGUMENT|__RequestVerificationToken|_csrf|csrf_token|_token)/i.test(name)) {
                        extraFields[name] = value;
                    } else if (Object.keys(extraFields).length < 15 && value.length < 500) {
                        extraFields[name] = value;
                    }
                }
            }
        }

        if ("childNodes" in node && Array.isArray(node.childNodes)) {
            const isLbl = isElement(node) && node.tagName.toLowerCase() === "label";
            for (const child of node.childNodes) {
                collectLabelsAndStructure(child, isLbl ? elementAttr(node, "for") : currentLabelTarget);
            }
        }
    }

    collectLabelsAndStructure(doc);

    // Second pass: collect form inputs with contextual metadata
    function walkDom(node: Node): void {
        if (!node) return;

        if (isElement(node)) {
            const tag = node.tagName.toLowerCase();

            if (tag === "form") {
                currentFormIndex++;
                currentFormMethod = (elementAttr(node, "method") ?? "POST").toUpperCase();
                currentFormAction = elementAttr(node, "action");
            }

            // Tombol submit bernama: WebForms/DevExpress/Struts butuh name tombol
            // ikut di-POST agar handler klik server-side benar-benar jalan.
            if (tag === "input" || tag === "button") {
                const btnType = (elementAttr(node, "type") ?? (tag === "button" ? "submit" : "text")).toLowerCase();
                const btnName = elementName(node);
                if (btnType === "submit" && btnName) {
                    const btnValue = elementAttr(node, "value") ?? extractText(node) ?? "";
                    const btnHay = `${btnName} ${btnValue} ${elementAttr(node, "id") ?? ""}`.toLowerCase();

                    // Tombol batal/reset/lupa-password JANGAN dipilih — mengirimkan namanya
                    // membuat server menjalankan aksi batal, bukan login.
                    const isNegative =
                        /(?:cancel|batal|reset|clear|kembali|back|close|tutup|forgot|lupa|register|daftar|signup|sign_up)/i.test(btnHay);
                    // Tombol yang jelas login diprioritaskan di atas urutan DOM.
                    const isPositive = /(?:login|masuk|signin|sign_in|submit|log_on|logon|enter|ok)/i.test(btnHay);

                    const prev = submitButtons.get(currentFormIndex);
                    if (!isNegative && (!prev || (isPositive && !prev.isPositive))) {
                        submitButtons.set(currentFormIndex, {
                            name: btnName,
                            value: btnValue,
                            isPositive,
                            // formaction menimpa action <form> saat tombol ini diklik.
                            formAction: elementAttr(node, "formaction"),
                        });
                    }
                }
            }

            if (tag === "input") {
                const type = (elementAttr(node, "type") ?? "text").toLowerCase();
                const name = elementName(node);
                const id = elementAttr(node, "id");
                const placeholder = elementAttr(node, "placeholder");
                const ariaLabel = elementAttr(node, "aria-label");
                const title = elementAttr(node, "title");
                const autocomplete = firstAutocompleteWord(elementAttr(node, "autocomplete"));
                const isDisabled = hasAttr(node, "disabled") || elementAttr(node, "aria-disabled") === "true";
                const isReadOnly = hasAttr(node, "readonly") || elementAttr(node, "aria-readonly") === "true";
                const value = elementAttr(node, "value") ?? "";

                // Associate label text: for= → label pembungkus → aria-labelledby
                let labelText: string | null = null;
                if (id && labelMap.has(id.toLowerCase())) {
                    labelText = labelMap.get(id.toLowerCase())!;
                }
                if (!labelText) {
                    const wrapKey = (name ?? id ?? "").toLowerCase();
                    if (wrapKey) labelText = labelMap.get(`@wrap:${wrapKey}`) ?? null;
                }
                if (!labelText) {
                    const labelledBy = elementAttr(node, "aria-labelledby");
                    if (labelledBy) {
                        labelText =
                            labelledBy
                                .split(/\s+/)
                                .map((ref) => textByIdMap.get(ref.toLowerCase()))
                                .filter(Boolean)
                                .join(" ") || null;
                    }
                }

                allInputs.push({
                    name,
                    id,
                    type,
                    autocomplete,
                    placeholder,
                    ariaLabel,
                    title,
                    labelText,
                    value,
                    isDisabled,
                    isReadOnly,
                    formIndex: currentFormIndex,
                    formMethod: currentFormMethod,
                    formAction: currentFormAction,
                });
            }
        }

        if ("childNodes" in node && Array.isArray(node.childNodes)) {
            for (const child of node.childNodes) {
                walkDom(child);
            }
        }
    }

    walkDom(doc);

    // Group inputs by formIndex (-1 is non-form/SPA inputs)
    const formGroups = new Map<number, FieldInfo[]>();
    for (const input of allInputs) {
        const group = formGroups.get(input.formIndex) || [];
        group.push(input);
        formGroups.set(input.formIndex, group);
    }

    let bestUsernameField: string | null = null;
    let bestPasswordField: string | null = null;
    let bestMethod = "POST";
    let bestAction: string | null = null;
    let bestFormIndex = -1;
    let highestPairScore = -1;

    // Evaluate each form group
    for (const [formIdx, inputs] of formGroups.entries()) {
        let formBestUser: FieldInfo | null = null;
        let formBestUserScore = -1;

        let formBestPass: FieldInfo | null = null;
        let formBestPassScore = -1;

        for (const input of inputs) {
            const uScore = scoreUsername(input);
            if (uScore > formBestUserScore) {
                formBestUserScore = uScore;
                formBestUser = input;
            }

            const pScore = scorePassword(input);
            if (pScore > formBestPassScore) {
                formBestPassScore = pScore;
                formBestPass = input;
            }
        }

        // Calculate combined score
        let pairScore = 0;
        if (formBestPass && formBestPassScore > 0) {
            pairScore += formBestPassScore;
            if (formBestUser && formBestUserScore > 0) {
                pairScore += formBestUserScore + 500; // Co-location bonus
            }
            if (formIdx >= 0) {
                pairScore += 100; // Standard <form> wrapper bonus
            }
        }

        // Hanya terima kalau kandidat password benar-benar bernilai positif.
        // Tanpa cek skor, input teks biasa (skor 0) ikut lolos dan menghasilkan
        // konfigurasi palsu dari halaman yang bukan halaman login.
        if (pairScore > highestPairScore && formBestPass && formBestPassScore > 0) {
            highestPairScore = pairScore;
            // Prefer name attribute for form submission, fallback to id
            bestPasswordField = formBestPass.name ?? formBestPass.id;
            bestUsernameField = formBestUser ? (formBestUser.name ?? formBestUser.id) : null;
            bestMethod = formBestPass.formMethod || "POST";
            bestAction = formBestPass.formAction;
            bestFormIndex = formIdx;
        }
    }

    // Fallback: if no form group matched well, evaluate globally across all inputs
    if (!bestPasswordField && allInputs.length > 0) {
        let globalBestUser: FieldInfo | null = null;
        let globalBestUserScore = -1;

        let globalBestPass: FieldInfo | null = null;
        let globalBestPassScore = -1;

        for (const input of allInputs) {
            const uScore = scoreUsername(input);
            if (uScore > globalBestUserScore) {
                globalBestUserScore = uScore;
                globalBestUser = input;
            }

            const pScore = scorePassword(input);
            if (pScore > globalBestPassScore) {
                globalBestPassScore = pScore;
                globalBestPass = input;
            }
        }

        if (globalBestPass && globalBestPassScore > 0) {
            bestPasswordField = globalBestPass.name ?? globalBestPass.id;
            bestUsernameField = globalBestUser ? (globalBestUser.name ?? globalBestUser.id) : null;
            bestMethod = globalBestPass.formMethod || "POST";
            bestAction = globalBestPass.formAction;
            bestFormIndex = globalBestPass.formIndex;
        }
    }

    // Sertakan tombol submit form terpilih. Tanpa ini, ASP.NET WebForms /
    // DevExpress menerima POST tapi tidak pernah menjalankan handler klik tombol,
    // jadi halaman login cuma dirender ulang tanpa pesan error.
    const submitBtn = submitButtons.get(bestFormIndex);
    if (bestPasswordField && submitBtn && !(submitBtn.name in extraFields)) {
        extraFields[submitBtn.name] = submitBtn.value;
    }
    // formaction pada tombol login menang atas action <form>.
    if (bestPasswordField && submitBtn?.formAction) {
        bestAction = submitBtn.formAction;
    }

    // Peringatan: token yang tidak bisa dipakai ulang / terikat cookie sesi.
    const warnings: string[] = [];
    const volatileKeys = Object.keys(extraFields).filter((k) =>
        /^(?:__VIEWSTATE|__EVENTVALIDATION|__RequestVerificationToken|_csrf|csrf_token|_token|authenticity_token)/i.test(k)
    );
    if (volatileKeys.length > 0) {
        warnings.push(
            `Token dinamis terdeteksi (${volatileKeys.join(", ")}). Token ini berubah setiap kali halaman dibuka, ` +
            `jadi nilai yang tersimpan akan kedaluwarsa — portal mengambilnya ulang tepat sebelum setiap peluncuran SSO.`
        );
    }

    return {
        usernameField: bestUsernameField,
        passwordField: bestPasswordField,
        httpMethod: bestMethod,
        formAction: bestAction,
        extraFields,
        confidence: highestPairScore > 0 ? highestPairScore : 0,
        warnings,
    };
}
