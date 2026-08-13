"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ArrowClockwise,
    DownloadSimple,
    EnvelopeSimple,
    MagnifyingGlass,
} from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

interface Subscriber {
    id: string;
    email: string;
    name: string | null;
    source: string;
    isActive: boolean;
    subscribedAt: string;
    unsubscribedAt: string | null;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function NewsletterPage() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [activeOnly, setActiveOnly] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchSubscribers = useCallback(async () => {
        setIsLoading(true);
        try {
            let url = `/api/newsletter?page=${page}&limit=50`;
            if (activeOnly) url += "&active=true";

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setSubscribers(data.data || []);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to fetch subscribers:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page, activeOnly]);

    useEffect(() => {
        fetchSubscribers();
    }, [fetchSubscribers]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const handleExport = () => {
        const activeSubscribers = subscribers.filter((s) => s.isActive);
        const csv = [
            ["Email", "Name", "Source", "Subscribed Date"].join(","),
            ...activeSubscribers.map((s) => [
                s.email,
                s.name || "",
                s.source,
                formatDate(s.subscribedAt),
            ].join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const filteredSubscribers = subscribers.filter((s) =>
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading && subscribers.length === 0) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-8">
                <p className="text-text-3">Memuat subscriber...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px] p-6 md:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-accent">NEWSLETTER</p>
                    <h1 className="font-display text-2xl font-bold text-text-1">Subscriber</h1>
                    <p className="mt-1 text-sm text-text-3">Kelola daftar penerima newsletter situs.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        iconLeft={<ArrowClockwise size={16} />}
                        onClick={() => fetchSubscribers()}
                    >
                        Segarkan
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        iconLeft={<DownloadSimple size={16} />}
                        onClick={handleExport}
                    >
                        Ekspor CSV
                    </Button>
                </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="p-4">
                    <p className="mb-2 text-xs font-medium text-text-3">TOTAL SUBSCRIBER</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums text-text-1">{pagination?.total || 0}</p>
                </Card>
                <Card className="p-4">
                    <p className="mb-2 text-xs font-medium text-text-3">AKTIF</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums text-success">
                        {subscribers.filter((s) => s.isActive).length}
                    </p>
                </Card>
                <Card className="p-4">
                    <p className="mb-2 text-xs font-medium text-text-3">TIDAK AKTIF</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums text-danger">
                        {subscribers.filter((s) => !s.isActive).length}
                    </p>
                </Card>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative max-w-xl flex-1">
                    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" size={16} />
                    <Input
                        type="text"
                        aria-label="Cari subscriber"
                        placeholder="Cari email atau nama..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-border bg-surface-1 px-3 text-sm text-text-2">
                    <input
                        type="checkbox"
                        checked={activeOnly}
                        onChange={(e) => setActiveOnly(e.target.checked)}
                        className="h-4 w-4 accent-accent"
                    />
                    Aktif saja
                </label>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-sm" aria-label="Daftar subscriber newsletter">
                        <thead>
                            <tr className="border-b border-border bg-surface-2">
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-3">EMAIL</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-3">NAMA</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-3">SUMBER</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-3">BERLANGGANAN</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-text-3">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubscribers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-14 text-center">
                                        <EnvelopeSimple size={30} className="mx-auto mb-3 text-text-3" />
                                        <p className="text-sm text-text-2">Tidak ada subscriber yang ditemukan.</p>
                                        {searchTerm && <p className="mt-1 text-xs text-text-3">Coba ubah kata kunci pencarian.</p>}
                                    </td>
                                </tr>
                            ) : (
                                filteredSubscribers.map((subscriber) => (
                                    <tr key={subscriber.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm tabular-nums text-text-1">
                                            {subscriber.email}
                                        </td>
                                        <td className="px-4 py-3 text-text-2">{subscriber.name || "—"}</td>
                                        <td className="px-4 py-3">
                                            <Badge tone="neutral">{subscriber.source}</Badge>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-text-2">
                                            {formatDate(subscriber.subscribedAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge tone={subscriber.isActive ? "success" : "danger"}>
                                                {subscriber.isActive ? "Aktif" : "Tidak aktif"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <Button
                            key={p}
                            type="button"
                            variant={p === page ? "primary" : "secondary"}
                            size="sm"
                            onClick={() => setPage(p)}
                            aria-label={`Halaman ${p}`}
                            aria-current={p === page ? "page" : undefined}
                        >
                            <span className="font-mono tabular-nums">{p}</span>
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}
