"use client";

import { useState } from "react";
import { LinkSimple, WhatsappLogo, Check } from "@phosphor-icons/react";
import { copyText } from "@/lib/clipboard";

export default function ShareBar({ title, url }: { title: string; url: string }) {
    const [copied, setCopied] = useState(false);
    const absolute = () => new URL(url, window.location.origin).toString();

    const btn = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border px-4 text-sm font-semibold text-text-1 transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

    return (
        <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6">
            <span className="mr-2 text-sm text-text-3">Bagikan</span>
            <a
                href={`https://wa.me/?text=${encodeURIComponent(title)}`}
                onClick={(e) => {
                    e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${title} ${absolute()}`)}`;
                }}
                target="_blank"
                rel="noopener noreferrer"
                className={btn}
            >
                <WhatsappLogo size={18} aria-hidden="true" />
                WhatsApp
            </a>
            <button
                type="button"
                onClick={async () => {
                    if (await copyText(absolute())) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }
                }}
                className={btn}
            >
                {copied ? <Check size={18} aria-hidden="true" /> : <LinkSimple size={18} aria-hidden="true" />}
                {copied ? "Tersalin" : "Salin tautan"}
            </button>
            <span role="status" aria-live="polite" className="sr-only">{copied ? "Tautan tersalin" : ""}</span>
        </div>
    );
}
