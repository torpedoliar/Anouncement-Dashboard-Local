/**
 * Masthead — nameplate koran untuk halaman depan site publik.
 * Nama site dalam serif besar di antara garis ganda. Tanggal & edisi kini di
 * EditionStrip (klien, jam perangkat).
 */
export default function Masthead({
    siteName,
    tagline,
}: {
    siteName: string;
    tagline?: string | null;
}) {
    return (
        <header className="masthead border-b-[3px] border-double border-border">
            <div className="mx-auto max-w-[1200px] px-6 pb-6 pt-8 text-center">
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
