/**
 * Masthead — nameplate koran untuk halaman depan site publik.
 * Nama site dalam serif besar di antara garis ganda, dengan baris edisi
 * (tanggal hari ini) di atasnya. Server component; tanggal di-render server
 * (halaman sudah force-dynamic, jadi selalu segar).
 */
export default function Masthead({
    siteName,
    tagline,
}: {
    siteName: string;
    tagline?: string | null;
}) {
    const edition = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    return (
        <header className="masthead">
            <div className="mx-auto max-w-[1200px] px-6 pb-6 pt-10 text-center">
                <p className="font-mono text-caption uppercase tracking-[0.25em] text-text-3 animate-[cine-fade-in_var(--motion-standard)_var(--motion-ease)_both]">
                    {edition}
                </p>
                <h1 className="mt-3 font-serif text-[clamp(2.25rem,6vw,4rem)] font-bold leading-[1.05] tracking-[-0.015em] text-text-1 animate-[cine-rise_var(--motion-slow)_var(--motion-ease)_120ms_both]">
                    {siteName}
                </h1>
                {tagline ? (
                    <p className="mx-auto mt-3 max-w-[560px] text-small text-text-2 animate-[cine-fade-in_var(--motion-standard)_var(--motion-ease)_300ms_both]">
                        {tagline}
                    </p>
                ) : null}
            </div>
        </header>
    );
}
