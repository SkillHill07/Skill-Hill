"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui"
import { LogoSection } from "@/components/site/logo-section"
import { BannersSection } from "@/components/site/banners-section"
import { FaqsSection } from "@/components/site/faqs-section"
import { WhySection } from "@/components/site/why-section"
import { cn } from "@skillcontest/ui"

const TABS = [
  { key: "logo", label: "Logo" },
  { key: "banners", label: "Banners" },
  { key: "faqs", label: "FAQs" },
  { key: "why", label: "Why choose us" },
]

export default function AdminSitePage() {
  const [tab, setTab] = useState("logo")

  return (
    <div>
      <PageHeader title="Site content" subtitle="Manage the marketing site's logo, banners, FAQs, and feature items" />

      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "logo" && <LogoSection />}
      {tab === "banners" && <BannersSection />}
      {tab === "faqs" && <FaqsSection />}
      {tab === "why" && <WhySection />}
    </div>
  )
}
