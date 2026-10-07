import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { detectLocaleFromHeaders } from "@/lib/i18n-server";
import { getShareEmbedMetadata, getShareEmbedViewport } from "@/lib/share-embed";

// Server layout for the client share page: it provides the link preview metadata
export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>): Promise<Metadata> {
  const { slug } = await params;
  return getShareEmbedMetadata(slug, "FILE", detectLocaleFromHeaders(await headers()));
}

export function generateViewport(): Promise<Viewport> {
  return getShareEmbedViewport();
}

export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
