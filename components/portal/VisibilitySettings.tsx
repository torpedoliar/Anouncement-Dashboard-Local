"use client";

import OnboardingWizard from "@/components/portal/OnboardingWizard";

interface VisibilitySettingsProps {
    groups: { id: string; name: string; apps: { id: string; name: string; logoPath?: string | null }[] }[];
    initialHiddenGroups?: string[];
    initialHiddenApps?: string[];
}

/** Pengaturan pasca-login: render wizard dalam mode settings (PATCH per toggle, tanpa Lewati). */
export default function VisibilitySettings({ groups, initialHiddenGroups, initialHiddenApps }: VisibilitySettingsProps) {
    return (
        <OnboardingWizard
            groups={groups}
            mode="settings"
            initialHiddenGroups={initialHiddenGroups}
            initialHiddenApps={initialHiddenApps}
        />
    );
}