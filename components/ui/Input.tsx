"use client";

import { InputHTMLAttributes, type Ref } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /* React 19: ref lewat sebagai prop biasa lalu tersebar ke <input> oleh ...rest. */
  ref?: Ref<HTMLInputElement>;
}

export default function Input({ label, error, hint, className = "", ...rest }: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-text-1">{label}</span>
      )}
      <input
        className={`h-11 w-full rounded-control border bg-surface-1 px-3 text-sm text-text-1 placeholder:text-text-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-text-3">{hint}</span>
      ) : null}
    </label>
  );
}