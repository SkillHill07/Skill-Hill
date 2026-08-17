"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Input, Label, Table, TBody, TD, TH, THead, TR, Textarea } from "@/components/ui"

interface WhyItem {
  _id: string
  title: string
  description: string
  icon: string
  active: boolean
  order: number
}

export function WhySection() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("trophy")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: items, isLoading } = useQuery({
    queryKey: ["site-why-admin"],
    queryFn: () => api.get<WhyItem[]>("/site/why-choose-us?includeInactive=true"),
  })

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post("/site/why-choose-us", { title, description, icon })
      setTitle("")
      setDescription("")
      setIcon("trophy")
      queryClient.invalidateQueries({ queryKey: ["site-why-admin"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(item: WhyItem) {
    try {
      await api.patch(`/site/why-choose-us/${item._id}`, { active: !item.active })
      queryClient.invalidateQueries({ queryKey: ["site-why-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/site/why-choose-us/${id}`)
      queryClient.invalidateQueries({ queryKey: ["site-why-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-semibold">New feature item</h2>
          {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wt">Title</Label>
              <Input id="wt" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wi">Icon key</Label>
              <Input id="wi" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="trophy, users, wallet, sparkles" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="wd">Description</Label>
              <Textarea id="wd" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" loading={busy} className="self-start">Create item</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <EmptyState title="Loading…" />
          ) : !items || items.length === 0 ? (
            <EmptyState title="No items" />
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Description</TH>
                  <TH>Icon</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                  <TR key={item._id}>
                    <TD className="font-medium">{item.title}</TD>
                    <TD className="max-w-[320px] truncate text-muted-foreground">{item.description}</TD>
                    <TD className="font-mono text-xs">{item.icon}</TD>
                    <TD>
                      <button onClick={() => void toggleActive(item)}>
                        <Badge tone={item.active ? "green" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
                      </button>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void remove(item._id)}>
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
