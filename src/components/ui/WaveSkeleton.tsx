"use client";

import Skeleton, { SkeletonProps } from "@mui/material/Skeleton";

const WaveSkeleton = (props: SkeletonProps) => <Skeleton animation="wave" {...props} />;

export default WaveSkeleton;
