"use client";

export interface SelectableAccount {
    id: string;
    label: string;
}

interface AccountSelectorProps {
    appName: string;
    accounts: SelectableAccount[];
    baseHref: string; // `/portal/app/[slug]`
}

/**
 * Tampil saat app punya >1 akun tersimpan. User memilih akun → halaman [appSlug]
 * di-render ulang dengan ?credentialId= akun terpilih.
 */
export default function AccountSelector({ appName, accounts, baseHref }: AccountSelectorProps) {
    return (
        <div style={{ padding: "32px", maxWidth: "480px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", color: "#fff", fontSize: "24px", marginBottom: "8px" }}>
                Pilih Akun
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>
                Aplikasi {appName} memiliki lebih dari satu akun tersimpan. Pilih akun yang ingin digunakan.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {accounts.map((a) => (
                    <a
                        key={a.id}
                        href={`${baseHref}?credentialId=${a.id}`}
                        style={{
                            display: "block",
                            padding: "14px 18px",
                            backgroundColor: "#111",
                            border: "1px solid #262626",
                            borderRadius: "8px",
                            color: "#fff",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "14px",
                        }}
                    >
                        {a.label}
                    </a>
                ))}
            </div>
        </div>
    );
}
