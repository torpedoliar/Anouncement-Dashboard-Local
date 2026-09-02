import Link from "next/link";
import Image from "next/image";
import { Play, YoutubeLogo } from "@/components/ui/client-icons";
import { extractYoutubeId, formatDateShort, readingTimeLabel } from "@/lib/utils";

/**
 * FrontPage — "halaman depan koran": satu lead story besar + deretan story
 * sekunder. Menggantikan carousel hero: semua konten tampak sekaligus, tanpa
 * timer, tanpa JS. Server component murni.
 */

export interface FrontStory {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    imagePath: string | null;
    videoPath: string | null;
    videoType: string | null;
    youtubeUrl: string | null;
    wordCount: number;
    category: { name: string; color: string };
    createdAt: Date | string;
}

function storyThumb(story: FrontStory): { image: string | null; youtube: boolean; videoOnly: boolean } {
    if (story.imagePath) return { image: story.imagePath, youtube: false, videoOnly: false };
    const ytId = story.youtubeUrl ? extractYoutubeId(story.youtubeUrl) : null;
    if (story.videoType === "youtube" && ytId) {
        return { image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, youtube: true, videoOnly: false };
    }
    return { image: null, youtube: false, videoOnly: !!story.videoPath };
}

function Media({
    story,
    sizes,
    className = "",
}: {
    story: FrontStory;
    sizes: string;
    className?: string;
}) {
    const { image, youtube, videoOnly } = storyThumb(story);
    const hasVideo = !!story.videoPath || story.videoType === "youtube";

    return (
        <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
            {image ? (
                <Image
                    src={image}
                    alt={story.title}
                    fill
                    sizes={sizes}
                    unoptimized={youtube}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
            ) : videoOnly ? (
                <video
                    src={story.videoPath!}
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={`Video: ${story.title}`}
                    className="h-full w-full object-cover"
                />
            ) : (
                <div aria-hidden="true" className="h-full w-full bg-surface-2" />
            )}
            {hasVideo && (image || videoOnly) && (
                <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent"
                >
                    {story.videoType === "youtube" ? (
                        <YoutubeLogo size={20} style={{ color: "var(--site-text-on-primary)" }} />
                    ) : (
                        <Play size={20} weight="fill" style={{ color: "var(--site-text-on-primary)" }} />
                    )}
                </span>
            )}
        </div>
    );
}

function StoryMeta({ story, className = "" }: { story: FrontStory; className?: string }) {
    return (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-caption ${className}`}>
            <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.08em] text-text-2">
                <span aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: story.category.color }} />
                {story.category.name}
            </span>
            <span className="font-mono tabular-nums text-text-3">
                {formatDateShort(story.createdAt)} · {readingTimeLabel(story.wordCount)}
            </span>
        </div>
    );
}

export default function FrontPage({
    siteSlug,
    lead,
    secondary,
}: {
    siteSlug: string;
    lead: FrontStory;
    secondary: FrontStory[];
}) {
    return (
        <section aria-label="Kabar utama" className="border-b border-border">
            <div className="mx-auto grid max-w-[1200px] gap-8 px-6 py-8 lg:grid-cols-12">
                {/* Lead story */}
                <Link
                    href={`/site/${siteSlug}/${lead.slug}`}
                    className="group lg:col-span-8"
                    style={{ animation: "cine-rise var(--motion-slow) var(--motion-ease) 150ms both" }}
                >
                    <Media story={lead} sizes="(min-width: 1024px) 66vw, 100vw" className="aspect-[16/9]" />
                    <div className="mt-4">
                        <StoryMeta story={lead} className="mb-2" />
                        <h2 className="font-serif text-title font-bold text-text-1 underline-offset-4 group-hover:underline md:text-display">
                            {lead.title}
                        </h2>
                        {lead.excerpt && (
                            <p className="mt-2 max-w-[68ch] text-body leading-relaxed text-text-2 line-clamp-2">
                                {lead.excerpt}
                            </p>
                        )}
                    </div>
                </Link>

                {/* Story sekunder */}
                {secondary.length > 0 && (
                    <div className="flex flex-col divide-y divide-border lg:col-span-4">
                        {secondary.map((story, i) => (
                            <Link
                                key={story.id}
                                href={`/site/${siteSlug}/${story.slug}`}
                                className="group flex gap-4 py-4 first:pt-0 last:pb-0"
                                style={{
                                    animation: `cine-rise var(--motion-slow) var(--motion-ease) ${250 + i * 90}ms both`,
                                }}
                            >
                                <Media
                                    story={story}
                                    sizes="112px"
                                    className="aspect-[4/3] w-28 shrink-0"
                                />
                                <div className="min-w-0">
                                    <h3 className="font-serif text-body font-bold leading-snug text-text-1 line-clamp-2 group-hover:text-accent">
                                        {story.title}
                                    </h3>
                                    <StoryMeta story={story} className="mt-1.5" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
