import { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

interface AuthFrameProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  error?: string;
  footer?: string;
  children: ReactNode;
}

export default function AuthFrame({
  eyebrow,
  title,
  subtitle,
  error,
  footer,
  children,
}: AuthFrameProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-10">
      <div className="w-full max-w-[400px]">
        {/* Brand block */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center bg-santos-red">
            <span className="font-display text-xl font-semibold text-white">
              S
            </span>
          </div>
          <p className="mt-4 font-display text-sm font-semibold tracking-[0.1em] text-text-1">
            SANTOS JAYA ABADI
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-sheet border border-border bg-surface-1 p-10 shadow-lvl-2">
          {eyebrow ? (
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-center font-display text-xl font-semibold text-text-1">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-center text-sm text-text-2">{subtitle}</p>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-card border border-danger/30 bg-danger-subtle p-4"
            >
              <WarningCircle
                size={20}
                className="mt-1 shrink-0 text-danger"
              />
              <p className="text-sm text-danger">{error}</p>
            </div>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>

        {footer ? (
          <p className="mt-8 text-center text-xs text-text-3">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}