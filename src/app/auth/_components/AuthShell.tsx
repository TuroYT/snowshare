"use client";

import Image from "next/image";
import { useTheme } from "@/hooks/useTheme";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/** Centered card layout shared by the password recovery pages. */
export default function AuthShell({ title, subtitle, children }: Readonly<AuthShellProps>) {
  const { branding } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo.svg"
            unoptimized
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-3"
          />
          <h1 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">{title}</h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            {subtitle ?? branding.appName}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
