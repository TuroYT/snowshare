"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/hooks/useColorScheme";
import { User, Settings, LogOut, Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { languages } from "@/i18n/client";

export default function Navigation() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { branding } = useTheme();
  const { theme, setTheme } = useColorScheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSignup, setShowSignup] = useState(true);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/setup/check")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setShowSignup(d.allowSignup && !d.onlySSOMode);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.isAdmin) setIsAdmin(true);
      });
  }, [status]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    setMobileOpen(false);
    setProfileOpen(false);
    await signOut({ redirect: false });
    router.push("/");
  };

  const changeLang = (lng: string) => {
    i18n.changeLanguage(lng);
    try {
      localStorage.setItem("i18nextLng", lng);
    } catch (_) {
      // localStorage may be unavailable (e.g. private browsing)
    }
    setMobileOpen(false);
  };

  const currentLang = (i18n.language || "en").split("-")[0];

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const themeIcon =
    theme === "dark" ? (
      <Moon className="w-4 h-4" />
    ) : theme === "light" ? (
      <Sun className="w-4 h-4" />
    ) : (
      <Monitor className="w-4 h-4" />
    );

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    session?.user?.email?.[0]?.toUpperCase() ??
    "?";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 text-[var(--foreground)] no-underline"
          >
            {branding.logoUrl ? (
              <Image src={branding.logoUrl} alt="" width={24} height={24} className="rounded" />
            ) : (
              <Image src="/logo.svg" alt="" width={24} height={24} />
            )}
            <span className="font-semibold text-sm tracking-tight">{branding.appName}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 ml-auto">
            <select
              value={currentLang}
              onChange={(e) => changeLang(e.target.value)}
              className="text-sm px-2 py-1 rounded-[var(--radius)] border border-[var(--border)] bg-transparent text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--foreground)]"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              onClick={cycleTheme}
              className="p-2 rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Toggle theme"
            >
              {themeIcon}
            </button>

            {status === "authenticated" && session ? (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-8 h-8 rounded-full bg-[var(--primary)] text-white text-xs font-semibold overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    initials
                  )}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] py-1 z-50">
                    <div className="px-3 py-2 text-xs text-[var(--foreground-muted)] border-b border-[var(--border)] truncate">
                      {session.user?.name || session.user?.email}
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <User className="w-4 h-4 text-[var(--foreground-muted)]" />
                      {t("nav.profile", "Mon Profil")}
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[var(--foreground-muted)]" />
                        {t("nav.admin", "Admin")}
                      </Link>
                    )}
                    <div className="border-t border-[var(--border)] mt-1" />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--destructive)] hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("nav.signout", "Déconnexion")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-sm px-3 py-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {t("nav.signin")}
                </Link>
                {showSignup && (
                  <Link
                    href="/auth/signup"
                    className="text-sm px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius)] hover:bg-[var(--primary-hover)] transition-colors"
                  >
                    {t("nav.signup")}
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Mobile burger */}
          <button
            className="sm:hidden p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-72 bg-[var(--surface)] h-full shadow-[var(--shadow-lg)] flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
              <span className="font-semibold text-sm">{branding.appName}</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 text-[var(--foreground-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <select
                value={currentLang}
                onChange={(e) => changeLang(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] focus:outline-none mb-3"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>

              {status === "authenticated" && session ? (
                <>
                  <div className="text-xs text-[var(--foreground-subtle)] px-2 py-1 truncate">
                    {session.user?.name || session.user?.email}
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
                  >
                    <User className="w-4 h-4" />
                    {t("nav.profile", "Mon Profil")}
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
                    >
                      <Settings className="w-4 h-4" />
                      {t("nav.admin", "Admin")}
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--destructive)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("nav.signout", "Déconnexion")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
                  >
                    {t("nav.signin")}
                  </Link>
                  {showSignup && (
                    <Link
                      href="/auth/signup"
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2 text-sm bg-[var(--primary)] text-white rounded-[var(--radius)] text-center"
                    >
                      {t("nav.signup")}
                    </Link>
                  )}
                </>
              )}
            </nav>
            <div className="border-t border-[var(--border)] p-3">
              <button
                onClick={cycleTheme}
                className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] px-3 py-2 w-full rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
              >
                {themeIcon}
                <span>
                  {theme === "dark"
                    ? "Mode sombre"
                    : theme === "light"
                      ? "Mode clair"
                      : "Automatique"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
