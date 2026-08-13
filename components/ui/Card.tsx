import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface-1 border border-border rounded-card shadow-lvl-1 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}