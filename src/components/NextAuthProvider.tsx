"use client"

import { SessionProvider } from "next-auth/react"
import { I18nextProvider } from "react-i18next"
import i18n from "@/i18n/client"
import { BrandingProvider } from "@/components/BrandingProvider"

export default function NextAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <BrandingProvider>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </BrandingProvider>
    </SessionProvider>
  )
}
