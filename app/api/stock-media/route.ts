import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_BASE_URL = "https://api.pexels.com";

interface PexelsPhoto {
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url: string;
    src: {
        original: string;
        large2x: string;
        large: string;
        medium: string;
        small: string;
        portrait: string;
        landscape: string;
        tiny: string;
    };
    alt: string;
}

interface PexelsVideo {
    id: number;
    width: number;
    height: number;
    url: string;
    image: string;
    duration: number;
    user: {
        name: string;
        url: string;
    };
    video_files: {
        id: number;
        quality: string;
        file_type: string;
        width: number;
        height: number;
        link: string;
    }[];
}

// GET /api/stock-media - Search Pexels for photos or videos
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!PEXELS_API_KEY) {
            return NextResponse.json({
                error: "Pexels API key not configured",
                available: false
            }, { status: 503 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type") || "photo"; // "photo" | "video"
        const query = searchParams.get("query") || "business";
        const page = searchParams.get("page") || "1";
        const perPage = searchParams.get("per_page") || "15";

        let endpoint: string;
        if (type === "video") {
            endpoint = query
                ? `${PEXELS_BASE_URL}/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`
                : `${PEXELS_BASE_URL}/videos/popular?page=${page}&per_page=${perPage}`;
        } else {
            endpoint = query
                ? `${PEXELS_BASE_URL}/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`
                : `${PEXELS_BASE_URL}/v1/curated?page=${page}&per_page=${perPage}`;
        }

        const response = await fetch(endpoint, {
            headers: {
                Authorization: PEXELS_API_KEY,
            },
        });

        if (!response.ok) {
            throw new Error(`Pexels API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform response to unified format
        if (type === "video") {
            const videos = data.videos?.map((video: PexelsVideo) => ({
                id: video.id,
                type: "video",
                width: video.width,
                height: video.height,
                thumbnail: video.image,
                preview: video.video_files.find((f) => f.quality === "sd")?.link || video.video_files[0]?.link,
                download: video.video_files.find((f) => f.quality === "hd")?.link || video.video_files[0]?.link,
                photographer: video.user.name,
                photographerUrl: video.user.url,
                duration: video.duration,
                source: "pexels",
            })) || [];

            return NextResponse.json({
                data: videos,
                page: parseInt(page),
                perPage: parseInt(perPage),
                totalResults: data.total_results || 0,
                available: true,
            });
        } else {
            const photos = data.photos?.map((photo: PexelsPhoto) => ({
                id: photo.id,
                type: "photo",
                width: photo.width,
                height: photo.height,
                thumbnail: photo.src.medium,
                preview: photo.src.large,
                download: photo.src.original,
                photographer: photo.photographer,
                photographerUrl: photo.photographer_url,
                alt: photo.alt,
                source: "pexels",
            })) || [];

            return NextResponse.json({
                data: photos,
                page: parseInt(page),
                perPage: parseInt(perPage),
                totalResults: data.total_results || 0,
                available: true,
            });
        }
    } catch (error) {
        console.error("Error fetching stock media:", error);
        return NextResponse.json({
            error: "Failed to fetch stock media",
            available: false
        }, { status: 500 });
    }
}
