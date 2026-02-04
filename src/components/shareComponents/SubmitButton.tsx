"use client";

import React from "react";

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
      <button
        type="submit"
        disabled={disabled}
        className="btn-paste w-full inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {loadingText}
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={iconPath}
              />
            </svg>
            {submitText}
          </>
        )}
      </button>
    </div>
  );
};

export default SubmitButton;
