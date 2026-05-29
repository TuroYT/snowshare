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
      <div role="tablist" className={cn("flex border-b border-[var(--border)]", className)}>
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
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-selected={isActive}
      onClick={() => onChange(value)}
      className={cn(
        "px-4 py-2 text-sm transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] border-b-2 -mb-px",
        isActive
          ? "border-[var(--primary)] text-[var(--foreground)] font-medium"
          : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      )}
    >
      {children}
    </button>
  );
}
