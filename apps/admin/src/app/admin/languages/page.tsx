"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { Badge, Button, Card, CardContent, EmptyState, ErrorBanner, Input, Label, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui"

interface Language {
  key: string
  name: string
  version: string
  extension: string
  compileCommand: string | null
  runCommand: string
  dockerImage: string
  enabled: boolean
  logoUrl: string | null
}

export default function AdminLanguagesPage() {
  const queryClient = useQueryClient()
  const logoRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [editing, setEditing] = useState<string | null>(null)
  const [key, setKey] = useState("")
  const [name, setName] = useState("")
  const [version, setVersion] = useState("")
  const [extension, setExtension] = useState("")
  const [runCommand, setRunCommand] = useState("")
  const [dockerImage, setDockerImage] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: languages, isLoading } = useQuery({
    queryKey: ["admin-languages"],
    queryFn: () => api.get<Language[]>("/languages?includeDisabled=true"),
  })

  function startCreate() {
    setEditing("__new__")
    setKey("")
    setName("")
    setVersion("")
    setExtension("")
    setRunCommand("")
    setDockerImage("")
    setEnabled(true)
  }

  function startEdit(l: Language) {
    setEditing(l.key)
    setKey(l.key)
    setName(l.name)
    setVersion(l.version)
    setExtension(l.extension)
    setRunCommand(l.runCommand)
    setDockerImage(l.dockerImage)
    setEnabled(l.enabled)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (editing === "__new__") {
        await api.post("/languages", { key, name, version, extension, runCommand, dockerImage, enabled })
      } else if (editing) {
        await api.patch(`/languages/${editing}`, { name, version, extension, runCommand, dockerImage, enabled })
      }
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(langKey: string) {
    setBusy(true)
    setError(null)
    try {
      await api.del(`/languages/${langKey}`)
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function uploadLogo(langKey: string, file: File) {
    setError(null)
    try {
      const form = new FormData()
      form.append("logo", file)
      await api.post(`/languages/${langKey}/logo`, form)
      queryClient.invalidateQueries({ queryKey: ["admin-languages"] })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Languages"
        subtitle="Language catalog consumed by the judge"
        actions={
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4" /> Add language
          </Button>
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {editing && (
        <Card className="mb-4">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="key">Key</Label>
              <Input id="key" disabled={editing !== "__new__"} value={key} onChange={(e) => setKey(e.target.value)} placeholder="python" />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ext">Extension</Label>
              <Input id="ext" value={extension} onChange={(e) => setExtension(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="run">Run command</Label>
              <Input id="run" value={runCommand} onChange={(e) => setRunCommand(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="img">Docker image</Label>
              <Input id="img" value={dockerImage} onChange={(e) => setDockerImage(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Select className="w-32" value={enabled ? "true" : "false"} onChange={(e) => setEnabled(e.target.value === "true")}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
              <Button onClick={save} loading={busy}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : !languages || languages.length === 0 ? (
        <EmptyState title="No languages" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Logo</TH>
                  <TH>Key</TH>
                  <TH>Name</TH>
                  <TH>Version</TH>
                  <TH>Docker</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {languages.map((l) => (
                  <TR key={l.key}>
                    <TD>
                      <div className="flex items-center gap-2">
                        {l.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.logoUrl} alt={l.name} className="h-8 w-8 rounded-md object-contain" />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold">
                            {l.name[0]?.toUpperCase()}
                          </span>
                        )}
                        <button
                          onClick={() => logoRefs.current[l.key]?.click()}
                          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Upload
                        </button>
                        <input
                          ref={(el) => { logoRefs.current[l.key] = el }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void uploadLogo(l.key, f)
                          }}
                        />
                      </div>
                    </TD>
                    <TD className="font-mono text-xs">{l.key}</TD>
                    <TD className="font-medium">{l.name}</TD>
                    <TD>{l.version}</TD>
                    <TD className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">{l.dockerImage}</TD>
                    <TD><Badge tone={l.enabled ? "green" : "neutral"}>{l.enabled ? "Enabled" : "Disabled"}</Badge></TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(l)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => void remove(l.key)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
