import { useEffect, useMemo, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Ellipsis,
  File,
  FolderOpen,
  Globe2,
  HardDrive,
  Link2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
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

type ReplicaReceipt = {
  deviceId: string
  peerId?: string
  cid: string
  at: string
}

type VaultFile = {
  id: string
  name: string
  cid: string
  size: number
  mime: string
  visibility?: "public" | "private"
  cipher?: string
  keyWrap?: string
  local: boolean
  replicaCount?: number
  replicas?: ReplicaReceipt[]
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
  deviceId: string
  vaultId: string
  joinCode: string
  files: VaultFile[]
  lastError?: string
}

type Settings = {
  replicationTarget: number
  storageMax: string
  keepRunningOnClose: boolean
  startOnLogin: boolean
  downloadDir: string
}

type AppState = {
  nodeOnline: boolean
  connectedPeers: number
  peerId?: string
  needsVault: boolean
  vault?: VaultStatus
  transfers: Transfer[]
  paused: boolean
  settings: Settings
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
  const [searchQuery, setSearchQuery] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [vaultBusy, setVaultBusy] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState("")
  const [staging, setStaging] = useState(false)
  const [trayOpen, setTrayOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState("")
  const [webShareLink, setWebShareLink] = useState("")
  const [shareFile, setShareFile] = useState("")
  const [shareVisibility, setShareVisibility] = useState<"public" | "private">("public")
  const [openLinkOpen, setOpenLinkOpen] = useState(false)
  const [incomingLink, setIncomingLink] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftSettings, setDraftSettings] = useState<Settings | null>(null)
  const [detailFile, setDetailFile] = useState<VaultFile | null>(null)
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
        const offFiles = Events.On("files-dropped", (event: { data?: { files?: string[] } }) => {
          const files = event?.data?.files || []
          if (files.length) queuePaths(files)
        })
        const offShare = Events.On("share-link", (event: { data?: string } | string) => {
          const value = typeof event === "string" ? event : event?.data
          if (value?.startsWith("x13file://share/") || value?.startsWith("13xfile://share/")) {
            setIncomingLink(value)
            setOpenLinkOpen(true)
          }
        })
        cleanup = () => {
          if (typeof offFiles === "function") offFiles()
          if (typeof offShare === "function") offShare()
        }
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
      const vault = await request<VaultStatus>("/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      if (!code.trim()) {
        setRecoveryCode(vault.joinCode)
        setRecoveryOpen(true)
      }
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
      const data = await request<{ path: string }>(`/files/${file.id}/save`, { method: "POST" })
      flash(`Saved to ${data.path}`)
    } catch (error) {
      flash(String(error))
    }
  }

  const removeFile = async (file: VaultFile) => {
    const confirmed = window.confirm(`Remove "${file.name}" from this vault? This publishes a removal to the vault but does not erase copies already shared outside it.`)
    if (!confirmed) return
    try {
      await request(`/files/${file.id}/remove`, { method: "POST" })
      setDetailFile(null)
      await refresh()
      flash("File removed from vault")
    } catch (error) {
      flash(String(error))
    }
  }

  const openSettings = () => {
    if (!state) return
    setDraftSettings({ ...state.settings })
    setSettingsOpen(true)
  }

  const saveSettings = async () => {
    if (!draftSettings) return
    try {
      await request<Settings>("/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftSettings),
      })
      setSettingsOpen(false)
      await refresh()
      flash("Settings saved")
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

  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("share")
    if (incoming?.startsWith("x13file://share/") || incoming?.startsWith("13xfile://share/")) {
      setIncomingLink(incoming)
      setOpenLinkOpen(true)
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

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
            Your vault recovery code is required to add another device. Keep it private and store a copy somewhere safe.
          </p>
        </section>
        {toast && <Toast text={toast} />}
      </main>
    )
  }

  const files = state.vault?.files || []
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

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
          <Button variant="ghost" size="sm" onClick={openSettings}>
            <Settings2 className="h-4 w-4" /> Settings
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Vault <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => copy(state.vault?.joinCode || "", "Vault code copied")}>
                <Copy className="mr-2 h-4 w-4" /> Copy recovery code
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
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Files</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {files.length} files · {files.filter((file) => (file.replicaCount || 0) >= state.settings.replicationTarget).length} safe
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files"
                className="h-8 w-56 text-xs"
              />
              <Button variant="ghost" size="sm" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-background">
            {filteredFiles.length === 0 ? (
              <div className="py-16 text-center">
                <File className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm">{files.length ? "No matching files" : "Nothing here yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {files.length ? "Try another search." : "Drop files above to add them to this vault."}
                </p>
              </div>
            ) : (
              filteredFiles.map((file, index) => (
                <div
                  key={file.id}
                  className={`grid grid-cols-[minmax(0,1fr)_100px_115px_175px_42px] items-center gap-4 px-4 py-3.5 ${index ? "border-t" : ""}`}
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
                  <button className="text-left" onClick={() => setDetailFile(file)}>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          (file.replicaCount || 0) >= state.settings.replicationTarget ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="font-medium">
                        {file.replicaCount || 0}/{state.settings.replicationTarget}
                      </span>
                      <span className="text-muted-foreground">
                        {(file.replicaCount || 0) >= state.settings.replicationTarget ? "Safe" : "Replicating"}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {file.local ? "Stored on this device" : "Retrieving to this device"}
                    </div>
                  </button>
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
                      <DropdownMenuItem onSelect={() => setDetailFile(file)}>
                        <HardDrive className="mr-2 h-4 w-4" /> Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => copy(file.cid, "CID copied")}>
                        <Copy className="mr-2 h-4 w-4" /> Copy CID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => removeFile(file)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from vault
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>

          {state.vault?.lastError && (
            <p className="mt-3 text-xs text-amber-700">
              Vault sync needs attention. Open Settings → Diagnostics for technical details.
            </p>
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

      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your recovery code</DialogTitle>
            <DialogDescription>
              This code lets another 13xfile device join your vault. Treat it like a password.
            </DialogDescription>
          </DialogHeader>
          <button
            className="rounded-xl border bg-muted/40 px-4 py-4 text-center font-mono text-sm font-semibold tracking-wider hover:bg-muted"
            onClick={() => copy(recoveryCode, "Recovery code copied")}
          >
            {recoveryCode}
          </button>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900">
            Anyone with this code can join the current MVP vault. Store it privately before continuing.
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setRecoveryOpen(false)}>I saved it</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className={shareVisibility === "public" ? "max-w-2xl" : undefined}>
          <DialogHeader>
            <DialogTitle>Share {shareFile}</DialogTitle>
            <DialogDescription>
              {shareVisibility === "public"
                ? "Anyone with the web link can download this public file in a browser. No 13xfile app is required."
                : "Private browser sharing is intentionally not enabled yet. The 13xfile app link still works between desktop clients."}
            </DialogDescription>
          </DialogHeader>
          {shareVisibility === "public" && webShareLink && (
            <div className="grid gap-5 sm:grid-cols-[1fr_154px]">
              <div className="space-y-2">
                <div className="text-xs font-medium">Web link</div>
                <div className="flex gap-2">
                  <Input readOnly value={webShareLink} className="font-mono text-xs" />
                  <Button onClick={() => copy(webShareLink, "Web link copied")}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Anyone can open this public file in a browser. No 13xfile app is required.
                </p>
              </div>

              <div className="rounded-xl border bg-white p-3">
                <div className="mx-auto w-fit rounded-lg bg-white p-1.5">
                  <QRCodeSVG
                    value={webShareLink}
                    size={118}
                    level="M"
                    marginSize={0}
                    bgColor="#ffffff"
                    fgColor="#111111"
                  />
                </div>
                <div className="mt-2 text-center text-[10px] font-medium text-muted-foreground">
                  Scan to open
                </div>
              </div>
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

      <Dialog open={detailFile !== null} onOpenChange={(open) => !open && setDetailFile(null)}>
        <DialogContent className="max-w-xl">
          {detailFile && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-7">{detailFile.name}</DialogTitle>
                <DialogDescription>
                  {detailFile.visibility === "private"
                    ? "Encrypted locally before entering the IPFS network."
                    : "Public IPFS content that can be shared through a browser link."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground">Size</div>
                  <div className="mt-1 font-medium">{formatBytes(detailFile.size)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground">Replication</div>
                  <div className="mt-1 font-medium">
                    {detailFile.replicaCount || 0}/{state.settings.replicationTarget}
                    {(detailFile.replicaCount || 0) >= state.settings.replicationTarget ? " · Safe" : " · Replicating"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium">Active storage receipts</div>
                <div className="overflow-hidden rounded-lg border">
                  {(detailFile.replicas || []).length ? (
                    (detailFile.replicas || []).map((receipt) => (
                      <div key={receipt.deviceId} className="flex items-center justify-between gap-4 border-b px-3 py-2.5 text-xs last:border-b-0">
                        <div className="min-w-0">
                          <div className="font-medium">Device {receipt.deviceId.slice(0, 8)}</div>
                          <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                            {receipt.peerId || "peer identity unavailable"}
                          </div>
                        </div>
                        <div className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(receipt.at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-5 text-center text-xs text-muted-foreground">
                      Waiting for signed replica receipts.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-medium">Content ID</div>
                <button
                  className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-left font-mono text-[10px] break-all hover:bg-muted"
                  onClick={() => copy(detailFile.cid, "CID copied")}
                >
                  {detailFile.cid}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" className="text-red-600" onClick={() => removeFile(detailFile)}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => downloadFile(detailFile)}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <Button onClick={() => openShare(detailFile)}>
                    <Link2 className="h-4 w-4" /> Share
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Storage, replication, background behavior, and node diagnostics.
            </DialogDescription>
          </DialogHeader>

          {draftSettings && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-medium">
                  <span>Replication target</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={draftSettings.replicationTarget}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, replicationTarget: Number(e.target.value) || 1 })
                    }
                  />
                  <span className="block text-[10px] font-normal leading-4 text-muted-foreground">
                    A file is marked Safe only after this many signed device receipts.
                  </span>
                </label>

                <label className="space-y-1.5 text-xs font-medium">
                  <span>Storage allocation</span>
                  <Input
                    value={draftSettings.storageMax}
                    onChange={(e) => setDraftSettings({ ...draftSettings, storageMax: e.target.value })}
                    placeholder="20GB"
                  />
                  <span className="block text-[10px] font-normal leading-4 text-muted-foreground">
                    Examples: 20GB, 100GB, 1TB.
                  </span>
                </label>
              </div>

              <label className="block space-y-1.5 text-xs font-medium">
                <span>Download folder</span>
                <Input
                  value={draftSettings.downloadDir}
                  onChange={(e) => setDraftSettings({ ...draftSettings, downloadDir: e.target.value })}
                />
              </label>

              <div className="overflow-hidden rounded-lg border">
                <label className="flex cursor-pointer items-center justify-between gap-4 border-b px-3 py-3">
                  <div>
                    <div className="text-xs font-medium">Keep node running when window closes</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Transfers, serving, and replication continue from the system tray.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-black"
                    checked={draftSettings.keepRunningOnClose}
                    onChange={(e) =>
                      setDraftSettings({ ...draftSettings, keepRunningOnClose: e.target.checked })
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 px-3 py-3">
                  <div>
                    <div className="text-xs font-medium">Start 13xfile when I sign in</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Uses the native OS login-start mechanism.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-black"
                    checked={draftSettings.startOnLogin}
                    onChange={(e) => setDraftSettings({ ...draftSettings, startOnLogin: e.target.checked })}
                  />
                </label>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 text-xs font-medium">Diagnostics</div>
                <div className="grid gap-1.5 font-mono text-[9px] text-muted-foreground">
                  <div>Peer: {state.vault?.peerId || state.peerId || "starting"}</div>
                  <div>Device: {state.vault?.deviceId || "initializing"}</div>
                  <div>Vault: {state.vault?.vaultId || "not ready"}</div>
                  <div>Connected peers: {state.connectedPeers}</div>
                  {state.vault?.lastError && (
                    <div className="mt-1 break-words text-amber-700">Last sync error: {state.vault.lastError}</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings}>Save settings</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openLinkOpen} onOpenChange={setOpenLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a 13xfile link</DialogTitle>
            <DialogDescription>Paste a public or private 13xfile app link.</DialogDescription>
          </DialogHeader>
          <Input
            value={incomingLink}
            onChange={(e) => setIncomingLink(e.target.value)}
            placeholder="x13file://share/..."
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button
              disabled={!incomingLink.startsWith("x13file://share/") && !incomingLink.startsWith("13xfile://share/")}
              onClick={downloadIncoming}
            >
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
