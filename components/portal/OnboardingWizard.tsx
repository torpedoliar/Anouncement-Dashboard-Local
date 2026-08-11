"use client";

import { useState } from "react";

export interface WizardApp {
    id: string;
    name: string;
    logoPath?: string | null;
}

export interface WizardGroup {
    id: string;
    name: string;
    apps: WizardApp[];
}

interface OnboardingWizardProps {
    groups: WizardGroup[];
    mode?: "onboarding" | "settings";
}

/**
 * Wizard login pertama (mode=onboarding) atau pengaturan pasca-login (mode=settings).
 * - onboarding: semua on default; user hanya mematikan; tombol Simpan/Lewati → POST replace.
 * - settings:   setiap toggle langsung PATCH; tanpa tombol Lewati.
 */
export default function OnboardingWizard({ groups, mode = "onboarding" }: OnboardingWizardProps) {
    const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
    const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    const toggleGroup = (gid: string) => {
        const next = new Set(hiddenGroups);
        next.has(gid) ? next.delete(gid) : next.add(gid);
        setHiddenGroups(next);
    };
    const toggleApp = (aid: string) => {
        const next = new Set(hiddenApps);
        next.has(aid) ? next.delete(aid) : next.add(aid);
        setHiddenApps(next);
    };

    const submit = async (skip: boolean) => {
        setSaving(true);
        try {
            const res = await fetch("/api/portal/visibility", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    groupIdsOff: [...hiddenGroups],
                    appIdsOff: [...hiddenApps],
                    appIdsOn: [],
                    skip,
                }),
            });
            if (res.ok) {
                window.location.href = "/portal";
            } else {
                alert("Gagal menyimpan pengaturan. Coba lagi.");
            }
        } catch {
            alert("Terjadi kesalahan saat menyimpan.");
        } finally {
            setSaving(false);
        }
    };

    const patch = async (body: { groupId?: string; appId?: string; visible: boolean }) => {
        try {
            const res = await fetch("/api/portal/visibility", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) alert("Gagal memperbarui pengaturan.");
        } catch {
            alert("Terjadi kesalahan.");
        }
    };

    // settings mode: toggle langsung PATCH
    const handleGroupChange = (gid: string) => {
        const willHide = !hiddenGroups.has(gid);
        toggleGroup(gid);
        if (mode === "settings") patch({ groupId: gid, visible: !willHide });
    };
    const handleAppChange = (aid: string) => {
        const willHide = !hiddenApps.has(aid);
        toggleApp(aid);
        if (mode === "settings") patch({ appId: aid, visible: !willHide });
    };

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", color: "#fff", marginBottom: "8px" }}>
                {mode === "onboarding" ? "Pilih Aplikasi Anda" : "Pengaturan Aplikasi"}
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                {mode === "onboarding"
                    ? "Tentukan aplikasi yang ingin ditampilkan di beranda. Semua aktif secara default."
                    : "Pilih aplikasi yang tampil di beranda Anda. Perubahan langsung tersimpan."}
            </p>

            {groups.map((g) => (
                <div key={g.id} style={{ marginBottom: "16px", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={!hiddenGroups.has(g.id)}
                            onChange={() => handleGroupChange(g.id)}
                        />
                        {g.name}
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px", paddingLeft: "28px" }}>
                        {g.apps.length === 0 ? (
                            <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Tidak ada aplikasi dalam grup ini.</span>
                        ) : (
                            g.apps.map((a) => (
                                <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={!hiddenApps.has(a.id)}
                                        onChange={() => handleAppChange(a.id)}
                                    />
                                    {a.name}
                                </label>
                            ))
                        )}
                    </div>
                </div>
            ))}

            {mode === "onboarding" && (
                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                    <button
                        onClick={() => submit(false)}
                        disabled={saving}
                        style={{ padding: "10px 20px", backgroundColor: "var(--brand-red)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
                    >
                        {saving ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button
                        onClick={() => submit(true)}
                        disabled={saving}
                        style={{ padding: "10px 20px", backgroundColor: "var(--border-color)", color: "var(--text-secondary)", border: "none", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer" }}
                    >
                        Lewati
                    </button>
                </div>
            )}
        </div>
    );
}