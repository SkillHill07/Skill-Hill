"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Input, Label, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

interface Banner {
  _id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  ctaText: string | null
  ctaLink: string | null
  active: boolean
  order: number
}

export function BannersSection() {
  const queryClient = useQueryClient()
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [ctaText, setCtaText] = useState("")
  const [ctaLink, setCtaLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: banners, isLoading } = useQuery({
    queryKey: ["site-banners-admin"],
    queryFn: () => api.get<Banner[]>("/site/banners?includeInactive=true"),
  })

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post("/site/banners", { title, subtitle: subtitle || null, ctaText: ctaText || null, ctaLink: ctaLink || null })
      setTitle("")
      setSubtitle("")
      setCtaText("")
      setCtaLink("")
      queryClient.invalidateQueries({ queryKey: ["site-banners-admin"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(b: Banner) {
    try {
      await api.patch(`/site/banners/${b._id}`, { active: !b.active })
      queryClient.invalidateQueries({ queryKey: ["site-banners-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/site/banners/${id}`)
      queryClient.invalidateQueries({ queryKey: ["site-banners-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function uploadImage(id: string, file: File) {
    try {
      const form = new FormData()
      form.append("image", file)
      await api.post(`/site/banners/${id}/image`, form)
      queryClient.invalidateQueries({ queryKey: ["site-banners-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-semibold">New banner</h2>
          {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bt">Title</Label>
              <Input id="bt" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bs">Subtitle</Label>
              <Input id="bs" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bct">CTA text</Label>
              <Input id="bct" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bcl">CTA link</Label>
              <Input id="bcl" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} />
            </div>
            <Button type="submit" loading={busy} className="self-end">Create banner</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <EmptyState title="Loading…" />
          ) : !banners || banners.length === 0 ? (
            <EmptyState title="No banners" />
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Preview</TH>
                  <TH>Title</TH>
                  <TH>CTA</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {banners.map((b) => (
                  <TR key={b._id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        {b.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.imageUrl} alt={b.title} className="h-10 w-24 rounded object-cover" />
                        ) : (
                          <span className="flex h-10 w-24 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">No image</span>
                        )}
                        <button
                          onClick={() => fileRefs.current[b._id]?.click()}
                          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Upload
                        </button>
                        <input
                          ref={(el) => { fileRefs.current[b._id] = el }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void uploadImage(b._id, f)
                          }}
                        />
                      </div>
                    </TD>
                    <TD className="font-medium">{b.title}</TD>
                    <TD className="text-xs text-muted-foreground">{b.ctaText ?? "—"}</TD>
                    <TD>
                      <button onClick={() => void toggleActive(b)}>
                        <Badge tone={b.active ? "green" : "neutral"}>{b.active ? "Active" : "Inactive"}</Badge>
                      </button>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void remove(b._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
