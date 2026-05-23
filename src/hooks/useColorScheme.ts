"use client";

import { useTheme } from "next-themes";

export function useColorScheme() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return {
    isDark: resolvedTheme === "dark",
    theme: theme as "light" | "dark" | "system",
    setTheme,
    toggle: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
  };
}
