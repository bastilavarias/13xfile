import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Ellipsis,
  File,
  FolderOpen,
  Globe2,
  Link2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

const API = "http://127.0.0.1:8791/api"

type VaultFile = {
  id: string
  name: string
  cid: string
  size: number
  mime: string
  visibility?: "public" | "private"
  cipher?: string
  local: boolean
}

type Transfer = {
  id: string
  name: string
  size: number
  visibility: "public" | "private"
  status: "queued" | "running" | "complete" | "failed" | "cancelled"
  stage: string
  progress: number
  cid?: string
  error?: string
}

type VaultStatus = {
  peerId: string
  vaultId: string
  joinCode: string
  files: VaultFile[]
  lastError?: string
}

type AppState = {
  nodeOnline: boolean
  connectedPeers: number
  peerId?: string
  needsVault: boolean
  vault?: VaultStatus
  transfers: Transfer[]
  paused: boolean
  fatal?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API + path, init)
  if (!response.ok) throw new Error((await response.text()) || response.statusText)
  return response.json()
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function shortCID(cid: string) {
  if (!cid || cid.length < 20) return cid
  return `${cid.slice(0, 10)}…${cid.slice(-7)}`
}

async function downloadBlob(url: string, fallbackName = "13xfile-download") {
  const response = await fetch(url)
  if (!response.ok) throw new Error(await response.text())
  const disposition = response.headers.get("content-disposition") || ""
  const match = disposition.match(/filename="?([^"]+)"?/)
  const name = match?.[1] || fallbackName
  const blob = await response.blob()
  const objectURL = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectURL
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(objectURL), 5000)
}

function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [visibility, setVisibility] = useState<"private" | "public">("private")
  const [joinCode, setJoinCode] = useState("")
  const [vaultBusy, setVaultBusy] = useState(false)
  const [staging, setStaging] = useState(false)
  const [trayOpen, setTrayOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState("")
  const [webShareLink, setWebShareLink] = useState("")
  const [shareFile, setShareFile] = useState("")
  const [shareVisibility, setShareVisibility] = useState<"public" | "private">("public")
  const [openLinkOpen, setOpenLinkOpen] = useState(false)
  const [incomingLink, setIncomingLink] = useState("")
  const [toast, setToast] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    try {
      setState(await request<AppState>("/state"))
    } catch {
      // The backend may still be booting.
    }
  }

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 900)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cleanup: undefined | (() => void)
    const runtimePath = "/wails/runtime.js"
    import(/* @vite-ignore */ runtimePath)
      .then(({ Events }) => {
        const off = Events.On("files-dropped", (event: { data?: { files?: string[] } }) => {
          const files = event?.data?.files || []
          if (files.length) queuePaths(files)
        })
        if (typeof off === "function") cleanup = off
      })
      .catch(() => {})
    return () => cleanup?.()
  }, [visibility, state?.vault?.vaultId])

  const queuePaths = async (paths: string[]) => {
    if (!state?.vault) return
    try {
      await request("/uploads/paths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths, visibility }),
      })
      setTrayOpen(true)
      refresh()
    } catch (error) {
      flash(String(error))
    }
  }

  const uploadFiles = async (files: FileList | File[]) => {
    if (!state?.vault || files.length === 0) return
    const form = new FormData()
    Array.from(files).forEach((file) => form.append("files", file, file.name))
    setStaging(true)
    try {
      const response = await fetch(API + `/uploads/files?visibility=${visibility}`, {
        method: "POST",
        body: form,
      })
      if (!response.ok) throw new Error(await response.text())
      setTrayOpen(true)
      await refresh()
    } catch (error) {
      flash(String(error))
    } finally {
      setStaging(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const createOrJoinVault = async (code = "") => {
    setVaultBusy(true)
    try {
      await request("/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      await refresh()
    } catch (error) {
      flash(String(error))
    } finally {
      setVaultBusy(false)
    }
  }

  const flash = (message: string) => {
    setToast(message.replace(/^Error:\s*/, ""))
    window.setTimeout(() => setToast(""), 2800)
  }

  const openShare = async (file: VaultFile) => {
    try {
      const data = await request<{ link: string; webLink?: string }>(`/files/${file.id}/share`)
      setShareFile(file.name)
      setShareVisibility(file.visibility === "private" ? "private" : "public")
      setShareLink(data.link)
      setWebShareLink(data.webLink || "")
      setShareOpen(true)
    } catch (error) {
      flash(String(error))
    }
  }

  const copy = async (value: string, label = "Copied") => {
    await navigator.clipboard.writeText(value)
    flash(label)
  }

  const downloadFile = async (file: VaultFile) => {
    try {
      await downloadBlob(API + `/files/${file.id}/content`, file.name)
    } catch (error) {
      flash(String(error))
    }
  }

  const downloadIncoming = async () => {
    if (!incomingLink.trim()) return
    try {
      await downloadBlob(API + "/share/content?link=" + encodeURIComponent(incomingLink.trim()))
      setOpenLinkOpen(false)
      setIncomingLink("")
    } catch (error) {
      flash(String(error))
    }
  }

  const togglePause = async () => {
    if (!state) return
    await request("/pause", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paused: !state.paused }),
    })
    refresh()
  }

  const activeTransfers = state?.transfers.filter((t) => t.status === "queued" || t.status === "running") || []
  const visibleTransfers = state?.transfers.slice(0, 6) || []
  const aggregate = useMemo(() => {
    if (!activeTransfers.length) return 100
    return Math.round(activeTransfers.reduce((sum, item) => sum + item.progress, 0) / activeTransfers.length)
  }, [activeTransfers])

  if (!state) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Starting 13xfile…</div>
  }

  if (state.needsVault) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <section className="w-full max-w-md rounded-2xl border bg-background p-7 shadow-sm">
          <div className="mb-7">
            <div className="text-2xl font-semibold tracking-[-0.04em]">13xfile</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Create a decentralized vault or join one from another device.
            </p>
          </div>
          <Button className="w-full" size="lg" disabled={vaultBusy} onClick={() => createOrJoinVault("")}>
            Create new vault
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or join existing <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-2">
            <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Vault join code" />
            <Button variant="outline" disabled={vaultBusy || joinCode.trim().length < 12} onClick={() => createOrJoinVault(joinCode)}>
              Join
            </Button>
          </div>
          <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
            Prototype note: the vault code is currently the shared demo authority. Treat it as a secret.
          </p>
        </section>
        {toast && <Toast text={toast} />}
      </main>
    )
  }

  const files = state.vault?.files || []

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b px-7">
        <div className="flex items-center gap-4">
          <div className="text-xl font-semibold tracking-[-0.04em]">13xfile</div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${state.nodeOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            {state.nodeOnline ? `${state.connectedPeers} peers` : "Connecting"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpenLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> Open link
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Vault <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => copy(state.vault?.joinCode || "", "Vault code copied")}>
                <Copy className="mr-2 h-4 w-4" /> Copy join code
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => copy(state.vault?.vaultId || "", "Vault ID copied")}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Copy vault ID
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-7 pb-28 pt-7">
        {state.fatal && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.fatal}</div>
        )}

        <section
          data-file-drop-target
          className="mb-7 rounded-xl border border-dashed border-border bg-background px-8 py-10 text-center transition-colors"
        >
          <UploadCloud className="mx-auto mb-3 h-7 w-7" strokeWidth={1.6} />
          <div className="text-sm font-medium">Drop files here</div>
          <div className="mt-1 text-xs text-muted-foreground">or choose multiple files from this computer</div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <div className="inline-flex rounded-lg border bg-muted p-0.5">
              <button
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${visibility === "private" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setVisibility("private")}
              >
                <Lock className="h-3.5 w-3.5" /> Private
              </button>
              <button
                className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${visibility === "public" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setVisibility("public")}
              >
                <Globe2 className="h-3.5 w-3.5" /> Public
              </button>
            </div>
            <Button onClick={() => inputRef.current?.click()} disabled={staging}>
              <FolderOpen className="h-4 w-4" /> {staging ? "Staging…" : "Choose files"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => event.target.files && uploadFiles(event.target.files)}
            />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-[11px] leading-5 text-muted-foreground">
            Private files are encrypted locally before entering IPFS. Public files are stored as normal IPFS content.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Files</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{files.length} in this vault</p>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-background">
            {files.length === 0 ? (
              <div className="py-16 text-center">
                <File className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm">Nothing here yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Drop a file above to prove the network.</p>
              </div>
            ) : (
              files.map((file, index) => (
                <div
                  key={file.id}
                  className={`grid grid-cols-[minmax(0,1fr)_110px_125px_140px_42px] items-center gap-4 px-4 py-3.5 ${index ? "border-t" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <button className="mt-1 font-mono text-[10px] text-muted-foreground hover:text-foreground" onClick={() => copy(file.cid, "CID copied")}>
                      {shortCID(file.cid)}
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                  <div>
                    <Badge variant="outline" className="gap-1">
                      {file.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
                      {file.visibility === "private" ? "Private" : "Public"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${file.local ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="text-muted-foreground">{file.local ? "Stored here" : "Replicating"}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><Ellipsis className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => downloadFile(file)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openShare(file)}>
                        <Link2 className="mr-2 h-4 w-4" /> Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => copy(file.cid, "CID copied")}>
                        <Copy className="mr-2 h-4 w-4" /> Copy CID
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          {state.vault?.lastError && (
            <p className="mt-3 text-xs text-amber-700">Vault sync: {state.vault.lastError}</p>
          )}
        </section>
      </main>

      {state.transfers.length > 0 && (
        <aside className="fixed bottom-5 right-5 z-40 w-[360px] overflow-hidden rounded-xl border bg-background shadow-2xl">
          <button className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setTrayOpen(!trayOpen)}>
            <div>
              <div className="text-sm font-semibold">
                {activeTransfers.length ? `Transfers · ${activeTransfers.length}` : "Transfers complete"}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {activeTransfers.length ? `${aggregate}% overall · continues in background` : "Files remain available while the node runs"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeTransfers.length > 0 && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); togglePause() }}>
                  {state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${trayOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          {activeTransfers.length > 0 && <Progress value={aggregate} className="rounded-none" />}
          {trayOpen && (
            <div className="max-h-80 overflow-auto border-t">
              {visibleTransfers.map((item) => (
                <div key={item.id} className="border-b px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{item.stage}</span>
                        <span>·</span>
                        <span>{item.visibility}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.status === "complete" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : item.status === "failed" ? (
                        <Button variant="ghost" size="icon" onClick={() => request(`/transfers/${item.id}/retry`, { method: "POST" }).then(refresh)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => request(`/transfers/${item.id}/cancel`, { method: "POST" }).then(refresh)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {item.status !== "complete" && item.status !== "failed" && item.status !== "cancelled" && (
                    <Progress value={item.progress} className="mt-2" />
                  )}
                  {item.error && <div className="mt-1 text-[10px] text-red-600">{item.error}</div>}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {shareFile}</DialogTitle>
            <DialogDescription>
              {shareVisibility === "public"
                ? "Anyone with the web link can download this public file in a browser. No 13xfile app is required."
                : "Private browser sharing is intentionally not enabled yet. The 13xfile app link still works between desktop clients."}
            </DialogDescription>
          </DialogHeader>
          {shareVisibility === "public" && webShareLink && (
            <div className="space-y-2">
              <div className="text-xs font-medium">Web link</div>
              <div className="flex gap-2">
                <Input readOnly value={webShareLink} className="font-mono text-xs" />
                <Button onClick={() => copy(webShareLink, "Web link copied")}><Copy className="h-4 w-4" /> Copy</Button>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                Opens a static 13xfile page with a one-click download button.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="text-xs font-medium">13xfile app link</div>
            <div className="flex gap-2">
              <Input readOnly value={shareLink} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(shareLink, "13xfile link copied")}><Copy className="h-4 w-4" /> Copy</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openLinkOpen} onOpenChange={setOpenLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a 13xfile link</DialogTitle>
            <DialogDescription>Paste a public or private share link from another vault.</DialogDescription>
          </DialogHeader>
          <Input
            value={incomingLink}
            onChange={(e) => setIncomingLink(e.target.value)}
            placeholder="13xfile://share/..."
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button disabled={!incomingLink.startsWith("13xfile://share/")} onClick={downloadIncoming}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast text={toast} />}
    </div>
  )
}

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-xl">
      {text}
    </div>
  )
}

export default App
