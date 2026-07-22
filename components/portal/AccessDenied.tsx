"use client";

import Link from "next/link";
import { FiShield } from "react-icons/fi";

interface AccessDeniedProps {
    appName: string;
}

export default function AccessDenied({ appName }: AccessDeniedProps) {
    return (
        <div style={{
            minHeight: "100vh",
            backgroundColor: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
        }}>
            <div style={{
                textAlign: "center",
                maxWidth: "400px",
            }}>
                <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(220, 38, 38, 0.1)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                }}>
                    <FiShield size={24} color="#dc2626" />
                </div>
                <h1 style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#fff",
                    margin: "0 0 12px",
                }}>
                    Akses Ditolak
                </h1>
                <p style={{
                    color: "#a1a1aa",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    margin: "0 0 24px",
                }}>
                    Anda tidak punya akses ke <strong style={{ color: "#fff" }}>{appName}</strong>
                </p>
                <Link
                    href="/portal"
                    style={{
                        display: "inline-block",
                        padding: "10px 24px",
                        backgroundColor: "#262626",
                        color: "#a1a1aa",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 500,
                        textDecoration: "none",
                        border: "1px solid #262626",
                    }}
                >
                    Kembali ke Portal
                </Link>
            </div>
        </div>
    );
}
