import { FiClock } from "react-icons/fi";
import { formatReadingTime } from "@/lib/utils";

interface ReadingTimeProps {
    content: string;
    className?: string;
}

export default function ReadingTime({ content, className }: ReadingTimeProps) {
    const readingTime = formatReadingTime(content);

    return (
        <span
            className={className}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: "var(--text-muted)",
                fontSize: "13px",
            }}
        >
            <FiClock size={14} />
            {readingTime}
        </span>
    );
}
