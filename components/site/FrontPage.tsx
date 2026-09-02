"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
    CaretLeft,
    CaretRight,
    Pause,
    Play,
    SpeakerHigh,
    SpeakerSlash,
} from "@phosphor-icons/react";
import { extractYoutubeId, formatDateShort, readingTimeLabel } from "@/lib/utils";

/**
 * FrontPage — "halaman depan koran" dengan rotasi otomatis 5 detik:
 * lead story bergilir dari pool hero (parameter lama: hero sebelum rework).
 * Pause saat hover/focus keyboard, mati total di prefers-reduced-motion,
 * tombol jeda eksplisit (WCAG 2.2.2). Video & YouTube autoplay muted
 * persis perilaku FullscreenHero lama.
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

const ROTATE_MS = 5000;

function storyThumb(story: FrontStory): { image: string | null; youtube: boolean; videoOnly: boolean } {
    if (story.imagePath) return { image: story.imagePath, youtube: false, videoOnly: false };
    const ytId = story.youtubeUrl ? extractYoutubeId(story.youtubeUrl) : null;
    if (story.videoType === "youtube" && ytId) {
        return { image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, youtube: true, videoOnly: false };
    }
    return { image: null, youtube: false, videoOnly: !!story.videoPath };
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
    stories,
}: {
    siteSlug: string;
    stories: FrontStory[];
}) {
    const count = stories.length;
    const [index, setIndex] = useState(0);
    const [userPaused, setUserPaused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [muted, setMuted] = useState(true);

    // Rotasi otomatis — berhenti saat di-hover, dijeda manual, satu story
    // saja, atau pengguna meminta pengurangan gerak.
    useEffect(() => {
        if (userPaused || hovered || count <= 1) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
        return () => clearInterval(timer);
    }, [userPaused, hovered, count]);

    if (count === 0) return null;

    const lead = stories[index];
    // Story sekunder = 3 story berikutnya dalam urutan rotasi (wrap-around).
    const secondary = Array.from({ length: Math.min(3, count - 1) }, (_, o) => stories[(index + 1 + o) % count]);

    const leadYoutubeId = lead.videoType === "youtube" ? extractYoutubeId(lead.youtubeUrl ?? "") : null;
    const hasVideo = !!lead.videoPath || !!leadYoutubeId;

    return (
        <section
            aria-label="Kabar utama"
            aria-roledescription="karosel"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="border-b border-border"
        >
            <div className="mx-auto grid max-w-[1200px] gap-8 px-6 py-8 lg:grid-cols-12">
                {/* Lead story — remount per slide supaya koreografi entrance
                    berjalan ulang setiap pergantian (pola FullscreenHero lama). */}
                <div key={lead.id} className="lg:col-span-8" style={{ animation: "cine-rise var(--motion-slow) var(--motion-ease) both" }}>
                    <Link href={`/site/${siteSlug}/${lead.slug}`} className="group block">
                        {/* Media — video/YouTube autoplay muted saat jadi lead */}
                        <div className="relative aspect-[16/9] overflow-hidden bg-surface-2" style={{ animation: "cine-fade-in var(--motion-standard) var(--motion-ease) both" }}>
                            {leadYoutubeId ? (
                                <iframe
                                    title={`Video: ${lead.title}`}
                                    src={`https://www.youtube.com/embed/${leadYoutubeId}?autoplay=1&mute=1&loop=1&playlist=${leadYoutubeId}&playsinline=1&rel=0&modestbranding=1`}
                                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                                    tabIndex={-1}
                                    className="absolute inset-0 h-full w-full border-0 object-cover"
                                />
                            ) : lead.videoPath ? (
                                <video
                                    src={lead.videoPath}
                                    autoPlay
                                    loop
                                    muted={muted}
                                    playsInline
                                    className="absolute inset-0 h-full w-full object-cover"
                                    aria-label={`Video: ${lead.title}`}
                                />
                            ) : lead.imagePath ? (
                                <Image
                                    src={lead.imagePath}
                                    alt={lead.title}
                                    fill
                                    sizes="(min-width: 1024px) 66vw, 100vw"
                                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                />
                            ) : (
                                <div aria-hidden="true" className="h-full w-full bg-surface-2" />
                            )}
                        </div>

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

                    {/* Kontrol rotasi — di bawah meta, sejajar dengan teks lead */}
                    {count > 1 && (
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setUserPaused((p) => !p)}
                                aria-pressed={userPaused}
                                aria-label={userPaused ? "Putar rotasi otomatis" : "Jeda rotasi otomatis"}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-text-2 transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                {userPaused ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIndex((i) => (i - 1 + count) % count)}
                                aria-label="Kabar utama sebelumnya"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-text-2 transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                <CaretLeft size={16} weight="bold" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIndex((i) => (i + 1) % count)}
                                aria-label="Kabar utama berikutnya"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-text-2 transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                                <CaretRight size={16} weight="bold" />
                            </button>
                            {lead.videoPath && !leadYoutubeId && (
                                <button
                                    type="button"
                                    onClick={() => setMuted((m) => !m)}
                                    aria-label={muted ? "Aktifkan suara video" : "Bisukan suara video"}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-text-2 transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                >
                                    {muted ? <SpeakerSlash size={16} /> : <SpeakerHigh size={16} />}
                                </button>
                            )}
                            <div aria-label="Pilih kabar utama" className="ml-1 flex items-center gap-1.5">
                                {stories.map((s, i) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setIndex(i)}
                                        aria-label={`Kabar utama ${i + 1}: ${s.title}`}
                                        aria-current={i === index ? "true" : undefined}
                                        className="group flex h-8 items-center px-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="block h-1 rounded-full transition-all duration-300"
                                            style={{
                                                width: i === index ? "24px" : "8px",
                                                backgroundColor: i === index ? "var(--accent)" : "var(--surface-3)",
                                                transitionTimingFunction: "var(--motion-ease)",
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Story sekunder — 3 story berikutnya dalam urutan rotasi */}
                {secondary.length > 0 && (
                    <div className="flex flex-col divide-y divide-border lg:col-span-4">
                        {secondary.map((story, i) => {
                            const { image, youtube, videoOnly } = storyThumb(story);
                            const isVideo = !!story.videoPath || story.videoType === "youtube";
                            return (
                                <Link
                                    key={story.id}
                                    href={`/site/${siteSlug}/${story.slug}`}
                                    className="group flex gap-4 py-4 first:pt-0 last:pb-0"
                                    style={{ animation: `cine-rise var(--motion-slow) var(--motion-ease) ${150 + i * 90}ms both` }}
                                >
                                    <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden bg-surface-2">
                                        {image ? (
                                            <Image
                                                src={image}
                                                alt={story.title}
                                                fill
                                                sizes="112px"
                                                unoptimized={youtube}
                                                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
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
                                        {isVideo && (image || videoOnly) && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent"
                                            >
                                                <Play size={14} weight="fill" style={{ color: "var(--site-text-on-primary)" }} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-serif text-body font-bold leading-snug text-text-1 line-clamp-2 group-hover:text-accent">
                                            {story.title}
                                        </h3>
                                        <StoryMeta story={story} className="mt-1.5" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* Penanda video aktif — kontras aksesibel untuk screen reader */}
            {hasVideo && <span className="sr-only">Kabar utama saat ini berisi video yang diputar otomatis tanpa suara.</span>}
        </section>
    );
}
