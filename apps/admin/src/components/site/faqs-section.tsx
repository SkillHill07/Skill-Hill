"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Input, Label, Table, TBody, TD, TH, THead, TR, Textarea } from "@/components/ui"

interface Faq {
  _id: string
  question: string
  answer: string
  category: string | null
  active: boolean
  order: number
}

export function FaqsSection() {
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [category, setCategory] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: faqs, isLoading } = useQuery({
    queryKey: ["site-faqs-admin"],
    queryFn: () => api.get<Faq[]>("/site/faqs?includeInactive=true"),
  })

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post("/site/faqs", { question, answer, category: category || null })
      setQuestion("")
      setAnswer("")
      setCategory("")
      queryClient.invalidateQueries({ queryKey: ["site-faqs-admin"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(f: Faq) {
    try {
      await api.patch(`/site/faqs/${f._id}`, { active: !f.active })
      queryClient.invalidateQueries({ queryKey: ["site-faqs-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/site/faqs/${id}`)
      queryClient.invalidateQueries({ queryKey: ["site-faqs-admin"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-semibold">New FAQ</h2>
          {error && <div className="mb-3"><ErrorBanner message={error} /></div>}
          <form onSubmit={create} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="fq">Question</Label>
              <Input id="fq" required value={question} onChange={(e) => setQuestion(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fa">Answer</Label>
              <Textarea id="fa" required rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} />
            </div>
            <div className="max-w-[240px]">
              <Label htmlFor="fc">Category</Label>
              <Input id="fc" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="payments, contests…" />
            </div>
            <Button type="submit" loading={busy} className="self-start">Create FAQ</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <EmptyState title="Loading…" />
          ) : !faqs || faqs.length === 0 ? (
            <EmptyState title="No FAQs" />
          ) : (
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Question</TH>
                  <TH>Category</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {faqs.map((f) => (
                  <TR key={f._id}>
                    <TD className="font-medium">{f.question}</TD>
                    <TD className="text-xs text-muted-foreground">{f.category ?? "—"}</TD>
                    <TD>
                      <button onClick={() => void toggleActive(f)}>
                        <Badge tone={f.active ? "green" : "neutral"}>{f.active ? "Active" : "Inactive"}</Badge>
                      </button>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void remove(f._id)}>
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
