"use client";

import { useState, useRef, useEffect } from "react";
import { FiVolume2, FiVolumeX, FiPlay, FiPause } from "react-icons/fi";

interface ArticleVideoPlayerProps {
    videoPath?: string | null;
    youtubeUrl?: string | null;
    title: string;
}

// Extract YouTube video ID
const extractYoutubeId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

export default function ArticleVideoPlayer({ videoPath, youtubeUrl, title }: ArticleVideoPlayerProps) {
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // Autoplay when component mounts
        if (videoRef.current) {
            videoRef.current.play().catch(() => {
                // Autoplay blocked, user needs to interact
            });
        }
    }, []);

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
        }
        setIsMuted(!isMuted);
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;

    // YouTube Video
    if (youtubeId) {
        return (
            <>
                <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&rel=0`}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={title}
                />
            </>
        );
    }

    // Uploaded Video
    if (videoPath) {
        return (
            <>
                <video
                    ref={videoRef}
                    src={videoPath}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    onClick={togglePlay}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                    }}
                />
                {/* Video Controls */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    right: '24px',
                    display: 'flex',
                    gap: '12px',
                    zIndex: 20,
                }}>
                    <button
                        onClick={togglePlay}
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: '1px solid #404040',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} />}
                    </button>
                    <button
                        onClick={toggleMute}
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: '1px solid #404040',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <FiVolumeX size={20} /> : <FiVolume2 size={20} />}
                    </button>
                </div>
            </>
        );
    }

    return null;
}
