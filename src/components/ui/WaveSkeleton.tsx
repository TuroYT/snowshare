"use client";

import { cn } from "@/lib/utils";

interface WaveSkeletonProps {
  variant?: "text" | "rounded" | "circular" | "rectangular";
  width?: number | string;
  height?: number | string;
  className?: string;
  sx?: Record<string, unknown>;
}

const WaveSkeleton = ({ variant = "text", width, height, className, sx }: WaveSkeletonProps) => {
  const borderRadius =
    variant === "circular"
      ? "9999px"
      : variant === "rounded"
        ? ((sx?.borderRadius as string) ?? "var(--radius)")
        : variant === "text"
          ? "4px"
          : "0px";

  return (
    <div
      className={cn("relative overflow-hidden bg-[var(--surface-hover)] animate-pulse", className)}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius,
        ...(sx as React.CSSProperties | undefined),
      }}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        }}
      />
    </div>
  );
};

export default WaveSkeleton;
