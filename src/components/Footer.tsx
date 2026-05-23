"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { useFetch } from "@/hooks/useFetch";

interface CustomLink {
  id: string;
  name: string;
  url: string;
}

export default function Footer() {
  const { t } = useTranslation();
  const { branding } = useTheme();
  const year = new Date().getFullYear();
  const { data } = useFetch<{ links: CustomLink[] }>("/api/custom-links");
  const customLinks = data?.links ?? [];

  const linkClass =
    "text-sm text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors";

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--foreground-subtle)]">
          © {year} {branding.appName}
        </p>
        <nav className="flex flex-wrap items-center gap-4 justify-center">
          {customLinks.length > 0 ? (
            customLinks.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {l.name}
              </a>
            ))
          ) : (
            <>
              <a
                href="https://github.com/TuroYT/snowshare"
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} flex items-center gap-1`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.49 2.87 8.3 6.84 9.64.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.38-2.03 1.01-2.75-.1-.26-.44-1.3.1-2.7 0 0 .83-.27 2.75 1.02A9.36 9.36 0 0 1 12 6.84c.84.004 1.68.11 2.47.32 1.92-1.29 2.75-1.02 2.75-1.02.54 1.4.2 2.44.1 2.7.63.72 1.01 1.63 1.01 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
                </svg>
                {t("footer.github", "GitHub")}
              </a>
              <a
                href="https://github.com/TuroYT/snowshare/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {t("footer.license", "License")}
              </a>
            </>
          )}
          <Link href="/terms-of-use" className={linkClass}>
            {t("footer.terms_of_use", "Terms of Use")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
