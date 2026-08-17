"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label, PageHeader, Select, Textarea } from "@/components/ui"

function toPaise(rupees: string): number {
  return Math.round(Number(rupees) * 100)
}

export default function NewContestPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [rules, setRules] = useState("")
  const [type, setType] = useState<"free" | "paid">("free")
  const [entryFee, setEntryFee] = useState("20")
  const [prizePool, setPrizePool] = useState("10000")
  const [maxParticipants, setMaxParticipants] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = {
        title,
        description,
        rules,
        type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        entryFee: type === "paid" ? toPaise(entryFee) : 0,
        prizePool: toPaise(prizePool),
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      }
      const contest = await api.post<{ _id: string }>("/contests", body)
      router.push(`/admin/contests/${contest._id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New contest"
        subtitle="Creates a draft — add problems, then publish"
        actions={
          <Link href="/admin/contests">
            <Button variant="outline" size="sm">Back</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-6">
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="type">Contest type</Label>
              <Select id="type" value={type} onChange={(e) => setType(e.target.value as "free" | "paid")}>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {type === "paid" && (
                <div>
                  <Label htmlFor="fee">Entry fee (₹)</Label>
                  <Input id="fee" type="number" min={1} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
                </div>
              )}
              <div>
                <Label htmlFor="pool">Prize pool (₹)</Label>
                <Input id="pool" type="number" min={0} value={prizePool} onChange={(e) => setPrizePool(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="max">Max participants (optional)</Label>
                <Input id="max" type="number" min={1} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="start">Start time</Label>
                <Input id="start" type="datetime-local" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="end">End time</Label>
                <Input id="end" type="datetime-local" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div>
              <Label htmlFor="rules">Rules (optional)</Label>
              <Textarea id="rules" rows={4} value={rules} onChange={(e) => setRules(e.target.value)} />
            </div>

            <Button type="submit" loading={busy} size="lg">Create draft</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
