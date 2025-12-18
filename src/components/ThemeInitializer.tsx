import { ThemeProvider } from "@/contexts/ThemeContext";
import MuiThemeProvider from "@/components/MuiThemeProvider";
import { ReactNode } from "react";
import { getPublicSettings } from "@/lib/settings";

async function fetchInitialTheme() {
  try {
    return await getPublicSettings();
  } catch (error) {
    console.error("Failed to fetch initial theme:", error);
    return null;
  }
}

export async function ThemeInitializer({ children }: { children: ReactNode }) {
  // This call throws a promise that Suspense can catch
  const themeData = await fetchInitialTheme();

  return (
    <div style={{
      animation: "fadeIn 0.2s ease-in 0.2s forwards",
      opacity: 0,
    }}>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      <ThemeProvider initialData={themeData}>
        <MuiThemeProvider>
          {children}
        </MuiThemeProvider>
      </ThemeProvider>
    </div>
  );
}
