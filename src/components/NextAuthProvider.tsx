"use client"

import { SessionProvider } from "next-auth/react"
import { I18nextProvider } from "react-i18next"
import i18n from "@/i18n/client"

export default function NextAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </SessionProvider>
  )
}
