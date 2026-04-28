"use client";

import React from "react";

const ShareFormSkeleton: React.FC = () => (
  <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto">
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 justify-center">
        <div className="h-12 w-12 rounded-xl bg-[var(--border-hover)] flex-shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-[var(--border-hover)] rounded" />
          <div className="h-3 w-56 bg-[var(--border-hover)] rounded" />
        </div>
      </div>
      {/* Primary input */}
      <div className="space-y-2 mb-6">
        <div className="h-3 w-28 bg-[var(--border-hover)] rounded" />
        <div className="h-10 bg-[var(--border-hover)] rounded-lg" />
      </div>
      {/* Settings blocks */}
      <div className="h-14 bg-[var(--border-hover)] rounded-lg mb-4" />
      <div className="h-14 bg-[var(--border-hover)] rounded-lg mb-4" />
      <div className="h-14 bg-[var(--border-hover)] rounded-lg mb-6" />
      {/* Submit button */}
      <div className="h-11 bg-[var(--border-hover)] rounded-lg" />
    </div>
  </div>
);

export default ShareFormSkeleton;
