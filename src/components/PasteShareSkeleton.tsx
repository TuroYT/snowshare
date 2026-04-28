"use client";

import React from "react";
import Skeleton from "@mui/material/Skeleton";

const PasteShareSkeleton: React.FC = () => (
  <div className="w-full max-w-full overflow-hidden">
    {/* Mobile header */}
    <div className="flex items-center gap-4 mb-6 lg:hidden justify-center">
      <Skeleton animation="wave" variant="rounded" width={48} height={48} sx={{ flexShrink: 0 }} />
      <div>
        <Skeleton animation="wave" variant="text" width={160} height={28} />
        <Skeleton animation="wave" variant="text" width={220} height={20} />
      </div>
    </div>

    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* Left: code editor area */}
      <div className="flex-1 min-w-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 min-h-[60vh] lg:min-h-[80vh] p-4">
        {/* Desktop header inside editor */}
        <div className="hidden lg:flex items-center gap-4 mb-6 justify-center">
          <Skeleton animation="wave" variant="rounded" width={48} height={48} sx={{ flexShrink: 0 }} />
          <div>
            <Skeleton animation="wave" variant="text" width={160} height={28} />
            <Skeleton animation="wave" variant="text" width={220} height={20} />
          </div>
        </div>
        {/* Fake code lines */}
        <div className="space-y-3 pt-2">
          <Skeleton animation="wave" variant="text" width="40%" height={20} />
          <Skeleton animation="wave" variant="text" width="60%" height={20} sx={{ ml: 4 }} />
          <Skeleton animation="wave" variant="text" width="50%" height={20} sx={{ ml: 4 }} />
          <Skeleton animation="wave" variant="text" width="25%" height={20} />
          <Skeleton animation="wave" variant="text" width="75%" height={20} />
          <Skeleton animation="wave" variant="text" width="65%" height={20} sx={{ ml: 2 }} />
          <Skeleton animation="wave" variant="text" width="35%" height={20} sx={{ ml: 2 }} />
          <Skeleton animation="wave" variant="text" width="25%" height={20} />
        </div>
      </div>

      {/* Right: settings panel */}
      <div className="w-full lg:w-[32rem] lg:flex-shrink-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-4">
        <div className="space-y-4">
          <Skeleton animation="wave" variant="rounded" height={42} />
          <Skeleton animation="wave" variant="rounded" height={56} />
          <Skeleton animation="wave" variant="rounded" height={56} />
          <Skeleton animation="wave" variant="rounded" height={56} />
          <Skeleton animation="wave" variant="rounded" height={44} sx={{ mt: 1 }} />
        </div>
      </div>
    </div>
  </div>
);

export default PasteShareSkeleton;
