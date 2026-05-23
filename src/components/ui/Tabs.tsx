"use client";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

interface TabsCtx {
  active: string;
  onChange: (v: string) => void;
}
const Ctx = createContext<TabsCtx>({ active: "", onChange: () => {} });

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Ctx.Provider value={{ active: value, onChange: onValueChange }}>
      <div
        role="tablist"
        className={cn(
          "inline-flex gap-0.5 p-0.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius)]",
          className
        )}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function Tab({ value, children }: { value: string; children: React.ReactNode }) {
  const { active, onChange } = useContext(Ctx);
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(value)}
      className={cn(
        "px-4 py-1.5 text-sm rounded-[4px] transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        isActive
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-sm)]"
          : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      )}
    >
      {children}
    </button>
  );
}
