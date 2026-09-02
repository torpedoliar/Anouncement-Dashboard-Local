"use client";

import { CheckCircle, ClockCounterClockwise, ShieldWarning, Sparkle } from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export interface LoginProfileSummary {
    id: string;
    origin: string;
    entryPath: string;
    finalPath: string | null;
    formActionPath: string | null;
    httpMethod: string | null;
    usernameField: string | null;
    passwordField: string | null;
    extraFieldNames: string[];
    recommendedMode: string | null;
    detectionLayer: string;
    discoveryConfidence: number | null;
    discoverySignals: string[];
    warnings: string[];
    apiContracts: Array<{ method: string; path: string; params: string[] }>;
    apiSpecPath: string | null;
    currentFingerprint: string;
    approvedFingerprint: string | null;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
    state: "DISCOVERED" | "TRANSPORT_VALIDATED" | "CREDENTIAL_ACCEPTED" | "REJECTED" | "STALE";
    requiresApproval?: boolean;
    detectorVersion: string;
    lastDiscoveredAt: string | Date;
    lastCheckedAt: string | Date | null;
    lastTransportValidatedAt: string | Date | null;
    lastCredentialAcceptedAt: string | Date | null;
    staleAt: string | Date | null;
    lastError: string | null;
    approvedAt: string | Date | null;
}

interface LoginProfileReviewProps {
    profile: LoginProfileSummary;
    isApproving: boolean;
    onApproveAndApply: () => void;
    onApply: () => void;
}

function needsProfileApproval(profile: LoginProfileSummary): boolean {
    return profile.requiresApproval ?? (
        profile.approvalStatus !== "APPROVED" ||
        profile.approvedFingerprint !== profile.currentFingerprint ||
        profile.state === "STALE"
    );
}

function approvalTone(profile: LoginProfileSummary): "success" | "warning" | "danger" | "info" {
    if (profile.state === "STALE") return "warning";
    if (profile.approvalStatus === "APPROVED" && !needsProfileApproval(profile)) return "success";
    if (profile.approvalStatus === "REJECTED") return "danger";
    return "info";
}

function approvalLabel(profile: LoginProfileSummary): string {
    if (profile.state === "STALE") return "Kandidat berubah";
    if (profile.approvalStatus === "APPROVED" && !needsProfileApproval(profile)) return "Disetujui";
    if (profile.approvalStatus === "REJECTED") return "Tidak disetujui";
    return "Menunggu persetujuan";
}

function evidenceLabel(profile: LoginProfileSummary): string {
    switch (profile.state) {
        case "CREDENTIAL_ACCEPTED":
            return "Kredensial pernah diterima";
        case "TRANSPORT_VALIDATED":
            return "Transport telah tervalidasi";
        case "REJECTED":
            return "Verifikasi terakhir ditolak";
        case "STALE":
            return "Struktur terbaru berbeda";
        default:
            return "Struktur terdeteksi";
    }
}

function formatDate(value: string | Date | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString("id-ID");
}

export default function LoginProfileReview({
    profile,
    isApproving,
    onApproveAndApply,
    onApply,
}: LoginProfileReviewProps) {
    const lastSeen = formatDate(profile.lastDiscoveredAt);
    const approvedAt = formatDate(profile.approvedAt);
    const needsApproval = needsProfileApproval(profile);
    const usesJsonApi = profile.apiContracts.length > 0;

    return (
        <section
            aria-label="Tinjauan profile deteksi login"
            className="rounded-card border border-border bg-surface-2 p-4"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-info-subtle text-info">
                        {profile.state === "STALE" ? (
                            <ShieldWarning size={18} aria-hidden="true" />
                        ) : (
                            <Sparkle size={18} aria-hidden="true" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-sm font-semibold text-text-1">Kandidat profile login</h3>
                            <Badge tone={approvalTone(profile)}>{approvalLabel(profile)}</Badge>
                        </div>
                        <p className="mt-1 max-w-[72ch] text-xs leading-relaxed text-text-2">
                            Bukti struktural untuk <span className="font-mono text-text-1">{profile.origin}{profile.entryPath}</span>.
                            Nilai token, cookie, HTML mentah, dan kredensial tidak disimpan.
                        </p>
                    </div>
                </div>
                {needsApproval ? (
                    <Button
                        type="button"
                        size="sm"
                        onClick={onApproveAndApply}
                        disabled={isApproving}
                        iconLeft={<CheckCircle size={15} aria-hidden="true" />}
                    >
                        {isApproving ? "Menyetujui..." : "Setujui & terapkan"}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={onApply}
                        iconLeft={<CheckCircle size={15} aria-hidden="true" />}
                    >
                        Terapkan profile
                    </Button>
                )}
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 border-t border-border pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <dt className="text-text-3">Bukti</dt>
                    <dd className="mt-0.5 font-medium text-text-1">{evidenceLabel(profile)}</dd>
                </div>
                <div>
                    <dt className="text-text-3">Jalur</dt>
                    <dd className="mt-0.5 font-mono text-text-1">
                        {profile.detectionLayer} · {profile.discoveryConfidence ?? "–"}
                    </dd>
                </div>
                <div>
                    <dt className="text-text-3">Form</dt>
                    <dd className="mt-0.5 font-mono text-text-1">
                        {profile.usernameField ?? "–"} / {profile.passwordField ?? "–"}
                    </dd>
                </div>
                <div>
                    <dt className="text-text-3">Target akhir</dt>
                    <dd className="mt-0.5 break-all font-mono text-text-1">{profile.finalPath ?? "–"}</dd>
                </div>
                <div>
                    <dt className="text-text-3">Aksi form</dt>
                    <dd className="mt-0.5 break-all font-mono text-text-1">{profile.formActionPath ?? "–"}</dd>
                </div>
                <div>
                    <dt className="text-text-3">Terakhir diamati</dt>
                    <dd className="mt-0.5 flex items-center gap-1 text-text-1">
                        <ClockCounterClockwise size={13} aria-hidden="true" />
                        {lastSeen ?? "–"}
                    </dd>
                </div>
            </dl>

            {(profile.discoverySignals.length > 0 || profile.warnings.length > 0 || usesJsonApi || profile.lastError) && (
                <div className="mt-3 space-y-2 text-xs">
                    {profile.discoverySignals.slice(0, 3).map((signal) => (
                        <p key={signal} className="text-text-2">• {signal}</p>
                    ))}
                    {usesJsonApi && (
                        <p className="text-info">
                            Kontrak API JSON: {profile.apiContracts.map((contract) => `${contract.method} ${contract.path}`).join(", ")}
                        </p>
                    )}
                    {profile.lastError && <p className="text-warning">Revalidasi: {profile.lastError}</p>}
                    {profile.warnings.slice(0, 2).map((warning) => (
                        <p key={warning} className="text-warning">⚠ {warning}</p>
                    ))}
                </div>
            )}

            {needsApproval ? (
                <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-text-3">
                    Persetujuan menerapkan hanya nama field, mode, dan metadata profile ke konfigurasi editor. Endpoint login tidak akan dipakai untuk pengiriman kredensial sampai aplikasi disimpan.
                </p>
            ) : (
                <p className="mt-3 border-t border-border pt-3 text-xs text-text-3">
                    Disetujui{approvedAt ? ` pada ${approvedAt}` : ""}. Revalidasi otomatis hanya menandai perubahan; tidak pernah mengganti konfigurasi aplikasi secara diam-diam.
                </p>
            )}
        </section>
    );
}
