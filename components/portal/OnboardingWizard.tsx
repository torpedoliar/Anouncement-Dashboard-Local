"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

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
        <div className="mx-auto max-w-[900px] p-8">
            <h1 className="font-display text-xl font-semibold text-text-1">
                {mode === "onboarding" ? "Pilih Aplikasi Anda" : "Pengaturan Aplikasi"}
            </h1>
            <p className="mt-2 text-sm text-text-2">
                {mode === "onboarding"
                    ? "Tentukan aplikasi yang ingin ditampilkan di beranda. Semua aktif secara default."
                    : "Pilih aplikasi yang tampil di beranda Anda, lalu klik Simpan untuk menyimpan."}
            </p>

            <div className="mt-6 flex flex-col gap-4">
                {groups.map((g) => (
                    <Card key={g.id} className="p-4">
                        <label className="flex cursor-pointer items-center gap-2 font-semibold text-text-1">
                            <input
                                type="checkbox"
                                className="accent-accent"
                                checked={!hiddenGroups.has(g.id)}
                                onChange={() => toggleGroup(g.id)}
                            />
                            {g.name}
                        </label>
                        <div className="mt-2 flex flex-col">
                            {g.apps.length === 0 ? (
                                <span className="py-1 pl-7 text-xs text-text-3">Tidak ada aplikasi dalam grup ini.</span>
                            ) : (
                                g.apps.map((a) => (
                                    <label key={a.id} className="flex cursor-pointer items-center gap-2 py-1 pl-7 text-sm text-text-2">
                                        <input
                                            type="checkbox"
                                            className="accent-accent"
                                            checked={!hiddenApps.has(a.id)}
                                            onChange={() => toggleApp(a.id)}
                                        />
                                        {a.name}
                                    </label>
                                ))
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            <div className="mt-6 flex gap-3">
                <Button
                    variant="primary"
                    onClick={() => submit(false)}
                    disabled={saving}
                >
                    {saving ? "Menyimpan..." : "Simpan"}
                </Button>
                {mode === "onboarding" ? (
                    <Button
                        variant="secondary"
                        onClick={() => submit(true)}
                        disabled={saving}
                    >
                        Lewati
                    </Button>
                ) : null}
            </div>
        </div>
    );
}