"use client";

import { FiSearch, FiX } from "react-icons/fi";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
    placeholder?: string;
    className?: string;
}

export default function SearchBar({
    placeholder = "Cari pengumuman...",
}: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const router = useRouter();

    const handleSearch = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (query.trim()) {
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
        },
        [query, router]
    );

    const clearSearch = () => {
        setQuery("");
    };

    return (
        <form onSubmit={handleSearch} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <FiSearch
                    size={18}
                    style={{
                        position: 'absolute',
                        left: '16px',
                        color: '#525252',
                    }}
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    style={{
                        width: '100%',
                        padding: '16px 48px 16px 48px',
                        backgroundColor: '#0a0a0a',
                        border: isFocused ? '1px solid #dc2626' : '1px solid #262626',
                        color: '#fff',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.3s',
                    }}
                />
                {query && (
                    <button
                        type="button"
                        onClick={clearSearch}
                        style={{
                            position: 'absolute',
                            right: '16px',
                            padding: '4px',
                            color: '#525252',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <FiX size={16} />
                    </button>
                )}
            </div>
        </form>
    );
}
