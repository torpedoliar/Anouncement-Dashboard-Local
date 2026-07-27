"use client";

import Link from "next/link";

interface Category {
    id: string;
    name: string;
    slug: string;
    color: string;
}

export default function CategoryFilter({
    categories,
    activeCategory = "all"
}: {
    categories: Category[];
    activeCategory?: string;
}) {
    const getButtonStyle = (isActive: boolean) => ({
        padding: isActive ? '12px 24px 9px 24px' : '12px 24px',
        backgroundColor: isActive ? 'var(--brand-red)' : 'transparent',
        border: isActive ? '1px solid var(--brand-red)' : '1px solid var(--border-strong)',
        borderBottom: isActive ? '3px solid #fff' : '1px solid var(--border-strong)',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.1em',
        cursor: 'pointer',
        transition: 'all 0.3s',
        textDecoration: 'none',
        display: 'inline-block',
    });

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <Link
                href="/#news"
                style={getButtonStyle(activeCategory === "all")}
                className="category-tab"
            >
                SEMUA
            </Link>
            {categories.map((category) => (
                <Link
                    key={category.id}
                    href={`/?category=${category.slug}#news`}
                    style={getButtonStyle(activeCategory === category.slug)}
                    className="category-tab"
                >
                    {category.name.toUpperCase()}
                </Link>
            ))}
        </div>
    );
}
