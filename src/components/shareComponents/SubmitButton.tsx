"use client";

import React from "react";
import { Button, Spinner } from "@/components/ui";

interface SubmitButtonProps {
  loading: boolean;
  disabled: boolean;
  loadingText: string;
  submitText: string;
  /** SVG path d attribute for the button icon */
  iconPath: string;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({
  loading,
  disabled,
  loadingText,
  submitText,
  iconPath,
}) => {
  return (
    <div className="pt-2">
      <Button
        type="submit"
        disabled={disabled}
        aria-busy={loading || undefined}
        className="w-full gap-2 px-6 py-3 font-medium"
      >
        {loading ? (
          <>
            <Spinner size="sm" className="text-current" />
            {loadingText}
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
            {submitText}
          </>
        )}
      </Button>
    </div>
  );
};

export default SubmitButton;
