"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, ErrorBanner, Input, Label, PageHeader, Skeleton, Textarea } from "@/components/ui"

interface Problem {
  _id: string
  title: string
  description: string
  type: string
  difficulty: string
  points: number
  timeLimit: number
  memoryLimit: number
  languageSupport: string[]
  imageUrls: string[]
  testCases: Array<{ _id: string; input: string; expectedOutput: string; isPublic: boolean; description?: string }>
}

export default function EditProblemPage() {
  const params = useParams<{ id: string; problemId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const imageRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [points, setPoints] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: problem, isLoading } = useQuery({
    queryKey: ["admin-problem", params.problemId],
    queryFn: () =>
      api.get<Problem>(`/contests/${params.id}/problems/${params.problemId}?includeHidden=true`),
    retry: false,
  })

  function sync() {
    if (!problem) return
    setTitle(problem.title)
    setDescription(problem.description)
    setPoints(String(problem.points))
  }

  async function save() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.patch(`/contests/${params.id}/problems/${params.problemId}`, { title, description, points: Number(points) })
      setNotice("Problem updated")
      queryClient.invalidateQueries({ queryKey: ["admin-problem", params.problemId] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadImage(file: File) {
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.append("image", file)
      await api.post(`/contests/${params.id}/problems/${params.problemId}/images`, form)
      setNotice("Image uploaded")
      queryClient.invalidateQueries({ queryKey: ["admin-problem", params.problemId] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function removeImage(index: number) {
    try {
      await api.del(`/contests/${params.id}/problems/${params.problemId}/images/${index}`)
      queryClient.invalidateQueries({ queryKey: ["admin-problem", params.problemId] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function deleteTestCase(tcId: string) {
    try {
      await api.del(`/contests/${params.id}/problems/${params.problemId}/test-cases/${tcId}`)
      queryClient.invalidateQueries({ queryKey: ["admin-problem", params.problemId] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (isLoading) return <Skeleton className="h-96" />
  if (!problem) return <div className="py-10 text-center text-muted-foreground">Problem not found</div>
  if (!title) sync()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={problem.title}
        subtitle={`${problem.type} · ${problem.difficulty} · ${problem.points} pts`}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push(`/admin/contests/${params.id}`)}>
            Back to contest
          </Button>
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="desc">Statement</Label>
              <Textarea id="desc" rows={10} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="max-w-[200px]">
              <Label htmlFor="points">Points</Label>
              <Input id="points" type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
            <Button onClick={save} loading={busy}>Save changes</Button>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="font-semibold">Statement images</h2>
            {problem.imageUrls.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {problem.imageUrls.map((url, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`image ${i + 1}`} className="h-32 w-full object-cover" />
                    <button
                      onClick={() => void removeImage(i)}
                      className="absolute right-1 top-1 rounded-md bg-red-600 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => imageRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Upload image
              </Button>
              <input
                ref={imageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadImage(f)
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Test cases */}
        {problem.type === "coding" && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="font-semibold">Test cases ({problem.testCases.length})</h2>
              {problem.testCases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No test cases — add them via the API or extend this panel.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {problem.testCases.map((tc) => (
                    <li key={tc._id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone={tc.isPublic ? "blue" : "neutral"}>{tc.isPublic ? "Public" : "Hidden"}</Badge>
                          {tc.description && <span className="truncate text-muted-foreground">{tc.description}</span>}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          in: {tc.input.slice(0, 40)} → out: {tc.expectedOutput.slice(0, 40)}
                        </p>
                      </div>
                      <button onClick={() => void deleteTestCase(tc._id)} className="text-muted-foreground transition-colors hover:text-red-500" aria-label="Delete test case">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
