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
    /** State awal (dipakai settings: grup/app yang pernah user matikan harus tampil unchecked) */
    initialHiddenGroups?: string[];
    initialHiddenApps?: string[];
}

/**
 * Wizard login pertama (mode=onboarding) atau pengaturan pasca-login (mode=settings).
 * - onboarding: semua on default; user hanya mematikan; tombol Simpan/Lewati → POST replace.
 * - settings:   state awal dari preferensi tersimpan; tombol Simpan → POST replace; tanpa Lewati.
 */
export default function OnboardingWizard({ groups, mode = "onboarding", initialHiddenGroups = [], initialHiddenApps = [] }: OnboardingWizardProps) {
    const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set(initialHiddenGroups));
    const [hiddenApps, setHiddenApps] = useState<Set<string>>(() => new Set(initialHiddenApps));
    const [saving, setSaving] = useState(false);

    const toggleGroup = (gid: string) => {
        setHiddenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(gid)) next.delete(gid);
            else next.add(gid);
            return next;
        });
    };
    const toggleApp = (aid: string) => {
        setHiddenApps((prev) => {
            const next = new Set(prev);
            if (next.has(aid)) next.delete(aid);
            else next.add(aid);
            return next;
        });
    }; // ponytail: two toggles are intentionally separate — group off ≠ app off semantics (PATCH body differs)

    const submit = async (skip: boolean) => {
        // Settings: inisial hidden di-merge agar Simpan tanpa perubahan TIDAK menimpa preferensi
        // tersimpan; app yang di-untick (menampilkan kembali) masuk appIdsOn. skip=true → server
        // hapus semua row (murni default) — hanya dipakai onboarding (Lewati).
        const groupIdsOff = mode === "settings" ? [...new Set([...initialHiddenGroups, ...hiddenGroups])] : [...hiddenGroups];
        const appIdsOff = mode === "settings" ? [...new Set([...initialHiddenApps, ...hiddenApps])] : [...hiddenApps];
        const appIdsOn = mode === "settings"
            ? initialHiddenApps.filter((id) => !hiddenApps.has(id))
            : [];
        setSaving(true);
        try {
            const res = await fetch("/api/portal/visibility", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    groupIdsOff,
                    appIdsOff,
                    appIdsOn,
                    skip,
                }),
            });
            if (res.ok) {
                window.location.href = "/portal";
            } else {
                console.error("POST visibility failed", res.status);
            }
        } catch (e) {
            console.error("POST visibility error", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", color: "#fff", marginBottom: "8px" }}>
                {mode === "onboarding" ? "Pilih Aplikasi Anda" : "Pengaturan Aplikasi"}
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                {mode === "onboarding"
                    ? "Tentukan aplikasi yang ingin ditampilkan di beranda. Semua aktif secara default."
                    : "Pilih aplikasi yang tampil di beranda Anda, lalu klik Simpan untuk menyimpan."}
            </p>

            {groups.map((g) => (
                <div key={g.id} style={{ marginBottom: "16px", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={!hiddenGroups.has(g.id)}
                            onChange={() => toggleGroup(g.id)}
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
                                        onChange={() => toggleApp(a.id)}
                                    />
                                    {a.name}
                                </label>
                            ))
                        )}
                    </div>
                </div>
            ))}

            {mode === "onboarding"
                ? (
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
                )
                : (
                    <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                        <button
                            onClick={() => submit(false)}
                            disabled={saving}
                            style={{ padding: "10px 20px", backgroundColor: "var(--brand-red)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
                        >
                            {saving ? "Menyimpan..." : "Simpan"}
                        </button>
                    </div>
                )}
        </div>
    );
}