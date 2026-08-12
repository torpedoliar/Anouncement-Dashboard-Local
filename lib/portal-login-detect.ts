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

const USERNAME_KEYWORDS = ["user", "login", "email", "account"];

interface FieldInfo {
    name: string | null;
    id: string | null;
    type: string;
    autocomplete: string | null;
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
    return el.attrs.find((a) => a.name.toLowerCase() === attr)?.value ?? null;
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
    if (f.type !== "text" && f.type !== "email" && f.type !== "tel" && f.type !== "search") return -1;
    if (f.autocomplete === "username") return 100;
    const hay = `${f.name ?? ""} ${f.id ?? ""}`.toLowerCase();
    if (USERNAME_KEYWORDS.some((k) => hay.includes(k))) return 50;
    return 0;
}

export function detectLoginFields(html: string): DetectedFields {
    const doc = parse(html);
    let usernameField: string | null = null;
    let passwordField: string | null = null;
    const extraFields: Record<string, string> = {};

    function visit(node: Node): void {
        if (!isElement(node)) return;
        const tag = node.tagName.toLowerCase();
        if (tag === "form") {
            const inputs: FieldInfo[] = [];
            for (const child of node.childNodes ?? []) {
                if (isElement(child)) collectInputs(child, inputs);
            }
            const passwordInput = inputs.find((f) => f.type === "password");
            if (passwordInput) {
                // Extra fields — hidden statis dengan nilai non-kosong
                for (const f of inputs) {
                    if (f.name && f.type === "hidden" && f.value) {
                        extraFields[f.name] = f.value;
                    }
                }
                // Username paling cocok (scoring)
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
            }
        }
        for (const child of node.childNodes ?? []) {
            if (isElement(child)) visit(child);
        }
    }

    for (const child of doc.childNodes) {
        if (isElement(child)) visit(child);
    }

    return { usernameField, passwordField, extraFields };
}
