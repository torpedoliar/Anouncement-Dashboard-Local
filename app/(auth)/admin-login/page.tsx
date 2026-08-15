"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, EnvelopeSimple, LockKey } from "@phosphor-icons/react";
import AuthFrame from "@/components/auth/AuthFrame";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

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
        setError("Kredensial tidak valid");
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
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
      <div className="w-full max-w-[400px]">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-text-2 transition-colors duration-150 hover:text-text-1"
        >
          <ArrowLeft size={16} />
          Kembali ke Beranda
        </Link>

        <AuthFrame
          title="Masuk ke Admin"
          subtitle="Gunakan kredensial admin untuk mengakses dashboard"
          error={error}
          footer="© 2024 PT. Santos Jaya Abadi"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-semibold text-text-2"
              >
                Email
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3"
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-semibold text-text-2"
              >
                Password
              </label>
              <div className="relative">
                <LockKey
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3"
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Masuk..." : "Masuk"}
            </Button>
          </form>
        </AuthFrame>
      </div>
    </div>
  );
}