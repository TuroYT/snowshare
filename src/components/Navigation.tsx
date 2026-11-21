"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/hooks/useColorScheme";
import { User, Settings, LogOut, Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { languages } from "@/i18n/client";

interface ProfileDropdownProps {
  session: ReturnType<typeof useSession>["data"];
  isAdmin: boolean;
  profileOpen: boolean;
  setProfileOpen: (v: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement | null>;
  handleSignOut: () => void;
  initials: string;
  t: TFunction;
}

function ProfileDropdown({
  session,
  isAdmin,
  profileOpen,
  setProfileOpen,
  profileRef,
  handleSignOut,
  initials,
  t,
}: Readonly<ProfileDropdownProps>) {
  return (
    <div ref={profileRef} className="relative">
      <button
        type="button"
        onClick={() => setProfileOpen(!profileOpen)}
        aria-label={t("nav.profile", "My Profile")}
        aria-expanded={profileOpen}
        className="w-9 h-9 rounded-full bg-[var(--primary)] text-white text-xs font-semibold overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] focus-visible:ring-[var(--primary)]"
      >
        {session?.user?.image ? (
          <Image
            src={session.user.image}
            alt=""
            width={36}
            height={36}
            className="object-cover w-full h-full"
          />
        ) : (
          initials
        )}
      </button>
      {profileOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] py-1 z-50 animate-fade-in">
          <div className="px-3 py-2 text-xs text-[var(--foreground-muted)] border-b border-[var(--border)] truncate">
            {session?.user?.name || session?.user?.email}
          </div>
          <Link
            href="/profile"
            onClick={() => setProfileOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
          >
            <User className="w-4 h-4 text-[var(--foreground-muted)]" />
            {t("nav.profile", "My Profile")}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
            >
              <Settings className="w-4 h-4 text-[var(--foreground-muted)]" />
              {t("nav.admin", "Admin")}
            </Link>
          )}
          <div className="border-t border-[var(--border)] mt-1" />
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--destructive-text)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.signout", "Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  appName: string;
  currentLang: string;
  changeLang: (lng: string) => void;
  status: string;
  session: ReturnType<typeof useSession>["data"];
  isAdmin: boolean;
  handleSignOut: () => void;
  theme: string;
  cycleTheme: () => void;
  themeIcon: React.ReactNode;
  showSignup: boolean;
  t: TFunction;
}

function MobileDrawer({
  open,
  onClose,
  appName,
  currentLang,
  changeLang,
  status,
  session,
  isAdmin,
  handleSignOut,
  theme,
  cycleTheme,
  themeIcon,
  showSignup,
  t,
}: Readonly<MobileDrawerProps>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the drawer on open, restore it on close, close on Escape and keep Tab inside.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]):not([tabindex='-1']), select, input, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open) return null;
  let themeLabel = t("nav.theme_system", "System");
  if (theme === "dark") themeLabel = t("nav.theme_dark", "Dark mode");
  else if (theme === "light") themeLabel = t("nav.theme_light", "Light mode");
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={appName}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex animate-fade-in"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 cursor-default"
        onClick={onClose}
      />
      <div className="relative ml-auto w-72 bg-[var(--surface)] h-full shadow-[var(--shadow-lg)] flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <span className="font-semibold text-sm">{appName}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("common.close", "Close")}
            className="w-9 h-9 -mr-2 inline-flex items-center justify-center rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <select
            value={currentLang}
            onChange={(e) => changeLang(e.target.value)}
            aria-label={t("nav.language", "Language")}
            className="w-full text-sm px-3 py-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-100 mb-3"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          {status === "authenticated" && session ? (
            <>
              <div className="text-xs text-[var(--foreground-muted)] px-2 py-1 truncate">
                {session.user?.name || session.user?.email}
              </div>
              <Link
                href="/profile"
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
              >
                <User className="w-4 h-4" />
                {t("nav.profile", "My Profile")}
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
                >
                  <Settings className="w-4 h-4" />
                  {t("nav.admin", "Admin")}
                </Link>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--destructive-text)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
              >
                <LogOut className="w-4 h-4" />
                {t("nav.signout", "Sign out")}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                onClick={onClose}
                className="block px-3 py-2 text-sm text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
              >
                {t("nav.signin")}
              </Link>
              {showSignup && (
                <Link
                  href="/auth/signup"
                  onClick={onClose}
                  className="block px-3 py-2 text-sm bg-[var(--primary)] text-white rounded-[var(--radius)] text-center hover:bg-[var(--primary-hover)] transition-colors duration-100"
                >
                  {t("nav.signup")}
                </Link>
              )}
            </>
          )}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={cycleTheme}
            className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] px-3 py-2 w-full rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
          >
            {themeIcon}
            <span>{themeLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Navigation() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { branding } = useTheme();
  const { theme, setTheme } = useColorScheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
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
      .catch((error) => console.error("Failed to check signup availability:", error));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let ignore = false;
    const controller = new AbortController();
    fetch("/api/user/profile", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!ignore && d?.user?.isAdmin) setIsAdmin(true);
      })
      .catch((error) => {
        if (!ignore && error?.name !== "AbortError") {
          console.error("Failed to fetch user profile for admin check:", error);
        }
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [status]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Focus is inside the dropdown: closing it would unmount the focused link, so hand
      // focus back to the trigger (the first button of the wrapper).
      const root = profileRef.current;
      if (root?.contains(document.activeElement)) {
        root.querySelector<HTMLButtonElement>("button")?.focus();
      }
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
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

  // The server cannot know the stored theme: render an empty slot until hydration is done so the
  // markup matches and the icon does not flash from "system" to the real one.
  let themeIcon = mounted ? <Monitor className="w-4 h-4" /> : <span className="w-4 h-4" />;
  if (theme === "dark") themeIcon = <Moon className="w-4 h-4" />;
  else if (theme === "light") themeIcon = <Sun className="w-4 h-4" />;

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
              <Image
                src={branding.logoUrl}
                unoptimized
                alt=""
                width={24}
                height={24}
                className="rounded"
              />
            ) : (
              <Image src="/logo.svg" unoptimized alt="" width={24} height={24} />
            )}
            <span className="font-semibold text-sm tracking-tight">{branding.appName}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 ml-auto">
            <select
              value={currentLang}
              onChange={(e) => changeLang(e.target.value)}
              aria-label={t("nav.language", "Language")}
              className="text-sm h-9 px-2 rounded-[var(--radius)] border border-[var(--border)] bg-transparent text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-100"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={cycleTheme}
              className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
              aria-label={t("nav.toggle_theme", "Toggle theme")}
            >
              {themeIcon}
            </button>

            {status === "loading" ? (
              <div className="w-9 h-9" aria-hidden="true" />
            ) : status === "authenticated" && session ? (
              <ProfileDropdown
                session={session}
                isAdmin={isAdmin}
                profileOpen={profileOpen}
                setProfileOpen={setProfileOpen}
                profileRef={profileRef}
                handleSignOut={handleSignOut}
                initials={initials}
                t={t}
              />
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-sm px-3 py-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] rounded-[var(--radius)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
                >
                  {t("nav.signin")}
                </Link>
                {showSignup && (
                  <Link
                    href="/auth/signup"
                    className="text-sm px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius)] hover:bg-[var(--primary-hover)] transition-colors duration-100"
                  >
                    {t("nav.signup")}
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Mobile burger */}
          <button
            type="button"
            className="sm:hidden w-9 h-9 -mr-2 inline-flex items-center justify-center rounded-[var(--radius)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors duration-100"
            onClick={() => setMobileOpen(true)}
            aria-label={t("nav.open_menu", "Open menu")}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        appName={branding.appName}
        currentLang={currentLang}
        changeLang={changeLang}
        status={status}
        session={session}
        isAdmin={isAdmin}
        handleSignOut={handleSignOut}
        theme={theme}
        cycleTheme={cycleTheme}
        themeIcon={themeIcon}
        showSignup={showSignup}
        t={t}
      />
    </>
  );
}
