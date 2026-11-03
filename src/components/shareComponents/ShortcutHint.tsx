"use client";

import React from "react";
import { useTranslation } from "react-i18next";

/** "Tip: Ctrl + Enter to create quickly" — the handler lives in useShareForm. */
const ShortcutHint: React.FC<{ translationPrefix: string }> = ({ translationPrefix }) => {
  const { t } = useTranslation();
  const kbdClass = "px-1 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-xs";

  return (
    <p className="text-xs text-[var(--foreground-muted)] text-center mt-2">
      {t(`${translationPrefix}.shortcut`, "Tip:")}{" "}
      <kbd className={kbdClass}>{t("shareform.key_ctrl", "Ctrl")}</kbd> +{" "}
      <kbd className={kbdClass}>{t("shareform.key_enter", "Enter")}</kbd>{" "}
      {t(`${translationPrefix}.shortcut_tail`, "to create quickly")}
    </p>
  );
};

export default ShortcutHint;
