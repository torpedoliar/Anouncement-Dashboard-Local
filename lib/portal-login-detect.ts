import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

// ponytail: parse5 tree walker manual (bukan cheerio/jsdom) — lapisan terendah yang cukup.
// Jika tipe DefaultTreeAdapterMap menyulitkan, fallback `type Node = any; type Element = any;`.
type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

export interface DetectedFields {
    usernameField: string | null;
    passwordField: string | null;
    extraFields: Record<string, string>;
}

const USERNAME_KEYWORDS = [
    "user", "login", "email", "account", "nik", "pegawai", "karyawan",
    "nip", "member", "identity", "phone", "nama", "usr", "userid", "uname"
];

interface FieldInfo {
    name: string | null;
    id: string | null;
    type: string;
    autocomplete: string | null;
    placeholder: string | null;
    ariaLabel: string | null;
    value: string;
}

function isElement(n: Node): n is Element {
    if (n.nodeName === "#text" || n.nodeName === "#comment" || n.nodeName === "#documentType") return false;
    return "tagName" in n;
}

function elementName(el: Element): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === "name")?.value ?? null;
}

function elementAttr(el: Element, attr: string): string | null {
    return el.attrs.find((a) => a.name.toLowerCase() === attr.toLowerCase())?.value ?? null;
}

function collectInputs(el: Element, acc: FieldInfo[]): void {
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
        const type = (elementAttr(el, "type") ?? "text").toLowerCase();
        acc.push({
            name: elementName(el),
            id: elementAttr(el, "id"),
            type,
            autocomplete: firstAutocompleteWord(elementAttr(el, "autocomplete")),
            placeholder: elementAttr(el, "placeholder"),
            ariaLabel: elementAttr(el, "aria-label"),
            value: elementAttr(el, "value") ?? "",
        });
    }
    if (el.childNodes) {
        for (const child of el.childNodes) {
            if (isElement(child)) collectInputs(child, acc);
        }
    }
}

// autocomplete bisa "username" atau "username something" → ambil kata pertama
function firstAutocompleteWord(raw: string | null): string | null {
    if (!raw) return null;
    return raw.toLowerCase().split(/\s+/)[0] ?? null;
}

function usernameScore(f: FieldInfo): number {
    if (f.type !== "text" && f.type !== "email" && f.type !== "tel" && f.type !== "search" && f.type !== "number") return -1;
    if (f.autocomplete === "username" || f.autocomplete === "email") return 100;
    const hay = `${f.name ?? ""} ${f.id ?? ""} ${f.placeholder ?? ""} ${f.ariaLabel ?? ""}`.toLowerCase();
    if (USERNAME_KEYWORDS.some((k) => hay.includes(k))) return 70;
    if (f.type === "email") return 50;
    return 10;
}

export function detectLoginFields(html: string): DetectedFields {
    const doc = parse(html);
    let usernameField: string | null = null;
    let passwordField: string | null = null;
    const extraFields: Record<string, string> = {};
    const allDocInputs: FieldInfo[] = [];

    function processInputs(inputs: FieldInfo[]): boolean {
        const passwordInput = inputs.find((f) => f.type === "password");
        if (passwordInput) {
            for (const f of inputs) {
                if (f.name && f.type === "hidden" && f.value) {
                    extraFields[f.name] = f.value;
                }
            }
            let bestIdx = -1;
            let bestScore = -1;
            for (let i = 0; i < inputs.length; i++) {
                const s = usernameScore(inputs[i]);
                if (s > bestScore) {
                    bestScore = s;
                    bestIdx = i;
                }
            }
            if (bestIdx >= 0) {
                usernameField = inputs[bestIdx].name ?? inputs[bestIdx].id;
            }
            passwordField = passwordInput.name ?? passwordInput.id;
            return true;
        }
        return false;
    }

    function visit(node: Node): void {
        if (!isElement(node)) return;
        const tag = node.tagName.toLowerCase();
        if (tag === "input") {
            const type = (elementAttr(node, "type") ?? "text").toLowerCase();
            allDocInputs.push({
                name: elementName(node),
                id: elementAttr(node, "id"),
                type,
                autocomplete: firstAutocompleteWord(elementAttr(node, "autocomplete")),
                placeholder: elementAttr(node, "placeholder"),
                ariaLabel: elementAttr(node, "aria-label"),
                value: elementAttr(node, "value") ?? "",
            });
        }
        if (tag === "form" && !passwordField) {
            const formInputs: FieldInfo[] = [];
            for (const child of node.childNodes ?? []) {
                if (isElement(child)) collectInputs(child, formInputs);
            }
            processInputs(formInputs);
        }
        for (const child of node.childNodes ?? []) {
            if (isElement(child)) visit(child);
        }
    }

    for (const child of doc.childNodes) {
        if (isElement(child)) visit(child);
    }

    // Jika form tag tidak ada atau tidak membungkus password input, scan seluruh input dokumen
    if (!passwordField && allDocInputs.length > 0) {
        processInputs(allDocInputs);
    }

    return { usernameField, passwordField, extraFields };
}
