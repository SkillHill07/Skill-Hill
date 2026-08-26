"use client"

import { useEffect, useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { java } from "@codemirror/lang-java"
import { cpp } from "@codemirror/lang-cpp"
import { StreamLanguage } from "@codemirror/language"
import { go } from "@codemirror/legacy-modes/mode/go"
import type { Extension } from "@codemirror/state"

/** Map a judge-catalog language key to a CodeMirror syntax extension. */
function languageExtension(key: string): Extension[] {
  switch (key) {
    case "javascript":
      return [javascript({ jsx: true })]
    case "typescript":
      return [javascript({ typescript: true, jsx: true })]
    case "python":
      return [python()]
    case "java":
      return [java()]
    case "cpp":
    case "c":
      return [cpp()]
    case "go":
      return [StreamLanguage.define(go)]
    default:
      return []
  }
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  readOnly?: boolean
}

/** Tracks the `dark` class on <html> so the editor follows the app theme. */
function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains("dark"))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

/**
 * Professional code editor (CodeMirror 6) used by the contest workspace.
 * Falls back to plain text for languages without a registered grammar.
 */
export function CodeEditor({ value, onChange, language, readOnly }: CodeEditorProps) {
  const extensions = useMemo(() => languageExtension(language), [language])
  const isDark = useIsDarkTheme()

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background [&_.cm-editor]:bg-background [&_.cm-gutters]:bg-muted/60">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={isDark ? "dark" : "light"}
        readOnly={readOnly}
        height="min(48vh, 480px)"
        placeholder="// Write your solution here…"
        aria-label="Code editor"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          foldGutter: false,
        }}
      />
    </div>
  )
}
