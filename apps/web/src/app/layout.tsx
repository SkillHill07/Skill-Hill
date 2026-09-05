import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/components/providers"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

/**
 * Typography — AI_rules/design system:
 * - Inter: primary UI face (geometric-humanist, excellent at small sizes)
 * - JetBrains Mono: code/editor surfaces
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SkillHill — Competitive coding contests with real prizes",
    template: "%s · SkillHill",
  },
  description:
    "Join timed coding contests, solve problems against the clock, climb live leaderboards, and win prize money credited to your wallet.",
  keywords: [
    "coding contest",
    "competitive programming",
    "coding competition",
    "programming challenge",
    "coding practice",
  ],
  openGraph: {
    type: "website",
    siteName: "SkillHill",
    title: "SkillHill — Competitive coding contests with real prizes",
    description:
      "Timed coding contests with live leaderboards, instant judging, and automatic prize payouts.",
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "SkillHill — Competitive coding contests with real prizes",
    description:
      "Timed coding contests with live leaderboards, instant judging, and automatic prize payouts.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Applies the persisted/system theme before first paint to avoid a flash
  // of the wrong scheme. Kept tiny and dependency-free.
  const themeInit = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
