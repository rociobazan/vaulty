"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { TaskList } from "@tiptap/extension-task-list"
import { TaskItem } from "@tiptap/extension-task-item"
import Link from "@tiptap/extension-link"
import {
  Plus,
  Trash2,
  Link2,
  Unlink,
  Bold,
  Underline as UnderlineIcon,
  List,
  ListChecks,
  Check,
  X,
  Loader2,
  FileText,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  title: string
  content: object
  color: string
  createdAt: string
  updatedAt: string
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const NOTE_COLORS = {
  yellow: { card: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-300", toolbar: "bg-yellow-100/60" },
  blue:   { card: "bg-sky-50 border-sky-200",       dot: "bg-sky-300",    toolbar: "bg-sky-100/60" },
  green:  { card: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-300", toolbar: "bg-emerald-100/60" },
  pink:   { card: "bg-pink-50 border-pink-200",     dot: "bg-pink-300",   toolbar: "bg-pink-100/60" },
  purple: { card: "bg-violet-50 border-violet-200", dot: "bg-violet-300", toolbar: "bg-violet-100/60" },
  white:  { card: "bg-card border-border",          dot: "bg-slate-300",  toolbar: "bg-muted/40" },
} as const

type NoteColor = keyof typeof NOTE_COLORS

const EMPTY_CONTENT = { type: "doc", content: [{ type: "paragraph" }] }

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault() // keep editor focus
        onClick()
      }}
      title={title}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-black/8 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note, onDelete }: { note: Note; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(note.title)
  const [color, setColor] = useState<NoteColor>((note.color as NoteColor) in NOTE_COLORS ? (note.color as NoteColor) : "yellow")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const save = useCallback(
    (patch: Partial<{ title: string; content: object; color: string }>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
          keepalive: true,
        }).catch(console.error)
      }, 1200)
    },
    [note.id],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, code: false }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: (note.content as object) ?? EMPTY_CONTENT,
    editorProps: {
      attributes: {
        class: "note-editor min-h-32 px-4 py-3 text-sm focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      save({ content: editor.getJSON() })
    },
  })

  function handleTitleChange(value: string) {
    setTitle(value)
    save({ title: value })
  }

  function handleColorChange(c: NoteColor) {
    setColor(c)
    save({ color: c })
  }

  function handleLinkClick() {
    if (!editor) return
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run()
      return
    }
    if (editor.state.selection.empty) return
    setShowLinkInput(true)
    setTimeout(() => linkInputRef.current?.focus(), 40)
  }

  function applyLink() {
    if (!editor || !linkUrl.trim()) {
      setShowLinkInput(false)
      setLinkUrl("")
      return
    }
    const href = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`
    editor.chain().focus().setLink({ href }).run()
    setLinkUrl("")
    setShowLinkInput(false)
  }

  const c = NOTE_COLORS[color]

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border shadow-sm", c.card)}>
      {/* Header: color picker + title + delete */}
      <div className="flex items-center gap-2 border-b border-inherit px-3 py-2.5 bg-black/[0.03]">
        <div className="flex items-center gap-1 shrink-0">
          {(Object.keys(NOTE_COLORS) as NoteColor[]).map((key) => (
            <button
              key={key}
              onMouseDown={(e) => { e.preventDefault(); handleColorChange(key) }}
              className={cn(
                "size-3 rounded-full border-2 transition-all hover:scale-125",
                NOTE_COLORS[key].dot,
                color === key ? "border-foreground/40 scale-125" : "border-transparent",
              )}
              title={key}
            />
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Sin título"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold placeholder:font-normal placeholder:text-muted-foreground/40 focus:outline-none"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground/40 hover:text-destructive"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Formatting toolbar */}
      <div className={cn("flex items-center gap-0.5 border-b border-inherit px-2 py-1", c.toolbar)}>
        <ToolbarBtn active={editor?.isActive("bold") ?? false} onClick={() => editor?.chain().focus().toggleBold().run()} title="Negrita">
          <Bold className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor?.isActive("underline") ?? false} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Subrayado">
          <UnderlineIcon className="size-3.5" />
        </ToolbarBtn>
        <div className="mx-1 h-3.5 w-px bg-foreground/15" />
        <ToolbarBtn active={editor?.isActive("bulletList") ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Lista con viñetas">
          <List className="size-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor?.isActive("taskList") ?? false} onClick={() => editor?.chain().focus().toggleTaskList().run()} title="Lista de tareas">
          <ListChecks className="size-3.5" />
        </ToolbarBtn>
        <div className="mx-1 h-3.5 w-px bg-foreground/15" />
        <ToolbarBtn
          active={editor?.isActive("link") ?? false}
          onClick={handleLinkClick}
          title={editor?.isActive("link") ? "Quitar enlace" : "Agregar enlace (seleccioná texto)"}
        >
          {editor?.isActive("link") ? <Unlink className="size-3.5" /> : <Link2 className="size-3.5" />}
        </ToolbarBtn>
      </div>

      {/* Link URL input — appears when adding a link */}
      {showLinkInput && (
        <div className="flex items-center gap-1.5 border-b border-inherit bg-black/[0.03] px-3 py-1.5">
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink()
              if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl("") }
            }}
            placeholder="https://..."
            className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/50"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); applyLink() }}
            className="flex size-5 items-center justify-center rounded text-primary hover:bg-primary/10"
          >
            <Check className="size-3" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(false); setLinkUrl("") }}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-black/5"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Editor body */}
      <EditorContent editor={editor} />
    </div>
  )
}

// ─── NotesTab ─────────────────────────────────────────────────────────────────

export function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setNotes(data) })
      .finally(() => setLoading(false))
  }, [])

  async function createNote() {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", content: EMPTY_CONTENT, color: "yellow" }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes((prev) => [note, ...prev])
    }
  }

  async function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/notes/${id}`, { method: "DELETE" }).catch(console.error)
  }

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Notas</h2>
          <p className="text-xs text-muted-foreground">
            Se guardan automáticamente · Podés usar negrita, subrayado, listas y links
          </p>
        </div>
        <Button onClick={createNote} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Nueva nota
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-24 text-muted-foreground">
          <FileText className="size-10 opacity-25" />
          <p className="text-sm">No tenés notas todavía</p>
          <Button variant="outline" size="sm" onClick={createNote}>
            <Plus className="mr-1.5 size-3.5" />
            Crear primera nota
          </Button>
        </div>
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {notes.map((note) => (
            <div key={note.id} className="mb-5 break-inside-avoid">
              <NoteCard note={note} onDelete={deleteNote} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
