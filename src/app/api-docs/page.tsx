"use client";

import { useEffect, useRef, useState } from "react";

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    let cleanup: (() => void) | undefined;

    import("@scalar/api-reference").then(({ createScalarReferences }) => {
      if (!containerRef.current) return;

      const refs = createScalarReferences(containerRef.current, {
        spec: { url: "/api/v1/openapi.json" },
        theme: "deepSpace",
        hideModels: false,
        authentication: {
          preferredSecurityScheme: "bearerAuth",
        },
      });

      cleanup = () => refs?.unmount?.();
    });

    return () => cleanup?.();
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return <div ref={containerRef} className="min-h-screen" />;
}
