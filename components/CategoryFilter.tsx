"use client";

import Link from "next/link";

interface Category {
    id: string;
    name: string;
    slug: string;
    color: string;
}

interface CategoryFilterProps {
    categories: Category[];
    activeCategory?: string;
}

export function CategoryFilter({ categories, activeCategory = "all" }: CategoryFilterProps) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <CategoryTab label="SEMUA" isActive={activeCategory === "all"} onClick={() => { }} />
            {categories.map((category) => (
                <CategoryTab
                    key={category.id}
                    label={category.name.toUpperCase()}
                    isActive={activeCategory === category.slug}
                    onClick={() => { }}
                />
            ))}
        </div>
    );
}

function CategoryTab({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '12px 24px',
                backgroundColor: isActive ? '#dc2626' : 'transparent',
                border: isActive ? '1px solid #dc2626' : '1px solid #333',
                color: isActive ? '#fff' : '#737373',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'all 0.3s',
            }}
            onMouseOver={(e) => {
                if (!isActive) {
                    e.currentTarget.style.borderColor = '#525252';
                    e.currentTarget.style.color = '#fff';
                }
            }}
            onMouseOut={(e) => {
                if (!isActive) {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.color = '#737373';
                }
            }}
        >
            {label}
        </button>
    );
}

// Client-side wrapper for dynamic category filtering using Link navigation
export function CategoryFilterClient({
    categories,
    activeCategory = "all"
}: {
    categories: Category[];
    activeCategory?: string;
}) {
    const getButtonStyle = (isActive: boolean) => ({
        padding: isActive ? '12px 24px 9px 24px' : '12px 24px',
        backgroundColor: isActive ? '#dc2626' : 'transparent',
        border: isActive ? '1px solid #dc2626' : '1px solid #333',
        borderBottom: isActive ? '3px solid #fff' : '1px solid #333',
        color: isActive ? '#fff' : '#737373',
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
            >
                SEMUA
            </Link>
            {categories.map((category) => (
                <Link
                    key={category.id}
                    href={`/?category=${category.slug}#news`}
                    style={getButtonStyle(activeCategory === category.slug)}
                >
                    {category.name.toUpperCase()}
                </Link>
            ))}
        </div>
    );
}

export default CategoryFilter;
