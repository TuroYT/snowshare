"use client";

import React from "react";
import Skeleton from "@mui/material/Skeleton";

const ShareFormSkeleton: React.FC = () => (
  <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto">
    {/* Header */}
    <div className="flex items-center gap-4 mb-6 justify-center">
      <Skeleton animation="wave" variant="rounded" width={48} height={48} sx={{ flexShrink: 0 }} />
      <div>
        <Skeleton animation="wave" variant="text" width={160} height={28} />
        <Skeleton animation="wave" variant="text" width={220} height={20} />
      </div>
    </div>

    {/* Primary input */}
    <div className="mb-6">
      <Skeleton animation="wave" variant="text" width={110} height={20} sx={{ mb: 1 }} />
      <Skeleton animation="wave" variant="rounded" height={42} />
    </div>

    {/* Settings blocks */}
    <Skeleton animation="wave" variant="rounded" height={56} sx={{ mb: 2 }} />
    <Skeleton animation="wave" variant="rounded" height={56} sx={{ mb: 2 }} />
    <Skeleton animation="wave" variant="rounded" height={56} sx={{ mb: 3 }} />

    {/* Submit button */}
    <Skeleton animation="wave" variant="rounded" height={44} />
  </div>
);

export default ShareFormSkeleton;
