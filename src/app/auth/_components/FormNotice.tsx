"use client";

import { useState } from "react";
import { Alert, type AlertVariant } from "@/components/ui/Alert";

type FormNoticeProps = {
  message: string | null;
  variant: AlertVariant;
};

/**
 * Status message slot above an auth form. The slot grows and shrinks instead of popping in,
 * so the form below it does not jump when an error or notice appears.
 */
export default function FormNotice({ message, variant }: Readonly<FormNoticeProps>) {
  // Keep the last message while the slot collapses so the text does not vanish first
  const [last, setLast] = useState<{ message: string; variant: AlertVariant } | null>(null);
  if (message && (last?.message !== message || last.variant !== variant)) {
    setLast({ message, variant });
  }
  const shown = message ? { message, variant } : last;

  return (
    <div
      className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${
        message ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden" aria-hidden={!message}>
        <div className="pb-4">
          {shown && (
            // Remounted on each appearance so screen readers announce a repeated message
            <Alert key={message ? "open" : "closed"} variant={shown.variant}>
              {shown.message}
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
