"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { CaretLeft, CaretRight, GridFour, LockKey, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/hooks/useConfirm";
import Table, { type TableColumn } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button, { buttonClasses } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import LoginProfileReview, { type LoginProfileSummary } from "@/components/portal-admin/LoginProfileReview";

interface PortalApp {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    url: string;
    loginUrl: string | null;
    logoPath?: string | null;
    ssoMode: string;
    httpMethod: string;
    usernameField: string | null;
    passwordField: string | null;
    extraFields: Record<string, string> | null;
    category: string | null;
    isActive: boolean;
    isPublic: boolean;
    displayOrder: number;
    healthStatus?: string | null;
    healthStatusCode?: number | null;
    healthLatencyMs?: number | null;
    healthCheckedAt?: string | null;
    healthError?: string | null;
    detectionConfidence?: number | null;
    detectionSignals?: string[] | null;
    detectionLayer?: string | null;
    loginFormChanged?: boolean;
    ssoFailure24h?: number;
    loginProfileId?: string | null;
    loginProfileFingerprint?: string | null;
    loginProfile?: LoginProfileSummary | null;
    apiLayer?: string | null;
    apiContracts?: Array<{
        method: string;
        path: string;
        params: string[];
    }>;
    createdAt: string;
    updatedAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const emptyForm = {
    name: "",
    slug: "",
    description: "",
    url: "",
    loginUrl: "",
    logoPath: "",
    ssoMode: "FORM",
    httpMethod: "POST",
    usernameField: "username",
    passwordField: "password",
    extraFields: "",
    category: "",
    isActive: true,
    isPublic: true,
    displayOrder: 0,
    detectionConfidence: null as number | null,
    detectionSignals: null as string[] | null,
    detectionLayer: null as string | null,
    loginProfileId: null as string | null,
    loginProfileFingerprint: null as string | null,
    apiLayer: null as string | null,
    apiContracts: null as Array<{
        method: string;
        path: string;
        params: string[];
    }> | null,
};

// Guardrail pemilih SSO Mode (TASK-14, gelombang A3; §5/§7 sso-modes-design):
// salah mode = user mendarat di halaman login manual dan persepsi "SSO rusak".
// Satu kalimat per mode di bawah select; PROXY/TOKEN ditandai belum siap
// (§4/§5), sedangkan REDIRECT aktif sehingga TIDAK diberi label nonaktif.
const SSO_MODE_HINT: Record<string, string> = {
    FORM: "Forwarding kredensial: kredensial tersimpan di-auto-submit ke form login aplikasi.",
    REDIRECT: "Hand-off identitas tanpa kredensial — untuk app intranet WIA / IP-trusted.",
    PROXY: "Portal tidak mendukung reverse proxy — gunakan REROUTE atau POST.",
    TOKEN: "Butuh aplikasi yang bisa memvalidasi JWT portal (menunggu konsumen pertama).",
    REROUTE: "Login server-to-server ke Oracle/EBS lalu re-issue cookie ke browser.",
    VAULT: "Buka tab aplikasi target lalu salin kredensial tersimpan.",
    POST: "Relay POST federasi (WS-Fed/K2) memakai kredensial tersimpan.",
};

export default function PortalAppsPage() {
    const [apps, setApps] = useState<PortalApp[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingApp, setEditingApp] = useState<PortalApp | null>(null);
    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [detectMsg, setDetectMsg] = useState<{ type: "ok" | "err"; text: string; warnings?: string[] } | null>(null);
    const [profileCandidate, setProfileCandidate] = useState<LoginProfileSummary | null>(null);
    const [approvingProfile, setApprovingProfile] = useState(false);
    const [verify, setVerify] = useState<{ username: string; password: string }>({ username: "", password: "" });
    const [verifyState, setVerifyState] = useState<"idle" | "running" | "ok" | "fail">("idle");
    const [verifyMsg, setVerifyMsg] = useState("");
    const [apiProbeResult, setApiProbeResult] = useState<{ ok: boolean; status: number; note: string } | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoError, setLogoError] = useState("");
    const { showToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();

    const fetchApps = useCallback(async () => {
        try {
            const response = await fetch(`/api/portal-apps?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setApps(data.data || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Gagal memuat portal apps:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchApps();
    }, [fetchApps]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            const url = editingApp ? `/api/portal-apps/${editingApp.id}` : "/api/portal-apps";
            const method = editingApp ? "PUT" : "POST";

            // Parse extraFields from JSON string to object
            let extraFieldsParsed = null;
            if (formData.extraFields && formData.extraFields.trim()) {
                try {
                    extraFieldsParsed = JSON.parse(formData.extraFields) as Record<string, string>;
                } catch {
                    setError("Extra Fields harus berformat JSON yang valid");
                    setIsSaving(false);
                    return;
                }
            }

            const body: Record<string, unknown> = {
                name: formData.name,
                slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
                description: formData.description || null,
                url: formData.url,
                loginUrl: formData.loginUrl || null,
                logoPath: formData.logoPath || null,
                ssoMode: formData.ssoMode,
                httpMethod: formData.httpMethod,
                usernameField: formData.usernameField || "username",
                passwordField: formData.passwordField || "password",
                extraFields: extraFieldsParsed,
                category: formData.category || null,
                isActive: formData.isActive,
                isPublic: formData.isPublic,
                displayOrder: Number(formData.displayOrder),
                detectionConfidence: formData.detectionConfidence,
                detectionSignals: formData.detectionSignals,
                detectionLayer: formData.detectionLayer,
                loginProfileId: formData.loginProfileId,
                loginProfileFingerprint: formData.loginProfileFingerprint,
            };

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.details && Array.isArray(data.details)) {
                    const messages = (data.details as { field: string; message: string }[])
                        .map((d) => `${d.field}: ${d.message}`).join(', ');
                    setError(`${data.error}: ${messages}`);
                } else {
                    setError(data.error || "Gagal menyimpan data");
                }
                return;
            }

            closeModal();
            fetchApps();
        } catch {
            setError("Terjadi kesalahan");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Reset agar memilih berkas yang sama dua kali tetap memicu onChange.
        e.target.value = "";
        if (!file) return;

        setLogoError("");
        setUploadingLogo(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) {
                setLogoError(data.error || "Gagal mengunggah gambar");
                return;
            }
            const path = data.url || data.path || data.filePath;
            if (!path) {
                setLogoError("Unggahan berhasil tetapi path gambar tidak diterima");
                return;
            }
            setFormData((p) => ({ ...p, logoPath: path }));
        } catch {
            setLogoError("Terjadi kesalahan jaringan saat mengunggah");
        } finally {
            setUploadingLogo(false);
        }
    };

    const updateLoginConfig = (patch: Partial<typeof emptyForm>) => {
        setFormData((previous) => ({
            ...previous,
            ...patch,
            // Mengedit target/field/mode secara manual tidak boleh tetap tampak
            // sebagai konfigurasi dari profile yang sebelumnya disetujui.
            loginProfileId: null,
            loginProfileFingerprint: null,
        }));
    };

    const applyProfile = (profile: LoginProfileSummary) => {
        setFormData((previous) => {
            // Profile hanya membawa nama field, bukan nilai hidden/token. Pertahankan
            // nilai yang sudah diketik admin dan tambahkan nama baru dengan nilai kosong;
            // runtime akan mengambil nilai live setelah profile bound.
            const extraFieldsByName: Record<string, string> = {};
            let canMergeExtraFields = true;
            if (previous.extraFields.trim()) {
                try {
                    const parsed: unknown = JSON.parse(previous.extraFields);
                    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                        canMergeExtraFields = false;
                    } else {
                        for (const [name, value] of Object.entries(parsed)) {
                            if (typeof value === "string") extraFieldsByName[name] = value;
                        }
                    }
                } catch {
                    canMergeExtraFields = false;
                }
            }
            if (canMergeExtraFields) {
                for (const rawName of profile.extraFieldNames) {
                    const name = rawName.trim();
                    // @json-api is a detector marker, not an HTML field.
                    if (name && name !== "@json-api" && !(name in extraFieldsByName)) {
                        extraFieldsByName[name] = "";
                    }
                }
            }

            return {
                ...previous,
                ssoMode: profile.recommendedMode ?? previous.ssoMode,
                httpMethod: profile.httpMethod === "GET" || profile.httpMethod === "POST"
                    ? profile.httpMethod
                    : previous.httpMethod,
                usernameField: profile.usernameField ?? previous.usernameField,
                passwordField: profile.passwordField ?? previous.passwordField,
                extraFields: canMergeExtraFields && Object.keys(extraFieldsByName).length > 0
                    ? JSON.stringify(extraFieldsByName, null, 2)
                    : previous.extraFields,
                detectionConfidence: profile.discoveryConfidence,
                detectionSignals: profile.discoverySignals,
                detectionLayer: profile.detectionLayer,
                apiLayer: profile.apiContracts.length > 0 ? "OPENAPI" : previous.apiLayer,
                apiContracts: profile.apiContracts.length > 0 ? profile.apiContracts : previous.apiContracts,
                loginProfileId: profile.id,
                loginProfileFingerprint: profile.currentFingerprint,
            };
        });
        setDetectMsg({
            type: "ok",
            text: "Profile disetujui telah diterapkan ke editor. Nama field diterapkan tanpa nilai live; simpan aplikasi untuk mengikat snapshot ini.",
        });
    };

    const handleApproveAndApplyProfile = async () => {
        if (!profileCandidate) return;
        setApprovingProfile(true);
        try {
            const response = await fetch(`/api/portal-login-profiles/${profileCandidate.id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fingerprint: profileCandidate.currentFingerprint }),
            });
            const data = await response.json();
            if (!response.ok || !data.profile) {
                setDetectMsg({ type: "err", text: data.error || "Gagal menyetujui profile deteksi." });
                return;
            }
            const approved = data.profile as LoginProfileSummary;
            setProfileCandidate(approved);
            applyProfile(approved);
        } catch {
            setDetectMsg({ type: "err", text: "Terjadi kesalahan jaringan saat menyetujui profile." });
        } finally {
            setApprovingProfile(false);
        }
    };

    const handleDetect = async () => {
        const target = (formData.loginUrl || "").trim();
        if (!target) {
            setDetectMsg({ type: "err", text: "Isi LOGIN URL terlebih dahulu." });
            return;
        }
        setDetecting(true);
        setDetectMsg(null);
        setProfileCandidate(null);
        try {
            const res = await fetch("/api/portal-apps/detect-fields", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: target }),
            });
            const data = await res.json();
            const detectedProfile = data.profile && typeof data.profile === "object"
                ? data.profile as LoginProfileSummary
                : null;
            if (detectedProfile) setProfileCandidate(detectedProfile);

            // Catatan lapis AI + hasil belajar dari koreksi sebelumnya (bila ada).
            const llm = data.llm && typeof data.llm === "object" ? data.llm : null;
            const llmNote = llm?.rationale
                ? `Analisis AI${llm.assisted ? " (dipakai sebagai hasil)" : ""}: ${String(llm.rationale)}${llm.loginApiEndpoint ? ` Endpoint JSON: ${llm.loginApiEndpoint}.` : ""}${llm.multiStep ? " Login dua langkah." : ""}`
                : undefined;
            // Alasan AI tidak berkontribusi (nonaktif/gagal) — jangan disembunyikan.
            const llmSkipNote = typeof data.llmNote === "string" && data.llmNote ? data.llmNote : undefined;
            const learned = data.learned && typeof data.learned === "object" ? data.learned : null;
            const learnedNote = learned
                ? `Hasil belajar dari koreksi admin sebelumnya di situs ini: user=${learned.usernameField ?? "-"}, pass=${learned.passwordField ?? "-"}, mode=${learned.ssoMode ?? "-"}.`
                : undefined;

            if (!res.ok) {
                // Tidak ada field yang terdeteksi bukan bukti bahwa konfigurasi yang
                // sedang diedit harus menjadi VAULT. Tampilan hanya memberi kandidat
                // yang perlu ditinjau dan tidak mengubah konfigurasi editor otomatis.
                const notes: string[] = Array.isArray(data.layerNotes) ? data.layerNotes : [];
                const apiContracts = Array.isArray(data.apiContracts)
                    ? (data.apiContracts as Array<{ method: string; path: string; params: string[] }>)
                    : [];
                const hasJsonLogin = data.apiLayer === "OPENAPI" && apiContracts.length > 0;

                if (hasJsonLogin) {
                    setFormData((prev) => ({
                        ...prev,
                        apiLayer: data.apiLayer,
                        apiContracts,
                    }));
                }

                const recommendation = data.recommendationReason
                    ? `Rekomendasi ${data.recommendedMode ?? "SSO"}: ${data.recommendationReason} Mode saat ini (${formData.ssoMode}) tidak diubah.`
                    : undefined;
                const apiNote = hasJsonLogin
                    ? `Kontrak login JSON terdeteksi: ${apiContracts.map((contract) => `${contract.method} ${contract.path}`).join(", ")}. Gunakan "Uji JSON"; mode saat ini tidak diubah otomatis.`
                    : data.apiProbeNote
                      ? String(data.apiProbeNote)
                      : undefined;
                setDetectMsg({
                    type: hasJsonLogin || Boolean(detectedProfile) ? "ok" : "err",
                    text: detectedProfile
                        ? "Kandidat profile ditemukan. Tinjau bukti lalu setujui sebelum menerapkannya."
                        : data.error || "Deteksi gagal",
                    warnings: [
                        ...(data.profilePersistenceWarning ? [String(data.profilePersistenceWarning)] : []),
                        ...(apiNote ? [apiNote] : []),
                        ...(llmNote ? [llmNote] : []),
                        ...(llmSkipNote ? [llmSkipNote] : []),
                        ...(learnedNote ? [learnedNote] : []),
                        ...(recommendation ? [recommendation] : []),
                        ...notes,
                    ],
                });
                return;
            }

            // Temuan tidak langsung ditulis ke konfigurasi. Admin harus meninjau
            // kandidat dan menekan "Setujui & terapkan" terlebih dahulu.
            setFormData((prev) => ({
                ...prev,
                detectionConfidence: data.detectionConfidence ?? prev.detectionConfidence,
                detectionSignals: data.detectionSignals ?? prev.detectionSignals,
                detectionLayer: data.detectionLayer ?? prev.detectionLayer,
                apiLayer: data.apiLayer ?? prev.apiLayer,
                apiContracts: data.apiContracts ?? prev.apiContracts,
            }));
            const detectedInfo = [
                data.usernameField ? `User: ${data.usernameField}` : null,
                data.passwordField ? `Pass: ${data.passwordField}` : null,
            ].filter(Boolean).join(" | ");

            const allWarnings = [
                ...(data.profilePersistenceWarning ? [String(data.profilePersistenceWarning)] : []),
                ...(data.warnings ?? []),
                ...(data.layerNotes ?? []),
                ...(llmNote ? [llmNote] : []),
                ...(llmSkipNote ? [llmSkipNote] : []),
                ...(learnedNote ? [learnedNote] : []),
            ];
            if (data.apiLayer === "OPENAPI" && Array.isArray(data.apiContracts) && data.apiContracts.length > 0) {
                const contracts = (data.apiContracts as Array<{ method: string; path: string }>).
                    map((contract) => `${contract.method} ${contract.path}`).join(", ");
                allWarnings.push(`Kontrak API JSON terdeteksi: ${contracts} — tombol "Uji JSON" tersedia`);
            }

            setDetectMsg({
                type: "ok",
                text: detectedProfile
                    ? "Kandidat profile ditemukan. Tinjau bukti lalu setujui sebelum menerapkannya."
                    : `Berhasil terdeteksi: ${detectedInfo}`,
                warnings: allWarnings.length ? allWarnings : undefined,
            });
        } catch {
            setDetectMsg({ type: "err", text: "Terjadi kesalahan saat deteksi." });
        } finally {
            setDetecting(false);
        }
    };

    const handleVerifyLogin = async (useJsonApi?: boolean) => {
        if (!formData.loginUrl) {
            setVerifyState("fail");
            setVerifyMsg("Isi LOGIN URL terlebih dahulu.");
            return;
        }
        if (!verify.username || !verify.password) {
            setVerifyState("fail");
            setVerifyMsg("Isi username dan password uji.");
            return;
        }
        setVerifyState("running");
        setVerifyMsg("");
        setApiProbeResult(null); // Reset API probe result
        try {
            // Build full payload with complete form snapshot (v2 requirement)
            const body: Record<string, unknown> = {
                url: formData.loginUrl,
                appId: editingApp?.id ?? undefined, // alur edit: hasil disimpan ke app (loginVerifiedAt)
                ssoMode: formData.ssoMode,         // v2: add ssoMode
                httpMethod: formData.httpMethod,   // v2: add httpMethod
                usernameField: formData.usernameField,
                passwordField: formData.passwordField,
                testUsername: verify.username,
                testPassword: verify.password,
            };

            // Parse extraFields from JSON string to object
            if (formData.extraFields && formData.extraFields.trim()) {
                try {
                    body.extraFields = JSON.parse(formData.extraFields) as Record<string, string>;
                } catch {
                    // Invalid JSON - skip extraFields
                }
            }

            // Add jsonApi probe when "Uji JSON" is clicked
            if (useJsonApi && formData.apiContracts && formData.apiContracts.length > 0) {
                // Use first contract's path for now
                const contract = formData.apiContracts[0];
                body.jsonApi = { path: contract.path };
            }

            const res = await fetch("/api/portal-apps/verify-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setVerifyState("fail");
                setVerifyMsg(data.error ?? "Uji login gagal");
                return;
            }
            setVerifyState(data.ok ? "ok" : "fail");
            setVerifyMsg(data.message);

            // Store apiProbe result if present (for "Uji JSON")
            if (data.apiProbe) {
                setApiProbeResult({
                    ok: data.apiProbe.ok,
                    status: data.apiProbe.status,
                    note: data.apiProbe.note,
                });
            }
        } catch {
            setVerifyState("fail");
            setVerifyMsg("Terjadi kesalahan jaringan");
        }
    };

    const handleDelete = async (app: PortalApp) => {
        if (!(await confirm({ title: "Hapus Aplikasi", message: `Hapus aplikasi "${app.name}"?`, variant: "danger" }))) return;

        try {
            const response = await fetch(`/api/portal-apps/${app.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json();
                showToast(data.error || "Gagal menghapus", "error");
                return;
            }
            fetchApps();
            showToast("Aplikasi berhasil dihapus", "success");
        } catch {
            showToast("Terjadi kesalahan", "error");
        }
    };

    const openAddModal = () => {
        setEditingApp(null);
        setFormData(emptyForm);
        setProfileCandidate(null);
        setApprovingProfile(false);
        setError("");
        setShowModal(true);
    };

    const openEditModal = (app: PortalApp) => {
        // Prisma Json? bisa datang sebagai object atau string (tergantung isi kolom).
        let extraFieldsFormatted = "";
        if (app.extraFields) {
            if (typeof app.extraFields === "object") {
                extraFieldsFormatted = JSON.stringify(app.extraFields, null, 2);
            } else if (typeof app.extraFields === "string") {
                try {
                    extraFieldsFormatted = JSON.stringify(JSON.parse(app.extraFields as string), null, 2);
                } catch {
                    extraFieldsFormatted = app.extraFields;
                }
            }
        }

        const profileContracts = app.loginProfile?.apiContracts ?? app.apiContracts ?? null;
        setEditingApp(app);
        setProfileCandidate(app.loginProfile ?? null);
        setApprovingProfile(false);
        setFormData({
            name: app.name,
            slug: app.slug,
            description: app.description || "",
            url: app.url,
            loginUrl: app.loginUrl || "",
            logoPath: app.logoPath || "",
            ssoMode: app.ssoMode,
            httpMethod: app.httpMethod,
            usernameField: app.usernameField || "",
            passwordField: app.passwordField || "",
            extraFields: extraFieldsFormatted,
            category: app.category || "",
            isActive: app.isActive,
            isPublic: app.isPublic ?? true,
            displayOrder: app.displayOrder,
            detectionConfidence: app.detectionConfidence ?? app.loginProfile?.discoveryConfidence ?? null,
            detectionSignals: app.detectionSignals ?? app.loginProfile?.discoverySignals ?? null,
            detectionLayer: app.detectionLayer ?? app.loginProfile?.detectionLayer ?? null,
            loginProfileId: app.loginProfileId ?? null,
            loginProfileFingerprint: app.loginProfileFingerprint ?? null,
            apiLayer: profileContracts?.length ? "OPENAPI" : app.apiLayer ?? null,
            apiContracts: profileContracts,
        });
        setError("");
        setShowModal(true);
    };

    // Helper: Check if current form differs from saved app (for "belum disimpan" warning)
    const isFormUnsaved = (): boolean => {
        if (!editingApp) return true; // never saved
        const keyFields = [
            ["url", formData.url, editingApp.url],
            ["loginUrl", formData.loginUrl, editingApp.loginUrl || ""],
            ["ssoMode", formData.ssoMode, editingApp.ssoMode],
            ["usernameField", formData.usernameField, editingApp.usernameField || ""],
            ["passwordField", formData.passwordField, editingApp.passwordField || ""],
            ["httpMethod", formData.httpMethod, editingApp.httpMethod],
            ["loginProfileId", formData.loginProfileId, editingApp.loginProfileId || null],
            ["loginProfileFingerprint", formData.loginProfileFingerprint, editingApp.loginProfileFingerprint || null],
        ] as const;
        
        for (const [, current, saved] of keyFields) {
            if (current !== saved) return true;
        }
        
        // Compare extraFields (normalize both to JSON string for comparison)
        let currentExtra: string;
        let savedExtra: string;
        
        if (formData.extraFields?.trim()) {
            try {
                currentExtra = JSON.stringify(JSON.parse(formData.extraFields));
            } catch {
                currentExtra = formData.extraFields;
            }
        } else {
            currentExtra = "";
        }
        
        if (editingApp.extraFields) {
            if (typeof editingApp.extraFields === "object") {
                savedExtra = JSON.stringify(editingApp.extraFields);
            } else {
                try {
                    savedExtra = JSON.stringify(JSON.parse(editingApp.extraFields));
                } catch {
                    savedExtra = editingApp.extraFields;
                }
            }
        } else {
            savedExtra = "";
        }
        
        return currentExtra !== savedExtra;
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingApp(null);
        setFormData(emptyForm);
        setProfileCandidate(null);
        setApprovingProfile(false);
        setError("");
        setApiProbeResult(null);
    };

    if (isLoading) {
        return (
            <div className="p-6">
                {/* Header skeleton */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-7 w-48 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div className="h-10 w-40 animate-pulse rounded bg-surface-2" />
                </div>

                {/* Stats skeleton */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-card border border-border p-4 shadow-lvl-1">
                            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface-2" />
                            <div className="h-7 w-12 animate-pulse rounded bg-surface-2" />
                        </div>
                    ))}
                </div>

                {/* Ledger-shaped skeleton */}
                <div className="rounded-card border border-border shadow-lvl-1">
                    <div className="flex gap-4 border-b border-border px-4 py-3">
                        <div className="h-3 w-32 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                    </div>
                    <div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
                                <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-24 animate-pulse rounded bg-surface-2" />
                                <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
                                <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
                                <div className="h-6 w-16 animate-pulse rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const activeCount = apps.filter(a => a.isActive).length;
    const inactiveCount = apps.filter(a => !a.isActive).length;

    const columns: TableColumn[] = [
        { key: "name", header: "NAMA" },
        { key: "slug", header: "SLUG" },
        { key: "health", header: "SERVER HEALTH" },
        { key: "category", header: "KATEGORI" },
        { key: "ssoMode", header: "SSO MODE" },
        { key: "visibility", header: "VISIBILITAS" },
        { key: "status", header: "STATUS" },
        { key: "order", header: "URUTAN" },
        { key: "actions", header: "AKSI" },
    ];

    const rows = apps.map((app) => [
        <div key="name" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-border bg-surface-2">
                <GridFour size={14} className="text-text-2" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-1">{app.name}</p>
                {app.description && (
                    <p className="max-w-48 truncate text-xs text-text-3">{app.description}</p>
                )}
            </div>
        </div>,
        <span key="slug" className="font-mono text-xs tabular-nums text-text-2">{app.slug}</span>,
        <div key="health" className="flex items-center gap-1.5 text-xs">
            {app.healthStatus === "ONLINE" && (
                <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 font-semibold text-success border border-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Online{app.healthLatencyMs ? ` (${app.healthLatencyMs}ms)` : ""}
                </span>
            )}
            {app.healthStatus === "DEGRADED" && (
                <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 font-semibold text-warning border border-warning/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    Lambat{app.healthLatencyMs ? ` (${app.healthLatencyMs}ms)` : ""}
                </span>
            )}
            {app.healthStatus === "OFFLINE" && (
                <span className="inline-flex items-center gap-1 rounded bg-danger px-2 py-0.5 font-bold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    Gangguan
                </span>
            )}
            {(!app.healthStatus || app.healthStatus === "UNKNOWN") && (
                <span className="text-text-3 text-xs">-</span>
            )}
        </div>,
        app.category ? (
            <Badge key="category" tone="info">{app.category}</Badge>
        ) : (
            <span key="category" className="text-xs text-text-3">-</span>
        ),
        <div key="ssoMode" className="flex flex-col items-start gap-1">
            <Badge tone="neutral">{app.ssoMode}</Badge>
            {app.loginFormChanged && (
                <Badge tone="warning">Form berubah</Badge>
            )}
            {app.loginProfile?.state === "STALE" && (
                <Badge tone="warning">Profile perlu review</Badge>
            )}
            {app.loginProfile && app.loginProfile.state !== "STALE" && (
                <Badge tone={app.loginProfile.approvalStatus === "APPROVED" ? "info" : "neutral"}>
                    {app.loginProfile.approvalStatus === "APPROVED" ? "Profile disetujui" : "Profile pending"}
                </Badge>
            )}
            {(app.ssoFailure24h ?? 0) >= 3 && (
                <Badge tone="danger">Gagal ×{app.ssoFailure24h}/24h</Badge>
            )}
        </div>,
        app.isPublic ? (
            <Badge key="visibility" tone="success">Publik</Badge>
        ) : (
            <Badge key="visibility" tone="neutral">
                <LockKey size={12} aria-hidden="true" />
                Terbatas
            </Badge>
        ),
        <Badge key="status" tone={app.isActive ? "success" : "neutral"}>
            {app.isActive ? "AKTIF" : "NONAKTIF"}
        </Badge>,
        <span key="order" className="font-mono text-xs tabular-nums text-text-2">{app.displayOrder}</span>,
        <div key="actions" className="inline-flex items-center gap-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openEditModal(app)}
                aria-label="Edit"
                title="Edit"
            >
                <PencilSimple size={14} />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(app)}
                aria-label="Hapus"
                title="Hapus"
                className="text-danger"
            >
                <Trash size={14} />
            </Button>
        </div>,
    ]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-text-1">Aplikasi Portal</h1>
                </div>
                <Button type="button" iconLeft={<Plus size={14} aria-hidden="true" />} onClick={openAddModal}>
                    Tambah Aplikasi
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">TOTAL APLIKASI</p>
                    <p className="font-display text-2xl font-semibold text-text-1">{pagination?.total || apps.length}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">AKTIF</p>
                    <p className="font-display text-2xl font-semibold text-success">{activeCount}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-1 text-sm text-text-3">NONAKTIF</p>
                    <p className="font-display text-2xl font-semibold text-danger">{inactiveCount}</p>
                </Card>
            </div>

            {/* Table */}
            {apps.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-card border border-border p-12 text-center shadow-lvl-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
                        <GridFour size={24} className="text-text-3" aria-hidden="true" />
                    </div>
                    <p className="text-text-3">Belum ada aplikasi.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-card border border-border bg-surface-1 shadow-lvl-1">
                    <Table
                        columns={columns}
                        rows={rows}
                        ariaLabel="Daftar aplikasi portal"
                    />
                </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-xs tabular-nums text-text-3">
                        {((pagination.page - 1) * pagination.limit) + 1}–
                        {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            aria-label="Halaman sebelumnya"
                        >
                            <CaretLeft size={14} aria-hidden="true" />
                        </Button>
                        <span className="font-mono text-xs tabular-nums text-text-2">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPage(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            aria-label="Halaman berikutnya"
                        >
                            <CaretRight size={14} aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal — shell (portal, focus trap, Escape, kunci scroll) dari kit */}
            <Modal
                open={showModal}
                onClose={closeModal}
                title={editingApp ? "Edit Aplikasi" : "Tambah Aplikasi"}
                size="lg"
            >
                        {error && (
                            <div
                                className="mb-4 rounded-control border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                                role="alert"
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="NAMA *"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                <Input
                                    label="SLUG *"
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    required
                                />
                            </div>

                            <Input
                                label="DESKRIPSI"
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />

                            {/* Logo aplikasi — membantu user mengenali app dan tidak salah masuk halaman */}
                            <div>
                                <span className="mb-2 block text-sm font-semibold text-text-1">LOGO APLIKASI</span>
                                <div className="flex items-center gap-4">
                                    {formData.logoPath ? (
                                        <Image
                                            width={64}
                                            height={64}
                                            src={formData.logoPath}
                                            alt="Pratinjau logo"
                                            className="h-16 w-16 shrink-0 rounded-card border border-border object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card border border-dashed border-border bg-surface-2 text-xl font-bold text-text-3">
                                            {formData.name.charAt(0).toUpperCase() || "?"}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap gap-2">
                                            <label
                                                className={`${buttonClasses({ variant: "secondary", size: "sm" })} cursor-pointer`}
                                            >
                                                {uploadingLogo ? "Mengunggah..." : "Pilih Gambar"}
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                                    className="hidden"
                                                    disabled={uploadingLogo}
                                                    onChange={handleLogoUpload}
                                                />
                                            </label>
                                            {formData.logoPath && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setFormData((p) => ({ ...p, logoPath: "" }))}
                                                >
                                                    Hapus
                                                </Button>
                                            )}
                                        </div>
                                        {logoError ? (
                                            <p className="mt-2 text-xs text-danger">{logoError}</p>
                                        ) : (
                                            <p className="mt-2 text-xs text-text-3">
                                                PNG, JPG, WebP, atau GIF. Maks 10MB.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="URL *"
                                    type="text"
                                    value={formData.url}
                                    onChange={(e) => updateLoginConfig({ url: e.target.value })}
                                    required
                                    placeholder="https://app.example.com"
                                />
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-text-1">LOGIN URL</span>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleDetect}
                                            disabled={detecting}
                                        >
                                            {detecting ? "Mendeteksi..." : "Deteksi Otomatis"}
                                        </Button>
                                    </div>
                                    <Input
                                        type="text"
                                        value={formData.loginUrl}
                                        onChange={(e) => updateLoginConfig({ loginUrl: e.target.value })}
                                        placeholder="https://app.example.com/login"
                                    />
                                    {detectMsg && (
                                        <div className="mt-1 space-y-1" aria-live="polite">
                                            <p className={`text-xs ${detectMsg.type === "ok" ? "text-success" : "text-danger"}`}>
                                                {detectMsg.text}
                                            </p>
                                            {detectMsg.warnings?.map((w, i) => (
                                                <p key={i} className="text-xs text-warning">
                                                    ⚠ {w}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    {detectMsg?.type === "ok" && formData.detectionLayer ? (
                                        <div className="mt-3 rounded-card border border-border bg-surface-2 p-3 text-xs text-text-2">
                                            <p className="font-medium text-text-1">Bukti deteksi</p>
                                            <p>
                                                Lapis: {formData.detectionLayer} · Confidence: {formData.detectionConfidence ?? "-"}
                                            </p>
                                            {Array.isArray(formData.detectionSignals) && formData.detectionSignals.length > 0 && (
                                                <ul className="mt-1 list-inside list-disc">
                                                    {formData.detectionSignals.map((s) => (
                                                        <li key={s}>{s}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {profileCandidate && (
                                <LoginProfileReview
                                    profile={profileCandidate}
                                    isApproving={approvingProfile}
                                    onApproveAndApply={handleApproveAndApplyProfile}
                                    onApply={() => applyProfile(profileCandidate)}
                                />
                            )}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <Select
                                        label="SSO MODE"
                                        value={formData.ssoMode}
                                        onChange={(e) => updateLoginConfig({ ssoMode: e.target.value })}
                                        options={[
                                            // Label guardrail TASK-14: REDIRECT aktif
                                            // (tanpa penanda); PROXY/TOKEN belum siap.
                                            { value: "FORM", label: "FORM" },
                                            { value: "REDIRECT", label: "REDIRECT" },
                                            { value: "PROXY", label: "PROXY (nonaktif)" },
                                            { value: "TOKEN", label: "TOKEN (tertunda konsumen)" },
                                            { value: "REROUTE", label: "REROUTE" },
                                            { value: "VAULT", label: "VAULT" },
                                            { value: "POST", label: "POST (relay server)" },
                                        ]}
                                    />
                                    {/* Helper text per-mode — 1 kalimat, token-native. */}
                                    <p className="mt-1.5 text-xs leading-relaxed text-text-3">
                                        {SSO_MODE_HINT[formData.ssoMode]}
                                    </p>
                                </div>
                                <Select
                                    label="HTTP METHOD"
                                    value={formData.httpMethod}
                                    onChange={(e) => updateLoginConfig({ httpMethod: e.target.value })}
                                    options={[
                                        { value: "POST", label: "POST" },
                                        { value: "GET", label: "GET" },
                                    ]}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="USERNAME FIELD"
                                    type="text"
                                    value={formData.usernameField}
                                    onChange={(e) => updateLoginConfig({ usernameField: e.target.value })}
                                    placeholder="username"
                                />
                                <Input
                                    label="PASSWORD FIELD"
                                    type="text"
                                    value={formData.passwordField}
                                    onChange={(e) => updateLoginConfig({ passwordField: e.target.value })}
                                    placeholder="password"
                                />
                            </div>

                            <div>
                                <span className="mb-2 block text-sm font-semibold text-text-1">EXTRA FIELDS (JSON)</span>
                                <textarea
                                    value={formData.extraFields}
                                    onChange={(e) => updateLoginConfig({ extraFields: e.target.value })}
                                    placeholder='{"key": "value"}'
                                    rows={3}
                                    className="w-full resize-y rounded-control border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                />
                            </div>

                            <div className="rounded-card border border-border bg-surface-2 p-3">
                                <p className="mb-2 text-sm font-medium text-text-1">Uji Login sebelum simpan</p>
                                {isFormUnsaved() && (
                                    <p className="mb-2 text-xs font-medium text-warning">
                                        ⚠ menggunakan konfigurasi belum disimpan
                                    </p>
                                )}
                                <div className="grid gap-2">
                                    <input
                                        type="text" placeholder="Username uji"
                                        value={verify.username}
                                        onChange={(e) => setVerify({ ...verify, username: e.target.value })}
                                        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                                        className="w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    />
                                    <input
                                        type="password" placeholder="Password uji"
                                        value={verify.password}
                                        onChange={(e) => setVerify({ ...verify, password: e.target.value })}
                                        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                                        className="w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    />
                                    <button
                                        type="button" onClick={() => handleVerifyLogin(false)} disabled={verifyState === "running"}
                                        className="inline-flex h-9 items-center justify-center rounded-control border border-border px-3 text-sm font-medium text-text-1 hover:bg-surface-3 disabled:opacity-50"
                                    >
                                        {verifyState === "running" ? "Menguji..." : "Uji Login"}
                                    </button>
                                    {/* Uji JSON button - only show when apiLayer is OPENAPI */}
                                    {formData.apiLayer === "OPENAPI" && formData.apiContracts && formData.apiContracts.length > 0 && (
                                        <button
                                            type="button" onClick={() => handleVerifyLogin(true)} disabled={verifyState === "running"}
                                            className="inline-flex h-9 items-center justify-center rounded-control border border-border px-3 text-sm font-medium text-text-1 hover:bg-surface-3 disabled:opacity-50"
                                        >
                                            {verifyState === "running" ? "Menguji..." : "Uji JSON"}
                                        </button>
                                    )}
                                </div>
                                {verifyMsg && (
                                    <p className={`mt-2 text-sm ${verifyState === "ok" ? "text-success" : "text-warning"}`}>
                                        {verifyMsg}
                                    </p>
                                )}
                                {/* API probe result */}
                                {apiProbeResult && (
                                    <div className={`mt-2 rounded border p-2 text-xs ${apiProbeResult.ok ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
                                        <p className="font-medium">
                                            API Probe {apiProbeResult.ok ? "✓ OK" : "⚠ Warning"} (Status: {apiProbeResult.status})
                                        </p>
                                        <p className="mt-1 text-text-2">{apiProbeResult.note}</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <Input
                                    label="KATEGORI"
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                />
                                <Input
                                    label="URUTAN"
                                    type="number"
                                    value={formData.displayOrder}
                                    onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                                />
                                <div className="flex flex-col justify-end gap-2 pb-1">
                                    <label className="flex items-center gap-2 text-sm text-text-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="h-4 w-4 cursor-pointer accent-accent"
                                        />
                                        Aktif
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 text-sm text-text-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.isPublic}
                                            onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                                            className="h-4 w-4 cursor-pointer accent-accent"
                                        />
                                        <span>Publik (berlaku untuk semua pengguna)</span>
                                    </label>
                                    <span className="text-xs text-text-3">
                                        — kosongkan untuk restricted (hanya user/grup berhak akses)
                                    </span>
                                </div>
                            </div>

                            {/* Aksi tetap di dalam <form> agar type="submit" bekerja. */}
                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={closeModal}
                                    disabled={isSaving}
                                >
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? "Menyimpan..." : "Simpan"}
                                </Button>
                            </div>
                        </form>
            </Modal>
            <ConfirmDialog />
        </div>
    );
}