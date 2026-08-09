"use client";

import { useState } from "react";
import { FiCopy, FiCheck, FiEye, FiEyeOff, FiExternalLink, FiLock } from "react-icons/fi";

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

    return (
        <div style={{
            minHeight: "calc(100vh - 60px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "#0a0a0a"
        }}>
            <div style={{
                width: "100%",
                maxWidth: "440px",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "32px"
            }}>
                {/* Logo */}
                <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
                    {app.logoPath ? (
                        <img
                            src={app.logoPath}
                            alt={app.name}
                            style={{ width: "56px", height: "56px", borderRadius: "12px", objectFit: "cover" }}
                        />
                    ) : (
                        <div style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "12px",
                            backgroundColor: "var(--border-color)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                            fontSize: "22px",
                            fontWeight: 700,
                        }}>
                            {app.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h2 style={{ color: "var(--text-primary)", fontSize: "20px", margin: 0, fontWeight: 700 }}>
                            {app.name}
                        </h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FiLock size={12} /> Kredensial tersimpan (mode Vault)
                        </p>
                    </div>
                </div>

                {/* How-to banner */}
                <div style={{
                    backgroundColor: "#171717",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "20px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    lineHeight: 1.6
                }}>
                    1. Salin username &amp; password di bawah.<br />
                    2. Buka halaman login {app.name}.<br />
                    3. Tempel &amp; klik tombol login {app.name} sendiri.
                </div>

                {/* Username row */}
                <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", color: "var(--text-tertiary)", fontSize: "12px", fontWeight: 600, marginBottom: "6px", letterSpacing: "0.05em" }}>USERNAME</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <input
                            readOnly
                            value={cred.username}
                            onFocus={(e) => e.currentTarget.select()}
                            style={{
                                flex: 1,
                                padding: "10px 14px",
                                backgroundColor: "#0a0a0a",
                                border: "1px solid #262626",
                                borderRadius: "8px",
                                color: "#fff",
                                fontSize: "14px",
                                fontFamily: "monospace",
                            }}
                        />
                        <button
                            onClick={() => handleCopy(cred.username, "user")}
                            style={copyBtnStyle}
                            aria-label="Salin username"
                        >
                            {copied === "user" ? <FiCheck color="var(--color-success)" /> : <FiCopy />}
                        </button>
                    </div>
                </div>

                {/* Password row */}
                <div style={{ marginBottom: "28px" }}>
                    <label style={{ display: "block", color: "var(--text-tertiary)", fontSize: "12px", fontWeight: 600, marginBottom: "6px", letterSpacing: "0.05em" }}>PASSWORD</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <input
                            readOnly
                            type={reveal ? "text" : "password"}
                            value={cred.password}
                            onFocus={(e) => e.currentTarget.select()}
                            style={{
                                flex: 1,
                                padding: "10px 14px",
                                backgroundColor: "#0a0a0a",
                                border: "1px solid #262626",
                                borderRadius: "8px",
                                color: "#fff",
                                fontSize: "14px",
                                fontFamily: "monospace",
                                letterSpacing: reveal ? "0" : "2px",
                            }}
                        />
                        <button
                            onClick={() => setReveal((r) => !r)}
                            style={copyBtnStyle}
                            aria-label={reveal ? "Sembunyikan password" : "Lihat password"}
                        >
                            {reveal ? <FiEyeOff /> : <FiEye />}
                        </button>
                        <button
                            onClick={() => handleCopy(cred.password, "pass")}
                            style={copyBtnStyle}
                            aria-label="Salin password"
                        >
                            {copied === "pass" ? <FiCheck color="var(--color-success)" /> : <FiCopy />}
                        </button>
                    </div>
                </div>

                {/* Open target login */}
                <button
                    onClick={openTarget}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px",
                        backgroundColor: "var(--brand-red)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    <FiExternalLink /> Buka Halaman Login {app.name}
                </button>
            </div>
        </div>
    );
}

const copyBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "42px",
    height: "42px",
    backgroundColor: "#171717",
    border: "1px solid #262626",
    borderRadius: "8px",
    color: "var(--text-secondary)",
    cursor: "pointer",
    flexShrink: 0,
};
