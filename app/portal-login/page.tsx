"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthFrame from "@/components/auth/AuthFrame";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

// Pesan server dari lib/portal-auth.ts — diteruskan verbatim (kontrak copy 11-UI-SPEC §1)
const SERVER_MESSAGE_PREFIXES = [
  "Password salah",
  "NIK tidak ditemukan",
  "Akun dinonaktifkan. Hubungi administrator.",
  "Akun terkunci. Coba lagi dalam ",
];

// Kode error generik provider NextAuth — dipetakan ke "NIK atau password salah"
const GENERIC_PROVIDER_ERRORS = [
  "CredentialsSignin",
  "Configuration",
  "AccessDenied",
  "Verification",
  "OAuthSignin",
  "OAuthCallback",
  "OAuthCreateAccount",
  "EmailCreateAccount",
  "Callback",
  "OAuthAccountNotLinked",
  "EmailSignin",
  "SessionRequired",
];

function mapLoginError(error: string | undefined | null): string {
  if (!error) return "Terjadi kesalahan. Silakan coba lagi.";
  if (SERVER_MESSAGE_PREFIXES.some((prefix) => error.startsWith(prefix))) {
    return error;
  }
  if (GENERIC_PROVIDER_ERRORS.includes(error)) {
    return "NIK atau password salah";
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}

export default function PortalLoginPage() {
  const router = useRouter();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("portal-credentials", {
        nik,
        password,
        redirect: false,
        callbackUrl: "/portal",
      });

      if (result?.error) {
        setError(mapLoginError(result.error));
      } else {
        router.push("/portal");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame eyebrow="PORTAL SSO" title="Masuk ke Portal" error={error}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="nik"
            className="mb-2 block text-xs font-semibold text-text-2"
          >
            NIK HRIS
          </label>
          <Input
            id="nik"
            type="text"
            value={nik}
            onChange={(e) => setNik(e.target.value)}
            required
            placeholder="Masukkan NIK Anda"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-xs font-semibold text-text-2"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Masuk..." : "Masuk"}
        </Button>

        <p className="text-center text-xs text-text-3">
          Lupa password? Hubungi Admin HRIS.
        </p>
      </form>
    </AuthFrame>
  );
}