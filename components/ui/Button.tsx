"use client";

import { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  // primary memakai --brand-red-dark (#C41920), bukan --accent (#ED1C24): teks
  // putih di #ED1C24 hanya 4.38:1 (gagal AA 14px); di #C41920 ≈6.0:1. --accent
  // tetap untuk aksen non-teks (border, ikon). (T7)
  primary: "bg-santos-red-dark text-white hover:opacity-90",
  secondary: "border border-border bg-surface-1 text-text-1 hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
};

/**
 * Tampilan tombol sebagai string kelas, untuk elemen yang BUKAN <button>.
 *
 * Komponen `Button` merender `<button>`, yang tidak boleh disarangkan di dalam
 * `<a>`/`<Link>`. Akibatnya beberapa berkas menyalin ulang string kelas tombol
 * secara manual (app/admin/sites/page.tsx, app/admin/sites/[id]/page.tsx, dan
 * UpdateBanner) — tiga salinan yang gampang menyimpang saat tampilan tombol
 * berubah. Helper ini menjaga satu sumber kebenaran.
 *
 * Contoh:
 *   <Link href="/admin/sites/new" className={buttonClasses({ variant: "primary" })}>
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return `${BASE} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

export default function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    // type default "button": tanpa ini setiap <Button> di dalam <form> berlaku
    // sebagai submit, jadi tombol sekunder seperti "Batal" ikut mengirim form.
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
