"use client";

import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonShareHeader from "@/components/ui/SkeletonShareHeader";

const PasteShareSkeleton = () => (
  <div className="w-full max-w-full overflow-hidden">
    <SkeletonShareHeader className="flex items-center gap-4 mb-6 lg:hidden justify-center" />

    <div className="flex flex-col lg:flex-row gap-6 w-full">
      <div className="flex-1 min-w-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 min-h-[60vh] lg:min-h-[80vh] p-4">
        <SkeletonShareHeader className="hidden lg:flex items-center gap-4 mb-6 justify-center" />
        {/* Simulated indented code lines */}
        <div className="space-y-3 pt-2">
          <WaveSkeleton variant="text" width="40%" height={20} />
          <WaveSkeleton variant="text" width="60%" height={20} sx={{ ml: 4 }} />
          <WaveSkeleton variant="text" width="50%" height={20} sx={{ ml: 4 }} />
          <WaveSkeleton variant="text" width="25%" height={20} />
          <WaveSkeleton variant="text" width="75%" height={20} />
          <WaveSkeleton variant="text" width="65%" height={20} sx={{ ml: 2 }} />
          <WaveSkeleton variant="text" width="35%" height={20} sx={{ ml: 2 }} />
          <WaveSkeleton variant="text" width="25%" height={20} />
        </div>
      </div>

      <div className="w-full lg:w-[32rem] lg:flex-shrink-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-4">
        <div className="space-y-4">
          <WaveSkeleton variant="rounded" height={42} />
          <WaveSkeleton variant="rounded" height={56} />
          <WaveSkeleton variant="rounded" height={56} />
          <WaveSkeleton variant="rounded" height={56} />
          <WaveSkeleton variant="rounded" height={44} sx={{ mt: 1 }} />
        </div>
      </div>
    </div>
  </div>
);

export default PasteShareSkeleton;
