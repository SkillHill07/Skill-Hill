import type { Metadata } from "next"
import { Providers } from "@/components/providers"
import { Shell } from "@/components/shell"
import "./globals.css"

export const metadata: Metadata = {
  title: "SkillHill Admin",
  description: "SkillHill admin panel",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  )
}
