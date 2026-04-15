"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
  return (
    <ApiReferenceReact
      configuration={{
        spec: { url: "/api/v1/openapi.json" },
        theme: "deepSpace",
        hideModels: false,
        authentication: {
          preferredSecurityScheme: "bearerAuth",
        },
      }}
    />
  );
}
