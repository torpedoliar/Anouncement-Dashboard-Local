"use client";

import { useState } from "react";
import { ArrowSquareOut, Check, Copy, Eye, EyeSlash, LockKey } from "@phosphor-icons/react";

interface SSOCredentialVaultProps {
    app: {
        name: string;
        url: string;
        logoPath?: string | null;
    };
    cred: {
        username: string;
        password: string;
    };
}

// ponytail: copy fallback via execCommand for HTTP internal deploys (192.168.2.3:3100)
// where navigator.clipboard is undefined (secure-context only). Drop the fallback when
// the portal is served over HTTPS behind a TLS terminator.
async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // fall through to legacy path
        }
    }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

export default function SSOCredentialVault({ app, cred }: SSOCredentialVaultProps) {
    const [reveal, setReveal] = useState(false);
    const [copied, setCopied] = useState<"user" | "pass" | null>(null);

    const flash = (which: "user" | "pass") => {
        setCopied(which);
        setTimeout(() => setCopied(null), 1500);
    };

    const handleCopy = async (text: string, which: "user" | "pass") => {
        const ok = await copyText(text);
        if (ok) flash(which);
    };

    // Open target login in a new tab. Oracle's own same-origin login.js handles the
    // X-Service: AuthenticateUser XHR — we never touch it cross-origin, so no CSRF /
    // CORS / MAC breakage (the four documented REROUTE failures all stay avoided).
    const openTarget = () => window.open(app.url, "_blank", "noopener,noreferrer");

    const iconBtnClass =
        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-control text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
            <div className="w-full max-w-[440px] rounded-sheet border border-border bg-surface-1 p-8 shadow-lvl-2">
                {/* Logo + header */}
                <div className="flex items-center gap-4">
                    {app.logoPath ? (
                        <img
                            src={app.logoPath}
                            alt={app.name}
                            className="h-14 w-14 rounded-sheet object-cover"
                        />
                    ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sheet bg-surface-3 text-xl font-semibold text-text-2">
                            {app.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h2 className="truncate font-display text-xl font-semibold text-text-1">
                            {app.name}
                        </h2>
                        <p className="mt-1 flex items-center gap-1 text-xs text-text-3">
                            <LockKey size={12} aria-hidden="true" /> Kredensial tersimpan (mode Vault)
                        </p>
                    </div>
                </div>

                {/* How-to banner */}
                <div className="mt-6 rounded-card border border-border bg-surface-2 px-4 py-3 text-sm text-text-2">
                    1. Salin username &amp; password di bawah.<br />
                    2. Buka halaman login {app.name}.<br />
                    3. Tempel &amp; klik tombol login {app.name} sendiri.
                </div>

                {/* Username row */}
                <div className="mb-3">
                    <label htmlFor="vault-username" className="mb-2 block text-xs font-semibold text-text-2">
                        Username
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="vault-username"
                            readOnly
                            value={cred.username}
                            onFocus={(e) => e.currentTarget.select()}
                            className="h-10 flex-1 rounded-control border border-border bg-surface-0 px-3 font-mono text-sm tabular-nums text-text-1"
                        />
                        <button
                            onClick={() => handleCopy(cred.username, "user")}
                            className={iconBtnClass}
                            aria-label="Salin username"
                        >
                            {copied === "user" ? (
                                <Check size={16} className="text-success" />
                            ) : (
                                <Copy size={16} />
                            )}
                        </button>
                    </div>
                </div>

                {/* Password row */}
                <div className="mb-7">
                    <label htmlFor="vault-password" className="mb-2 block text-xs font-semibold text-text-2">
                        Password
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="vault-password"
                            readOnly
                            type={reveal ? "text" : "password"}
                            value={cred.password}
                            onFocus={(e) => e.currentTarget.select()}
                            className={`h-10 flex-1 rounded-control border border-border bg-surface-0 px-3 font-mono text-sm tabular-nums text-text-1 ${
                                reveal ? "" : "tracking-[2px]"
                            }`}
                        />
                        <button
                            onClick={() => setReveal((r) => !r)}
                            className={iconBtnClass}
                            aria-label={reveal ? "Sembunyikan password" : "Lihat password"}
                        >
                            {reveal ? <EyeSlash size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                            onClick={() => handleCopy(cred.password, "pass")}
                            className={iconBtnClass}
                            aria-label="Salin password"
                        >
                            {copied === "pass" ? (
                                <Check size={16} className="text-success" />
                            ) : (
                                <Copy size={16} />
                            )}
                        </button>
                    </div>
                </div>

                {/* Open target login */}
                <button
                    onClick={openTarget}
                    className="flex w-full items-center justify-center gap-2 rounded-control py-3 text-sm font-semibold text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                    <ArrowSquareOut size={16} aria-hidden="true" />
                    Buka Halaman Login {app.name}
                </button>
            </div>
        </div>
    );
}