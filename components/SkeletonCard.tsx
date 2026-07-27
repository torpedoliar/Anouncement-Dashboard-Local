"use client";

export default function SkeletonCard() {
    return (
        <div className="animate-pulse">
            <div style={{
                backgroundColor: 'var(--border-color)',
                height: '192px',
                borderRadius: '8px',
                marginBottom: '16px',
            }} />
            <div style={{
                backgroundColor: 'var(--border-color)',
                height: '16px',
                width: '75%',
                borderRadius: '4px',
                marginBottom: '8px',
            }} />
            <div style={{
                backgroundColor: 'var(--border-color)',
                height: '16px',
                width: '50%',
                borderRadius: '4px',
            }} />
        </div>
    );
}
