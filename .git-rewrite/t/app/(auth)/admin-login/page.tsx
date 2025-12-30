"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FiMail, FiLock, FiAlertCircle, FiArrowLeft } from "react-icons/fi";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
            } else {
                router.push("/admin");
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#000',
            display: 'flex',
        }}>
            {/* Left Side - Branding */}
            <div
                style={{
                    width: '50%',
                    position: 'relative',
                    background: 'linear-gradient(135deg, #1a0000 0%, #000 50%, #0a0a0a 100%)',
                    padding: '64px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                }}
                className="hidden lg:flex"
            >
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        backgroundColor: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '20px' }}>S</span>
                    </div>
                    <span style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        color: '#fff',
                        fontSize: '13px',
                        letterSpacing: '0.1em',
                    }}>
                        SANTOS JAYA ABADI
                    </span>
                </Link>
                <div>
                    <h1 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '48px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '24px',
                        lineHeight: 1.2,
                    }}>
                        Admin<br />Dashboard
                    </h1>
                    <p style={{
                        color: '#737373',
                        fontSize: '16px',
                        maxWidth: '400px',
                        lineHeight: 1.7,
                    }}>
                        Kelola pengumuman dan konten perusahaan dengan mudah melalui panel admin.
                    </p>
                </div>
                <p style={{ color: '#525252', fontSize: '13px' }}>
                    © 2024 PT. Santos Jaya Abadi
                </p>
            </div>

            {/* Right Side - Login Form */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
            }}>
                <div style={{ width: '100%', maxWidth: '400px' }}>
                    {/* Mobile Logo */}
                    <div className="lg:hidden" style={{ marginBottom: '48px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '18px' }}>S</span>
                            </div>
                            <span style={{
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 700,
                                color: '#fff',
                                fontSize: '12px',
                                letterSpacing: '0.1em',
                            }}>
                                SANTOS JAYA ABADI
                            </span>
                        </div>
                    </div>

                    {/* Back Link */}
                    <Link
                        href="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#525252',
                            fontSize: '13px',
                            marginBottom: '32px',
                        }}
                    >
                        <FiArrowLeft size={14} />
                        Kembali ke Beranda
                    </Link>

                    <h2 style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: '8px',
                    }}>
                        Masuk ke Admin
                    </h2>
                    <p style={{ color: '#525252', marginBottom: '32px', fontSize: '14px' }}>
                        Gunakan kredensial admin untuk mengakses dashboard
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px',
                            marginBottom: '24px',
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            border: '1px solid rgba(220, 38, 38, 0.3)',
                            color: '#ef4444',
                        }}>
                            <FiAlertCircle size={18} />
                            <span style={{ fontSize: '14px' }}>{error}</span>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                color: '#737373',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.1em',
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                            }}>
                                Email
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FiMail
                                    size={18}
                                    style={{
                                        position: 'absolute',
                                        left: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#525252',
                                    }}
                                />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #262626',
                                        color: '#fff',
                                        fontSize: '14px',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <label style={{
                                display: 'block',
                                color: '#737373',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.1em',
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <FiLock
                                    size={18}
                                    style={{
                                        position: 'absolute',
                                        left: '16px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: '#525252',
                                    }}
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        backgroundColor: '#0a0a0a',
                                        border: '1px solid #262626',
                                        color: '#fff',
                                        fontSize: '14px',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '16px 32px',
                                backgroundColor: '#dc2626',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 600,
                                letterSpacing: '0.1em',
                                border: 'none',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.6 : 1,
                                transition: 'opacity 0.3s',
                            }}
                        >
                            {isLoading ? "MEMPROSES..." : "MASUK"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
