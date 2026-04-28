"use client";

import React from "react";

const PasteShareSkeleton: React.FC = () => (
  <div className="w-full max-w-full overflow-hidden">
    {/* Mobile header */}
    <div className="flex items-center gap-4 mb-6 lg:hidden justify-center animate-pulse">
      <div className="h-12 w-12 rounded-xl bg-[var(--border-hover)] flex-shrink-0" />
      <div className="space-y-2">
        <div className="h-5 w-40 bg-[var(--border-hover)] rounded" />
        <div className="h-3 w-56 bg-[var(--border-hover)] rounded" />
      </div>
    </div>

    <div className="flex flex-col lg:flex-row gap-6 w-full animate-pulse">
      {/* Left: code editor area */}
      <div className="flex-1 min-w-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 min-h-[60vh] lg:min-h-[80vh] p-4">
        {/* Desktop header inside editor */}
        <div className="hidden lg:flex items-center gap-4 mb-6 justify-center">
          <div className="h-12 w-12 rounded-xl bg-[var(--border-hover)] flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-[var(--border-hover)] rounded" />
            <div className="h-3 w-56 bg-[var(--border-hover)] rounded" />
          </div>
        </div>
        {/* Fake code lines */}
        <div className="space-y-3 pt-2">
          <div className="h-4 bg-[var(--border-hover)] rounded w-2/5" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-3/5 ml-8" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-1/2 ml-8" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-1/4" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-3/4" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-2/3 ml-4" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-1/3 ml-4" />
          <div className="h-4 bg-[var(--border-hover)] rounded w-1/4" />
        </div>
      </div>

      {/* Right: settings panel */}
      <div className="w-full lg:w-[32rem] lg:flex-shrink-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-4 space-y-4">
        <div className="h-10 bg-[var(--border-hover)] rounded-lg" />
        <div className="h-14 bg-[var(--border-hover)] rounded-lg" />
        <div className="h-14 bg-[var(--border-hover)] rounded-lg" />
        <div className="h-14 bg-[var(--border-hover)] rounded-lg" />
        <div className="h-11 bg-[var(--border-hover)] rounded-lg mt-2" />
      </div>
    </div>
  </div>
);

export default PasteShareSkeleton;
