"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import LockedShare from "@/components/shareComponents/LockedShare";
import ReverseSharesSection from "@/components/ReverseSharesSection";

/** Home tab to create and manage upload requests (reverse shares), for signed-in users. */
const ReverseShare: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return <LockedShare type="reverse" isLoading={isLoading} isLocked={!isAuthenticated} />;
  }

  return (
    <div className="w-full max-w-3xl text-left">
      <ReverseSharesSection />
    </div>
  );
};

export default ReverseShare;
