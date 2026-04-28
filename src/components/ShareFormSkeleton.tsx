"use client";

import WaveSkeleton from "@/components/ui/WaveSkeleton";
import SkeletonShareHeader from "@/components/ui/SkeletonShareHeader";

const ShareFormSkeleton = () => (
  <div className="bg-[var(--surface)] bg-opacity-95 p-6 rounded-2xl shadow-2xl border border-[var(--border)]/50 w-full max-w-2xl mx-auto">
    <SkeletonShareHeader />
    <div className="mb-6">
      <WaveSkeleton variant="text" width={110} height={20} sx={{ mb: 1 }} />
      <WaveSkeleton variant="rounded" height={42} />
    </div>
    <WaveSkeleton variant="rounded" height={56} sx={{ mb: 2 }} />
    <WaveSkeleton variant="rounded" height={56} sx={{ mb: 2 }} />
    <WaveSkeleton variant="rounded" height={56} sx={{ mb: 3 }} />
    <WaveSkeleton variant="rounded" height={44} />
  </div>
);

export default ShareFormSkeleton;
