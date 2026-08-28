"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import AuthFrame from "@/components/auth/AuthFrame";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export const dynamic = "force-dynamic";

// Pesan server dari lib/portal-auth.ts — diteruskan verbatim (kontrak copy 11-UI-SPEC §1)
const SERVER_MESSAGE_PREFIXES = [
  "Password salah",
  "NIK tidak ditemukan",
  "Akun dinonaktifkan. Hubungi administrator.",
  "Akun terkunci. Coba lagi dalam ",
  // JIT (TASK-29): akun valid di HRIS tapi belum set password → arahkan ke set-password
  "Akun terdaftar namun belum aktif. Silakan atur kata sandi terlebih dahulu.",
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

const JIT_PASSWORD_REQUIRED =
  "Akun terdaftar namun belum aktif. Silakan atur kata sandi terlebih dahulu.";

export default function PortalLoginPage() {
  const router = useRouter();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsPasswordSetup(false);
    setIsLoading(true);

    try {
      const result = await signIn("portal-credentials", {
        nik,
        password,
        redirect: false,
        callbackUrl: "/portal",
      });

      if (result?.error) {
        const mapped = mapLoginError(result.error);
        setError(mapped);
        setNeedsPasswordSetup(mapped === JIT_PASSWORD_REQUIRED);
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
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Masuk..." : "Masuk"}
        </Button>

        {needsPasswordSetup && (
          <div className="text-center">
            <a
              href={`/portal/set-password?nik=${encodeURIComponent(nik)}`}
              className="text-xs font-medium text-accent underline hover:text-accent/80 transition-colors"
            >
              Atur kata sandi sekarang
            </a>
          </div>
        )}

        <p className="text-center text-xs text-text-3">
          Lupa password? Hubungi Admin HRIS.
        </p>
      </form>
    </AuthFrame>
  );
}