"use client";

import WaveSkeleton from "@/components/ui/WaveSkeleton";

interface Props {
  className?: string;
}

const SkeletonShareHeader = ({
  className = "flex items-center gap-4 mb-6 justify-center",
}: Props) => (
  <div className={className}>
    <WaveSkeleton variant="rounded" width={48} height={48} sx={{ flexShrink: 0 }} />
    <div>
      <WaveSkeleton variant="text" width={160} height={28} />
      <WaveSkeleton variant="text" width={220} height={20} />
    </div>
  </div>
);

export default SkeletonShareHeader;
