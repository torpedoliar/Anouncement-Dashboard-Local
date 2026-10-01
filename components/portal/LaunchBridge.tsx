"use client";

import Image from "next/image";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { iconColor } from "@/lib/portal-home";

export type BridgeStepState = "pending" | "active" | "done" | "error";
export interface BridgeStep {
    label: string;
    state: BridgeStepState;
}

/**
 * Layar launch bersama untuk semua mode SSO: logo portal → garis → ikon app.
 * Ikon app memakai view-transition-name yang sama dengan tile yang diklik di
 * beranda, jadi browser yang mendukung menerbangkan ikon ke sini (zoom).
 * Tahapan hanya yang benar-benar diketahui klien — tidak ada jeda buatan.
 */
export default function LaunchBridge({
    app,
    title,
    subtitle,
    steps,
    notice,
    actions,
}: {
    app: { name: string; slug: string; logoPath?: string | null };
    title: string;
    subtitle?: string;
    steps: BridgeStep[];
    notice?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    const failed = steps.some((s) => s.state === "error");
    const done = steps.length > 0 && steps.every((s) => s.state === "done");
    const current = steps.find((s) => s.state === "active" || s.state === "error");

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface-0 px-5 py-10">
            <div className="w-full max-w-[440px] text-center">
                <div className="flex items-center justify-center" aria-hidden="true">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-brand text-lg font-bold text-white">S</span>
                    <span className={`launch-wire mx-1 ${failed ? "is-error" : done ? "is-done" : ""}`}>
                        <span className="launch-pulse" />
                    </span>
                    <span
                        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[16px] text-xl font-bold text-white shadow-lvl-2"
                        style={{
                            viewTransitionName: `app-${app.slug}`,
                            backgroundColor: app.logoPath ? undefined : iconColor(app.name),
                        }}
                    >
                        {app.logoPath ? (
                            <Image src={app.logoPath} alt="" width={56} height={56} className="h-full w-full object-cover" />
                        ) : (
                            app.name.charAt(0).toUpperCase()
                        )}
                    </span>
                </div>

                <h1 className="mt-8 font-serif text-2xl font-semibold text-text-1">{title}</h1>
                {subtitle && <p className="mt-1.5 text-sm text-text-2">{subtitle}</p>}

                <ol className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs" aria-label="Tahapan">
                    {steps.map((s) => (
                        <li
                            key={s.label}
                            className={`flex items-center gap-1.5 ${
                                s.state === "done" ? "text-success" : s.state === "error" ? "text-danger" : s.state === "active" ? "text-text-1" : "text-text-3"
                            }`}
                        >
                            {s.state === "done" ? (
                                <CheckCircle size={14} weight="fill" aria-hidden="true" />
                            ) : s.state === "error" ? (
                                <WarningCircle size={14} weight="fill" aria-hidden="true" />
                            ) : (
                                <span aria-hidden="true" className={`h-2 w-2 rounded-full border-[1.5px] border-current ${s.state === "active" ? "launch-step-active" : ""}`} />
                            )}
                            {s.label}
                        </li>
                    ))}
                </ol>

                <p role="status" aria-live="polite" className="sr-only">
                    {current ? `${current.label}${current.state === "error" ? " gagal" : ""}` : done ? "Selesai, mengalihkan" : ""}
                </p>

                {notice && <div className="mt-6 rounded-card border border-warning/30 bg-surface-2 p-4 text-left text-sm text-text-2">{notice}</div>}
                {actions && <div className="mt-4 flex flex-col gap-2">{actions}</div>}
            </div>
        </div>
    );
}
