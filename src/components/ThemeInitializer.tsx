import { ThemeProvider } from "@/contexts/ThemeContext";
import { ReactNode } from "react";
import { getPublicSettings } from "@/lib/settings";

async function fetchInitialTheme() {
  try {
    return await getPublicSettings();
  } catch {
    return null;
  }
}

export async function ThemeInitializer({ children }: { children: ReactNode }) {
  const themeData = await fetchInitialTheme();
  return <ThemeProvider initialData={themeData}>{children}</ThemeProvider>;
}
