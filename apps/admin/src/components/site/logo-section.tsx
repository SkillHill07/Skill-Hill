"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label, Skeleton } from "@/components/ui"

interface SiteLogo {
  logoUrl: string | null
  altText: string
  tagline: string | null
}

export function LogoSection() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [altText, setAltText] = useState("")
  const [tagline, setTagline] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: logo, isLoading } = useQuery({
    queryKey: ["site-logo"],
    queryFn: () => api.get<SiteLogo>("/site/logo"),
    retry: false,
  })

  if (isLoading) return <Skeleton className="h-48" />
  if (logo && !altText) {
    setAltText(logo.altText)
    setTagline(logo.tagline ?? "")
  }

  async function save() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.put("/site/logo", { altText, tagline: tagline || null })
      setNotice("Logo settings saved")
      queryClient.invalidateQueries({ queryKey: ["site-logo"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File) {
    setError(null)
    try {
      const form = new FormData()
      form.append("image", file)
      await api.post("/site/logo/upload", form)
      setNotice("Logo uploaded")
      queryClient.invalidateQueries({ queryKey: ["site-logo"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-4">
          {logo?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.logoUrl} alt="site logo" className="h-16 w-16 rounded-xl border border-border object-contain" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">No logo</span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Upload logo</Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f)
              }}
            />
          </div>
        </div>
        {error && <ErrorBanner message={error} />}
        {notice && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
        )}
        <div>
          <Label htmlFor="alt">Alt text</Label>
          <Input id="alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <Button onClick={save} loading={busy} className="self-start">Save</Button>
      </CardContent>
    </Card>
  )
}
