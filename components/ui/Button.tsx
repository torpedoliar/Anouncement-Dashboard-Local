"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const variants: Record<string, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-border bg-surface-1 text-text-1 hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<string, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}