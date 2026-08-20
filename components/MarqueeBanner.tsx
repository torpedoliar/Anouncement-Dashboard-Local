/**
 * Banner berjalan (marquee) — strip teks yang memutar di puncak halaman site.
 * Diatur per-site lewat SiteSettings (bannerText + bannerEnabled) oleh admin.
 * Track memuat 3 salinan agar animasi translateX(-33.333%) menyambung tanpa loncatan.
 */
export default function MarqueeBanner({ text }: { text: string }) {
    const t = text.trim();
    if (!t) return null;
    return (
        <div className="marquee-wrap" role="region" aria-label="Pengumuman berjalan">
            <div className="marquee-track">
                {[0, 1, 2].map((i) => (
                    <span key={i} className="marquee-item">
                        <span aria-hidden="true" className="mr-2">
                            ★
                        </span>
                        {t}
                    </span>
                ))}
            </div>
        </div>
    );
}