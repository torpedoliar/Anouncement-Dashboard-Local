"use client";

import { FiSearch, FiX, FiLoader } from "react-icons/fi";
import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface SearchBarProps {
    placeholder?: string;
    className?: string;
    autoSearch?: boolean; // Enable search-as-you-type
}

export default function SearchBar({
    placeholder = "Cari pengumuman...",
    autoSearch = false,
}: SearchBarProps) {
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";

    const [query, setQuery] = useState(initialQuery);
    const [isFocused, setIsFocused] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const router = useRouter();

    const debouncedQuery = useDebounce(query, 300);

    // Auto-search when debounced query changes
    useEffect(() => {
        if (autoSearch && debouncedQuery !== initialQuery) {
            if (debouncedQuery.trim()) {
                setIsSearching(true);
                router.push(`/search?q=${encodeURIComponent(debouncedQuery.trim())}`);
                setTimeout(() => setIsSearching(false), 500);
            }
        }
    }, [debouncedQuery, autoSearch, router, initialQuery]);

    const handleSearch = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (query.trim()) {
                setIsSearching(true);
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                setTimeout(() => setIsSearching(false), 500);
            }
        },
        [query, router]
    );

    const clearSearch = () => {
        setQuery("");
        if (autoSearch) {
            router.push("/search");
        }
    };

    return (
        <form onSubmit={handleSearch} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {isSearching ? (
                    <FiLoader
                        size={18}
                        style={{
                            position: 'absolute',
                            left: '16px',
                            color: '#dc2626',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                ) : (
                    <FiSearch
                        size={18}
                        style={{
                            position: 'absolute',
                            left: '16px',
                            color: '#525252',
                        }}
                    />
                )}
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    aria-label="Cari pengumuman"
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
                        aria-label="Hapus pencarian"
                    >
                        <FiX size={16} />
                    </button>
                )}
            </div>
        </form>
    );
}
