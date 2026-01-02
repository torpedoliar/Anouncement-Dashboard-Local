"use client";

import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    baseUrl: string;
    searchParams?: Record<string, string>;
}

export default function Pagination({
    currentPage,
    totalPages,
    baseUrl,
    searchParams = {},
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const buildUrl = (page: number) => {
        const params = new URLSearchParams({ ...searchParams, page: page.toString() });
        return `${baseUrl}?${params.toString()}`;
    };

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const delta = 2; // Pages around current

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 || // First page
                i === totalPages || // Last page
                (i >= currentPage - delta && i <= currentPage + delta) // Around current
            ) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== "...") {
                pages.push("...");
            }
        }

        return pages;
    };

    const buttonStyle = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "40px",
        height: "40px",
        padding: "0 12px",
        fontSize: "14px",
        fontWeight: 500,
        border: "1px solid #262626",
        backgroundColor: "#0a0a0a",
        color: "#a3a3a3",
        cursor: "pointer",
        transition: "all 0.2s",
    };

    const activeStyle = {
        ...buttonStyle,
        backgroundColor: "#dc2626",
        borderColor: "#dc2626",
        color: "#fff",
    };

    const disabledStyle = {
        ...buttonStyle,
        opacity: 0.5,
        cursor: "not-allowed",
    };

    return (
        <nav
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "48px",
            }}
            aria-label="Pagination"
        >
            {/* Previous */}
            {currentPage > 1 ? (
                <Link
                    href={buildUrl(currentPage - 1)}
                    style={buttonStyle}
                    aria-label="Halaman sebelumnya"
                >
                    <FiChevronLeft size={16} />
                </Link>
            ) : (
                <span style={disabledStyle} aria-disabled="true">
                    <FiChevronLeft size={16} />
                </span>
            )}

            {/* Page Numbers */}
            {getPageNumbers().map((page, index) =>
                page === "..." ? (
                    <span
                        key={`ellipsis-${index}`}
                        style={{ ...buttonStyle, border: "none", backgroundColor: "transparent" }}
                    >
                        ...
                    </span>
                ) : (
                    <Link
                        key={page}
                        href={buildUrl(page as number)}
                        style={currentPage === page ? activeStyle : buttonStyle}
                        aria-current={currentPage === page ? "page" : undefined}
                    >
                        {page}
                    </Link>
                )
            )}

            {/* Next */}
            {currentPage < totalPages ? (
                <Link
                    href={buildUrl(currentPage + 1)}
                    style={buttonStyle}
                    aria-label="Halaman berikutnya"
                >
                    <FiChevronRight size={16} />
                </Link>
            ) : (
                <span style={disabledStyle} aria-disabled="true">
                    <FiChevronRight size={16} />
                </span>
            )}
        </nav>
    );
}
