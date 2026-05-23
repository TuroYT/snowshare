"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  children,
  content,
  className,
}: {
  children: React.ReactNode;
  content: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs whitespace-nowrap rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] shadow-[var(--shadow-md)] pointer-events-none z-50"
        >
          {content}
        </div>
      )}
    </div>
  );
}
