"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { useFetch } from "@/hooks/useFetch";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

const inputClass =
  "w-40 px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm tracking-widest focus:outline-none focus:border-[var(--primary)]";

export default function TwoFactorSection() {
  const { t } = useTranslation();
  const { data, refetch } = useFetch<{ enabled: boolean; available: boolean }>("/api/user/totp");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!data?.available) return null;

  const post = async (body: Record<string, string>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/user/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("totp.error", "Something went wrong."));
        return null;
      }
      return json;
    } catch (err) {
      console.error("Two-factor request failed:", err);
      setError(t("totp.error", "Something went wrong."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action: "enable" | "disable") => {
    if (await post({ action, code })) {
      setSetup(null);
      setCode("");
      refetch();
    }
  };

  const codeInput = (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      value={code}
      onChange={(e) => setCode(e.target.value)}
      placeholder="123456"
      aria-label={t("totp.code_label", "Authentication code")}
      className={inputClass}
    />
  );
  const buttonClass =
    "px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 mt-6 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-[var(--foreground)]">
          {t("totp.title", "Two-factor authentication")}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {data.enabled
            ? t(
                "totp.enabled_desc",
                "On: signing in with your password also asks for a code from your app."
              )
            : t(
                "totp.disabled_desc",
                "Ask for a code from an authenticator app (Aegis, Google Authenticator, 1Password…) when signing in with your password."
              )}
        </p>
      </div>

      {!data.enabled && !setup && (
        <button
          onClick={async () => setSetup(await post({ action: "setup" }))}
          disabled={busy}
          className={buttonClass}
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {t("totp.setup", "Set up")}
        </button>
      )}

      {!data.enabled && setup && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--foreground)]">
            {t("totp.scan", "Scan this QR code with your app, then enter the code it shows.")}
          </p>
          <div className="inline-block bg-white p-2 rounded-lg">
            <QRCodeSVG value={setup.otpauthUrl} size={160} />
          </div>
          <p className="text-xs text-[var(--muted)] break-all">
            {t("totp.manual", "Or enter this key manually:")}{" "}
            <code className="font-mono">{setup.secret}</code>
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {codeInput}
            <button
              onClick={() => confirm("enable")}
              disabled={busy || !code}
              className={buttonClass}
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {t("totp.enable", "Turn on")}
            </button>
          </div>
        </div>
      )}

      {data.enabled && (
        <div className="flex flex-wrap gap-2 items-center">
          {codeInput}
          <button
            onClick={() => confirm("disable")}
            disabled={busy || !code}
            className={`${buttonClass} border border-red-500/40 text-red-400 hover:bg-red-500/10`}
          >
            {t("totp.disable", "Turn off")}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
