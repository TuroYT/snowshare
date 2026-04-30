"use client";

import { ReactNode } from "react";

interface Props {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
  /** When true, children are not mounted until loading is false (avoids jank from heavy components). */
  lazy?: boolean;
}

export default function SkeletonTransition({
  loading,
  skeleton,
  children,
  className,
  lazy,
}: Props) {
  if (lazy) {
    return (
      <div className={className}>
        {loading ? skeleton : <div className="animate-fade-in">{children}</div>}
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        className={`transition-opacity duration-300 ${!loading ? "absolute inset-0 pointer-events-none overflow-hidden" : ""}`}
        style={{ opacity: loading ? 1 : 0 }}
        aria-hidden={!loading}
      >
        {skeleton}
      </div>
      <div
        className={`transition-opacity duration-300 ${loading ? "absolute inset-0 pointer-events-none overflow-hidden" : ""}`}
        style={{ opacity: loading ? 0 : 1 }}
        aria-hidden={loading}
      >
        {children}
      </div>
    </div>
  );
}
