"use client";

import Link from "next/link";
import { FiAlertTriangle } from "react-icons/fi";

interface CorruptCredentialProps {
    appName: string;
    appSlug: string;
}

export default function CorruptCredential({ appName, appSlug }: CorruptCredentialProps) {
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
                    backgroundColor: "rgba(234, 179, 8, 0.1)",
                    border: "1px solid rgba(234, 179, 8, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                }}>
                    <FiAlertTriangle size={24} color="#eab308" />
                </div>
                <h1 style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#fff",
                    margin: "0 0 12px",
                }}>
                    Kredensial Rusak
                </h1>
                <p style={{
                    color: "#a1a1aa",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    margin: "0 0 8px",
                }}>
                    Kredensial rusak. Silakan simpan ulang.
                </p>
                <p style={{
                    color: "#737373",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    margin: "0 0 24px",
                }}>
                    Kredensial untuk <strong style={{ color: "#a1a1aa" }}>{appName}</strong> tidak dapat dibaca. Silakan simpan ulang untuk melanjutkan.
                </p>
                <Link
                    href={`/portal/credentials?app=${appSlug}`}
                    style={{
                        display: "inline-block",
                        padding: "10px 24px",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                    }}
                >
                    Simpan Ulang Kredensial
                </Link>
            </div>
        </div>
    );
}
