"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeSlash, Check, X } from "@phosphor-icons/react";
import { useToast } from "@/contexts/ToastContext";
import AuthFrame from "@/components/auth/AuthFrame";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nik = searchParams.get("nik") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [passwordTooShort, setPasswordTooShort] = useState(false);

  const { showToast } = useToast();

  // Real-time validation
  useEffect(() => {
    if (confirmPassword && newPassword !== confirmPassword) {
      setPasswordMismatch(true);
    } else {
      setPasswordMismatch(false);
    }

    if (newPassword && newPassword.length < 8) {
      setPasswordTooShort(true);
    } else {
      setPasswordTooShort(false);
    }
  }, [newPassword, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (newPassword.length < 8) {
      setPasswordTooShort(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Replace with actual API call once Oscar completes TASK-29
      // Endpoint signature: POST /api/portal/set-password payload {nik, password}
      const response = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik, password: newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal menyetel kata sandi");
      }

      showToast("Kata sandi berhasil disetel. Silakan login.", "success");

      // Redirect after short delay for toast visibility
      setTimeout(() => {
        router.push("/portal-login");
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!nik) {
    return (
      <AuthFrame eyebrow="JIT PROVISIONING" title="Parameter Tidak Lengkap">
        <div className="text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-2">
            <X size={24} className="text-danger" aria-hidden="true" />
          </div>
          <p className="text-sm text-text-2">
            Parameter NIK tidak ditemukan. Pastikan Anda menggunakan link yang benar.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/portal-login")}
            className="w-full"
          >
            Kembali ke Login
          </Button>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame eyebrow="JIT PROVISIONING" title="Atur Kata Sandi" error={error}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="nik"
            className="mb-2 block text-xs font-semibold text-text-2"
          >
            NIK
          </label>
          <Input
            id="nik"
            type="text"
            value={nik}
            readOnly
            disabled
            className="bg-surface-2 text-text-1 cursor-not-allowed"
          />
        </div>

        <div>
          <label
            htmlFor="new-password"
            className="mb-2 block text-xs font-semibold text-text-2"
          >
            Kata sandi baru *
          </label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimal 8 karakter"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              aria-label={showNewPassword ? "Sembunyikan password" : "Lihat password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
            >
              {showNewPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {passwordTooShort && (
            <p className="mt-1 text-xs text-danger" role="alert">
              Kata sandi minimal 8 karakter
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="mb-2 block text-xs font-semibold text-text-2"
          >
            Konfirmasi kata sandi *
          </label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Konfirmasi kata sandi"
              className={`pr-10 ${passwordMismatch ? "border-danger/50" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Sembunyikan password" : "Lihat password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors p-1"
            >
              {showConfirmPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {passwordMismatch && (
            <p className="mt-1 text-xs text-danger" role="alert">
              Kata sandi tidak cocok
            </p>
          )}
          {!passwordMismatch && confirmPassword && (
            <p className="mt-1 text-xs text-success flex items-center gap-1">
              <Check size={12} aria-hidden="true" /> Kata sandi cocok
            </p>
          )}
        </div>

        <Button type="submit" disabled={isLoading || passwordMismatch || passwordTooShort} className="w-full">
          {isLoading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white mr-2" />
              Menyetel...
            </>
          ) : (
            "Setel Kata Sandi"
          )}
        </Button>

        <p className="text-center text-xs text-text-3">
          Setelah kata sandi disetel, Anda akan diarahkan ke halaman login.
        </p>
      </form>
    </AuthFrame>
  );
}