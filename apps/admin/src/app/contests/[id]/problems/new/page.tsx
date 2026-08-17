"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, CardContent, ErrorBanner, Input, Label, PageHeader, Select, Textarea } from "@/components/ui"

export default function NewProblemPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [type, setType] = useState<"coding" | "mcq">("coding")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [difficulty, setDifficulty] = useState("easy")
  const [points, setPoints] = useState("100")
  const [timeLimit, setTimeLimit] = useState("2000")
  const [memoryLimit, setMemoryLimit] = useState("256")
  const [languageSupport, setLanguageSupport] = useState("javascript,python")
  const [options, setOptions] = useState("")
  const [correctAnswer, setCorrectAnswer] = useState("0")
  const [publicInput, setPublicInput] = useState("")
  const [publicOutput, setPublicOutput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        title,
        description,
        type,
        difficulty,
        points: Number(points),
      }
      if (type === "coding") {
        body.timeLimit = Number(timeLimit)
        body.memoryLimit = Number(memoryLimit)
        body.languageSupport = languageSupport.split(",").map((s) => s.trim()).filter(Boolean)
        if (publicInput.trim() && publicOutput.trim()) {
          body.testCases = [{ input: publicInput, expectedOutput: publicOutput, isPublic: true }]
        }
      } else {
        const opts = options.split("\n").map((s) => s.trim()).filter(Boolean)
        body.options = opts
        body.correctAnswer = Number(correctAnswer)
      }
      await api.post(`/contests/${params.id}/problems`, body)
      router.push(`/admin/contests/${params.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New problem" subtitle="Coding problems are judged by test cases; MCQ by the selected option" />

      <Card>
        <CardContent className="p-6">
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="type">Problem type</Label>
              <Select id="type" value={type} onChange={(e) => setType(e.target.value as "coding" | "mcq")}>
                <option value="coding">Coding</option>
                <option value="mcq">Multiple choice</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="desc">Description / statement</Label>
              <Textarea id="desc" required rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="diff">Difficulty</Label>
                <Select id="diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="points">Points</Label>
                <Input id="points" type="number" min={1} required value={points} onChange={(e) => setPoints(e.target.value)} />
              </div>
              {type === "coding" && (
                <div>
                  <Label htmlFor="langs">Languages (comma-separated keys)</Label>
                  <Input id="langs" value={languageSupport} onChange={(e) => setLanguageSupport(e.target.value)} />
                </div>
              )}
            </div>

            {type === "coding" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tl">Time limit (ms)</Label>
                    <Input id="tl" type="number" min={100} max={30000} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ml">Memory limit (MB)</Label>
                    <Input id="ml" type="number" min={16} max={1024} value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="pi">Public example input</Label>
                    <Textarea id="pi" rows={3} value={publicInput} onChange={(e) => setPublicInput(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="po">Public example output</Label>
                    <Textarea id="po" rows={3} value={publicOutput} onChange={(e) => setPublicOutput(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="opts">Options (one per line)</Label>
                  <Textarea id="opts" required rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
                </div>
                <div className="max-w-[200px]">
                  <Label htmlFor="ca">Correct option (0-based)</Label>
                  <Input id="ca" type="number" min={0} required value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
                </div>
              </>
            )}

            <Button type="submit" loading={busy} size="lg">Create problem</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
