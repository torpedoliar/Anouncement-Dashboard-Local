interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    /** dashed = area kosong belum berisi; solid = hasil filter/pencarian kosong */
    variant?: "dashed" | "solid";
}

/**
 * Empty state bersama untuk halaman admin. Sebelumnya tiap halaman menulis
 * blok "Belum ada X" sendiri dengan gaya berbeda-beda.
 */
export default function EmptyState({
    icon,
    title,
    description,
    action,
    variant = "dashed",
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center rounded-card bg-surface-1 py-16 text-center ${
                variant === "dashed" ? "border-2 border-dashed border-border-strong" : "border border-border"
            }`}
        >
            {icon && (
                <div className="mb-4 text-text-3 [&>svg]:h-12 [&>svg]:w-12" aria-hidden="true">
                    {icon}
                </div>
            )}
            <p className="text-sm font-medium text-text-2">{title}</p>
            {description && <p className="mt-1 max-w-sm text-xs text-text-3">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
