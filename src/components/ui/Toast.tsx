"use client";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { useColorScheme } from "@/hooks/useColorScheme";

export function Toaster() {
  const { isDark } = useColorScheme();
  return (
    <SonnerToaster
      theme={isDark ? "dark" : "light"}
      toastOptions={{
        style: {
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          borderRadius: "var(--radius)",
          fontSize: "14px",
        },
      }}
    />
  );
}

export const toast = {
  success: (msg: string) => sonnerToast.success(msg),
  error: (msg: string) => sonnerToast.error(msg),
  info: (msg: string) => sonnerToast.info(msg),
  loading: (msg: string) => sonnerToast.loading(msg),
  dismiss: sonnerToast.dismiss,
};
