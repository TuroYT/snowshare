"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Button, Card, Input } from "@/components/ui";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

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
    <div className="w-40">
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
        aria-label={t("totp.code_label", "Authentication code")}
        className="tracking-widest"
      />
    </div>
  );

  return (
    <Card className="mt-6 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-[var(--foreground)]">
          {t("totp.title", "Two-factor authentication")}
        </h3>
        <p className="text-sm text-[var(--foreground-muted)]">
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
        <Button onClick={async () => setSetup(await post({ action: "setup" }))} disabled={busy}>
          {t("totp.setup", "Set up")}
        </Button>
      )}

      {!data.enabled && setup && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--foreground)]">
            {t("totp.scan", "Scan this QR code with your app, then enter the code it shows.")}
          </p>
          {/* QR codes need a light background to stay scannable in the dark theme */}
          <div className="inline-block bg-white p-2 rounded-[var(--radius)]">
            <QRCodeSVG value={setup.otpauthUrl} size={160} />
          </div>
          <p className="text-xs text-[var(--foreground-muted)] break-all">
            {t("totp.manual", "Or enter this key manually:")}{" "}
            <code className="font-mono">{setup.secret}</code>
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {codeInput}
            <Button onClick={() => confirm("enable")} disabled={busy || !code}>
              {t("totp.enable", "Turn on")}
            </Button>
          </div>
        </div>
      )}

      {data.enabled && (
        <div className="flex flex-wrap gap-2 items-center">
          {codeInput}
          <Button
            variant="danger-outline"
            onClick={() => confirm("disable")}
            disabled={busy || !code}
          >
            {t("totp.disable", "Turn off")}
          </Button>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
    </Card>
  );
}
