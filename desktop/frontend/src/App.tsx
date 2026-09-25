import { useEffect, useMemo, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Activity,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  File,
  Files,
  FolderOpen,
  Globe2,
  HardDrive,
  Link2,
  Lock,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"

import wordmark from "@/assets/wordmark.svg"
import emblem from "@/assets/emblem.svg"
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
const THEME_KEY = "13xfile-theme"

type Theme = "dark" | "light"
type ActiveSection = "vault" | "transfers" | "activity"

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
  addedAt: string
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
  createdAt: string
  updatedAt: string
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

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === "dark" || saved === "light") return saved
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
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

function visibilityLabel(value?: "public" | "private") {
  return value === "private" ? "Encrypted" : "Public"
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
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [activeSection, setActiveSection] = useState<ActiveSection>("vault")
  const [fileFilter, setFileFilter] = useState<"all" | "encrypted" | "public">("all")
  const [fileSort, setFileSort] = useState<"latest" | "oldest" | "name" | "size">("latest")
  const [fileHealth, setFileHealth] = useState<"all" | "safe" | "replicating">("all")
  const [vaultPage, setVaultPage] = useState(0)
  const [visibility, setVisibility] = useState<"private" | "public">("private")
  const [searchQuery, setSearchQuery] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [vaultBusy, setVaultBusy] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState("")
  const [staging, setStaging] = useState(false)
  const [trayOpen, setTrayOpen] = useState(true)
  const [trayPage, setTrayPage] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareLink, setShareLink] = useState("")
  const [webShareLink, setWebShareLink] = useState("")
  const [shareTarget, setShareTarget] = useState<VaultFile | null>(null)
  const [shareGateway, setShareGateway] = useState("https://ipfs.io/ipfs/")
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
      // Backend may still be booting.
    }
  }

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 900)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

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

  const flash = (message: string) => {
    setToast(message.replace(/^Error:\s*/, ""))
    window.setTimeout(() => setToast(""), 2800)
  }

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

  const openShare = async (file: VaultFile) => {
    try {
      const data = await request<{ link: string; webLink?: string }>(`/files/${file.id}/share`)
      setShareTarget(file)
      setShareLink(data.link)
      setWebShareLink(data.webLink || "")
      setShareGateway("https://ipfs.io/ipfs/")
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
    const confirmed = window.confirm(
      `Remove "${file.name}" from this vault? This publishes a removal to the vault but does not erase copies already shared outside it.`,
    )
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

  const removeTransfer = async (transfer: Transfer) => {
    try {
      await request(`/transfers/${transfer.id}/remove`, { method: "POST" })
      await refresh()
      flash("Transfer removed")
    } catch (error) {
      flash(String(error))
    }
  }

  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("share")
    if (incoming?.startsWith("x13file://share/") || incoming?.startsWith("13xfile://share/")) {
      setIncomingLink(incoming)
      setOpenLinkOpen(true)
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const activeTransfers =
    state?.transfers.filter((transfer) => transfer.status === "queued" || transfer.status === "running") || []
  const transferPageSize = 5
  const sortedTransfers = [...(state?.transfers || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const transferPageCount = Math.max(1, Math.ceil(sortedTransfers.length / transferPageSize))
  const visibleTransfers = sortedTransfers.slice(
    trayPage * transferPageSize,
    trayPage * transferPageSize + transferPageSize,
  )
  const aggregate = useMemo(() => {
    if (!activeTransfers.length) return 100
    return Math.round(activeTransfers.reduce((sum, item) => sum + item.progress, 0) / activeTransfers.length)
  }, [activeTransfers])

  useEffect(() => {
    setTrayPage((page) => Math.min(page, transferPageCount - 1))
  }, [transferPageCount])

  useEffect(() => {
    setVaultPage(0)
  }, [fileFilter, fileHealth, fileSort, searchQuery])

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Starting 13xfile…
      </div>
    )
  }

  if (state.needsVault) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6">
        <div className="brand-orb brand-orb-one" />
        <div className="brand-orb brand-orb-two" />
        <Button
          variant="outline"
          size="icon"
          className="absolute right-5 top-5"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <section className="relative w-full max-w-md rounded-2xl border bg-card-surface p-7 shadow-2xl">
          <img src={wordmark} alt="13xfile" className="mb-7 h-auto w-44" draggable={false} />
          <h1 className="text-xl font-semibold">Your decentralized vault</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create a vault or join one already running on another authorized device.
          </p>
          <Button className="mt-7 w-full" size="lg" disabled={vaultBusy} onClick={() => createOrJoinVault("")}>
            Create new vault
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or join existing <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-2">
            <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Vault join code" />
            <Button
              variant="outline"
              disabled={vaultBusy || joinCode.trim().length < 12}
              onClick={() => createOrJoinVault(joinCode)}
            >
              Join
            </Button>
          </div>
          <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
            Recovery code is required to authorize another vault device. Store it privately.
          </p>
        </section>
        {toast && <Toast text={toast} />}
      </main>
    )
  }

  const files = state.vault?.files || []
  const scopedFiles = files.filter((file) => {
    if (fileFilter === "public") return file.visibility !== "private"
    if (fileFilter === "encrypted") return file.visibility === "private"
    return true
  })
  const filteredFiles = scopedFiles
    .filter((file) => file.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .filter((file) => {
      if (fileHealth === "safe") return (file.replicaCount || 0) >= state.settings.replicationTarget
      if (fileHealth === "replicating") return (file.replicaCount || 0) < state.settings.replicationTarget
      return true
    })
    .sort((a, b) => {
      if (fileSort === "oldest") return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
      if (fileSort === "name") return a.name.localeCompare(b.name)
      if (fileSort === "size") return b.size - a.size
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    })
  const vaultPageSize = 15
  const vaultPageCount = Math.max(1, Math.ceil(filteredFiles.length / vaultPageSize))
  const vaultPageIndex = Math.min(vaultPage, vaultPageCount - 1)
  const pagedFiles = filteredFiles.slice(
    vaultPageIndex * vaultPageSize,
    vaultPageIndex * vaultPageSize + vaultPageSize,
  )
  const safeCount = files.filter(
    (file) => (file.replicaCount || 0) >= state.settings.replicationTarget,
  ).length

  const sidebarItems: Array<{
    key: ActiveSection
    label: string
    subtitle: string
    icon: typeof Files
    count?: number
  }> = [
    { key: "vault", label: "Vault", subtitle: "Your files", icon: Files },
    { key: "transfers", label: "Transfers", subtitle: "Uploads & downloads", icon: ArrowUpDown, count: activeTransfers.length },
    { key: "activity", label: "Activity", subtitle: "Recent events", icon: Activity },
  ]

  const selectedGatewayURL = shareTarget ? `${shareGateway}${shareTarget.cid}` : ""
  const isPublicShare = shareTarget?.visibility !== "private"

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="app-titlebar">
        <div className="titlebar-brand">
          <img src={wordmark} alt="13xfile" className="h-auto w-[172px]" draggable={false} />
        </div>

        <div className="titlebar-center">
          <Button className="brand-button titlebar-upload" onClick={() => inputRef.current?.click()} disabled={staging}>
            <UploadCloud className="h-5 w-5" /> {staging ? "Staging…" : "Upload files"}
          </Button>
        </div>

        <div className="titlebar-actions">
          <Button
            variant="outline"
            size="icon"
            className="titlebar-icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-full px-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  13
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
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

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => event.target.files && uploadFiles(event.target.files)}
      />

      <aside className="app-sidebar">
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const active = activeSection === item.key
            return (
              <button
                key={item.key}
                className={`sidebar-item ${active ? "sidebar-item-active" : ""}`}
                onClick={() => {
                  setActiveSection(item.key)
                  if (item.key === "vault") setFileFilter("all")
                }}
              >
                <Icon className="h-5 w-5" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{item.subtitle}</span>
                </span>
                {!!item.count && <span className="sidebar-count">{item.count}</span>}
              </button>
            )
          })}
          <button className="sidebar-item" onClick={openSettings}>
            <Settings2 className="h-5 w-5" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-medium">Settings</span>
              <span className="block truncate text-[10px] text-muted-foreground">Preferences & account</span>
            </span>
          </button>
        </nav>

        <div className="mt-auto space-y-3">
          <div className="storage-card">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <HardDrive className="h-4 w-4 text-primary" />
              Storage allocation
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              Target: {state.settings.storageMax}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[13%] rounded-full bg-primary" />
            </div>
          </div>

          <div className="ipfs-card">
            <img src={emblem} alt="" className="mx-auto h-16 w-16 object-contain" draggable={false} />
            <div className="mt-1 text-center text-xs font-semibold">Powered by IPFS</div>
            <div className="mt-1 text-center text-[10px] leading-4 text-muted-foreground">
              Decentralized. Encrypted.
              <br />
              Built for a more open web.
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        {state.fatal && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-300">
            {state.fatal}
          </div>
        )}

        {activeSection === "vault" && (
          <>
            <section data-file-drop-target className="upload-zone">
              <div className="upload-zone-main">
                <div className="upload-icon">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <h2 className="mt-3 text-base font-semibold">Drop files here to upload</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Encrypted files are protected locally. Public files can be shared through browser gateways.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <div className="visibility-switch">
                    <button
                      className={visibility === "private" ? "visibility-active" : ""}
                      onClick={() => setVisibility("private")}
                    >
                      <Lock className="h-3.5 w-3.5" /> Encrypted
                    </button>
                    <button
                      className={visibility === "public" ? "visibility-active" : ""}
                      onClick={() => setVisibility("public")}
                    >
                      <Globe2 className="h-3.5 w-3.5" /> Public
                    </button>
                  </div>
                  <Button className="brand-button" onClick={() => inputRef.current?.click()} disabled={staging}>
                    <File className="h-4 w-4" /> Choose files
                  </Button>
                </div>
              </div>

              <div className="upload-zone-features">
                <FeatureLine icon={Lock} title="Encrypted by default" copy="Your files, your control" />
                <FeatureLine icon={Globe2} title="Distributed with IPFS" copy="More resilient and open" />
                <FeatureLine icon={Link2} title="Share with anyone" copy="Generate a link in seconds" />
              </div>
            </section>

            <section className="mt-4">
              <div className="file-toolbar">
                <div className="file-filter-group">
                  <button
                    className={`filter-pill ${fileFilter === "all" ? "filter-pill-active" : ""}`}
                    onClick={() => setFileFilter("all")}
                  >
                    All files <span>{files.length}</span>
                  </button>
                  <button
                    className={`filter-pill ${fileFilter === "encrypted" ? "filter-pill-active" : ""}`}
                    onClick={() => setFileFilter("encrypted")}
                  >
                    <Lock className="h-3.5 w-3.5" /> Encrypted
                  </button>
                  <button
                    className={`filter-pill ${fileFilter === "public" ? "filter-pill-active" : ""}`}
                    onClick={() => setFileFilter("public")}
                  >
                    <Globe2 className="h-3.5 w-3.5" /> Public
                  </button>
                </div>

                <div className="file-filter-controls">
                  <label className="vault-search">
                    <Search className="h-3.5 w-3.5" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search files"
                      aria-label="Search vault files"
                    />
                  </label>
                  <select
                    className="vault-filter-select"
                    value={fileHealth}
                    onChange={(event) => setFileHealth(event.target.value as "all" | "safe" | "replicating")}
                    aria-label="Filter by replication"
                  >
                    <option value="all">All status</option>
                    <option value="safe">Safe</option>
                    <option value="replicating">Replicating</option>
                  </select>
                  <select
                    className="vault-filter-select"
                    value={fileSort}
                    onChange={(event) => setFileSort(event.target.value as "latest" | "oldest" | "name" | "size")}
                    aria-label="Sort vault files"
                  >
                    <option value="latest">Latest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name A–Z</option>
                    <option value="size">Largest</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={refresh}>
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </div>

              <div className="file-table">
                <div className="file-row file-head">
                  <div>Name</div>
                  <div>Size</div>
                  <div>Visibility</div>
                  <div>Replication</div>
                  <div />
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="py-14 text-center">
                    <File className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">{scopedFiles.length ? "No matching files" : "Nothing here yet"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scopedFiles.length ? "Try another search." : "Upload a file to start building your vault."}
                    </p>
                  </div>
                ) : (
                  pagedFiles.map((file) => {
                    const replicaCount = file.replicaCount || 0
                    const safe = replicaCount >= state.settings.replicationTarget
                    return (
                      <div className="file-row" key={file.id}>
                        <button className="file-name-cell" onClick={() => setDetailFile(file)}>
                          <span className="file-type-icon">
                            {file.visibility === "private" ? <Lock className="h-4 w-4" /> : <File className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{file.name}</span>
                            <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                              {shortCID(file.cid)}
                            </span>
                          </span>
                        </button>
                        <div className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</div>
                        <div>
                          <Badge className={file.visibility === "private" ? "encrypted-badge" : "public-badge"} variant="outline">
                            {file.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
                            {visibilityLabel(file.visibility)}
                          </Badge>
                        </div>
                        <button className="replication-cell" onClick={() => setDetailFile(file)}>
                          <span className="text-[11px] font-medium">
                            {replicaCount}/{state.settings.replicationTarget}
                          </span>
                          <span className="replication-track">
                            <span
                              style={{
                                width: `${Math.min(100, Math.round((replicaCount / state.settings.replicationTarget) * 100))}%`,
                              }}
                            />
                          </span>
                          <span className="text-[9px] text-muted-foreground">{safe ? "Safe" : "Replicating"}</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Ellipsis className="h-4 w-4" />
                            </Button>
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
                    )
                  })
                )}
              </div>

              {filteredFiles.length > vaultPageSize && (
                <div className="vault-pagination">
                  <span className="vault-pagination-summary">
                    Showing {vaultPageIndex * vaultPageSize + 1}–
                    {Math.min(filteredFiles.length, (vaultPageIndex + 1) * vaultPageSize)} of {filteredFiles.length}
                  </span>
                  <div className="vault-pagination-controls">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={vaultPageIndex === 0}
                      onClick={() => setVaultPage((page) => Math.max(0, page - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </Button>
                    <span>
                      Page {vaultPageIndex + 1} of {vaultPageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={vaultPageIndex >= vaultPageCount - 1}
                      onClick={() => setVaultPage((page) => Math.min(vaultPageCount - 1, page + 1))}
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="app-statusbar">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${state.nodeOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span>{state.nodeOnline ? "Connected to IPFS" : "Connecting to IPFS"}</span>
                </div>
                <span className="status-separator" />
                <span>{state.connectedPeers} peers</span>
                <span className="status-separator" />
                <span>{safeCount}/{files.length || 0} replicated safely</span>
              </div>
            </section>
          </>
        )}

        {activeSection === "transfers" && (
          <section className="section-panel">
            <div className="section-heading">
              <div>
                <h2>Transfers</h2>
                <p>{activeTransfers.length} active · continues while 13xfile is running</p>
              </div>
              {activeTransfers.length > 0 && (
                <Button variant="outline" size="sm" onClick={togglePause}>
                  {state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {state.paused ? "Resume" : "Pause"}
                </Button>
              )}
            </div>
            <TransferRows transfers={state.transfers} refresh={refresh} onRemove={removeTransfer} />
          </section>
        )}

        {activeSection === "activity" && (
          <section className="section-panel">
            <div className="section-heading">
              <div>
                <h2>Activity</h2>
                <p>Recent transfer and replication events from this device.</p>
              </div>
            </div>
            <div className="activity-list">
              {state.transfers.length ? (
                state.transfers.map((item) => (
                  <div className="activity-row" key={item.id}>
                    <span className={`activity-dot activity-${item.status}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.name}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {visibilityLabel(item.visibility)} · {item.stage}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {item.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-xs text-muted-foreground">No recent activity.</div>
              )}
            </div>
          </section>
        )}
      </main>

      {state.transfers.length > 0 && activeSection !== "transfers" && (
        <aside className="transfer-tray">
          <button className="transfer-tray-head" onClick={() => setTrayOpen(!trayOpen)}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ArrowUpDown className="h-4 w-4 text-primary" />
                Transfers
                {!!activeTransfers.length && <span className="sidebar-count">{activeTransfers.length}</span>}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {activeTransfers.length ? `${aggregate}% overall · continues in background` : "Transfers complete"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeTransfers.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation()
                    togglePause()
                  }}
                >
                  {state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${trayOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          {activeTransfers.length > 0 && <Progress value={aggregate} className="rounded-none" />}
          {trayOpen && (
            <>
              <TransferRows transfers={visibleTransfers} compact refresh={refresh} onRemove={removeTransfer} />
              {state.transfers.length > transferPageSize && (
                <div className="transfer-pagination">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={trayPage === 0}
                    onClick={() => setTrayPage((page) => Math.max(0, page - 1))}
                    aria-label="Previous transfer page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>
                    {trayPage + 1} / {transferPageCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={trayPage >= transferPageCount - 1}
                    onClick={() => setTrayPage((page) => Math.min(transferPageCount - 1, page + 1))}
                    aria-label="Next transfer page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
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
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
            Anyone with this code can join the current MVP vault. Store it privately before continuing.
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setRecoveryOpen(false)}>I saved it</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="share-dialog max-w-5xl">
          {shareTarget && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Share {shareTarget.name}</DialogTitle>
                <DialogDescription>
                  {isPublicShare
                    ? "Share this public file by web link, 13xfile app link, or QR code."
                    : "Share this encrypted file with another 13xfile desktop client."}
                </DialogDescription>
              </DialogHeader>
              <div className="share-brand-head">
                <img src={wordmark} alt="13xfile" className="h-auto w-56" draggable={false} />
                <Badge className={isPublicShare ? "public-badge" : "encrypted-badge"} variant="outline">
                  {isPublicShare ? <Globe2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {isPublicShare ? "Public" : "Encrypted"}
                </Badge>
              </div>

              <div className="share-file-summary">
                <span className="file-type-icon h-10 w-10">
                  {isPublicShare ? <File className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{shareTarget.name}</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isPublicShare
                      ? "Anyone with the web link can download this file in a browser. No 13xfile app is required."
                      : "Encrypted files remain app-to-app only. Encrypted browser sharing is not enabled."}
                  </p>
                </div>
              </div>

              <div className={`share-grid ${isPublicShare ? "" : "share-grid-single"}`}>
                <div className="share-links">
                  {isPublicShare && webShareLink && (
                    <ShareLinkBlock
                      icon={Globe2}
                      title="Web link"
                      copy="Share this public file. Anyone can open it in a browser."
                      value={webShareLink}
                      onCopy={() => copy(webShareLink, "Web link copied")}
                      onOpen={() => window.open(webShareLink, "_blank", "noopener,noreferrer")}
                    />
                  )}

                  <ShareLinkBlock
                    icon={Link2}
                    title="13xfile app link"
                    copy="Open directly in 13xfile on another device."
                    value={shareLink}
                    onCopy={() => copy(shareLink, "13xfile link copied")}
                  />
                </div>

                {isPublicShare && webShareLink && (
                  <div className="qr-panel">
                    <div className="qr-icon-ring">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold">Scan to open</div>
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                      Open this file on your phone or another device.
                    </div>
                    <div className="qr-frame">
                      <QRCodeSVG
                        value={webShareLink}
                        size={196}
                        level="M"
                        marginSize={0}
                        bgColor="#ffffff"
                        fgColor="#07111f"
                      />
                    </div>
                    <div className="mt-2 text-[10px] font-medium">Scan with your camera</div>
                  </div>
                )}
              </div>

              <details className="advanced-share">
                <summary>
                  <span>
                    <span className="block text-xs font-semibold">More link options</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      Alternate gateways and CID for advanced users.
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="advanced-share-body">
                  <div className="min-w-0">
                    <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">IPFS CID</div>
                    <div className="readonly-link-row">
                      <input readOnly value={shareTarget.cid} />
                      <Button variant="outline" size="icon" onClick={() => copy(shareTarget.cid, "CID copied")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {isPublicShare && (
                    <div className="min-w-0">
                      <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">IPFS gateway</div>
                      <div className="gateway-select-row">
                        <select value={shareGateway} onChange={(event) => setShareGateway(event.target.value)}>
                          <option value="https://ipfs.io/ipfs/">IPFS.io</option>
                          <option value="https://dweb.link/ipfs/">Dweb</option>
                          <option value="https://gateway.pinata.cloud/ipfs/">Pinata</option>
                        </select>
                        <Button variant="outline" size="icon" onClick={() => copy(selectedGatewayURL, "Gateway link copied")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(selectedGatewayURL, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </>
          )}
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
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-muted-foreground">Size</div>
                  <div className="mt-1 font-medium">{formatBytes(detailFile.size)}</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
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
                      <div
                        key={receipt.deviceId}
                        className="flex items-center justify-between gap-4 border-b px-3 py-2.5 text-xs last:border-b-0"
                      >
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
                  className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-left font-mono text-[10px] break-all hover:bg-muted"
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
            <DialogDescription>Storage, replication, theme, background behavior, and diagnostics.</DialogDescription>
          </DialogHeader>

          {draftSettings && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="mb-2 text-xs font-medium">Appearance</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="h-4 w-4" /> Dark
                  </Button>
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="h-4 w-4" /> Light
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-medium">
                  <span>Replication target</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={draftSettings.replicationTarget}
                    onChange={(event) =>
                      setDraftSettings({ ...draftSettings, replicationTarget: Number(event.target.value) || 1 })
                    }
                  />
                  <span className="block text-[10px] font-normal leading-4 text-muted-foreground">
                    File is Safe only after this many signed device receipts.
                  </span>
                </label>

                <label className="space-y-1.5 text-xs font-medium">
                  <span>Storage allocation</span>
                  <Input
                    value={draftSettings.storageMax}
                    onChange={(event) => setDraftSettings({ ...draftSettings, storageMax: event.target.value })}
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
                  onChange={(event) => setDraftSettings({ ...draftSettings, downloadDir: event.target.value })}
                />
              </label>

              <div className="overflow-hidden rounded-lg border">
                <label className="flex cursor-pointer items-center justify-between gap-4 border-b px-3 py-3">
                  <div>
                    <div className="text-xs font-medium">Keep node running when window closes</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Transfers, serving, and replication continue from system tray.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    style={{ accentColor: "hsl(var(--primary))" }}
                    checked={draftSettings.keepRunningOnClose}
                    onChange={(event) =>
                      setDraftSettings({ ...draftSettings, keepRunningOnClose: event.target.checked })
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 px-3 py-3">
                  <div>
                    <div className="text-xs font-medium">Start 13xfile when I sign in</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">Uses native OS login-start mechanism.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    style={{ accentColor: "hsl(var(--primary))" }}
                    checked={draftSettings.startOnLogin}
                    onChange={(event) => setDraftSettings({ ...draftSettings, startOnLogin: event.target.checked })}
                  />
                </label>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 text-xs font-medium">Diagnostics</div>
                <div className="grid gap-1.5 font-mono text-[9px] text-muted-foreground">
                  <div>Peer: {state.vault?.peerId || state.peerId || "starting"}</div>
                  <div>Device: {state.vault?.deviceId || "initializing"}</div>
                  <div>Vault: {state.vault?.vaultId || "not ready"}</div>
                  <div>Connected peers: {state.connectedPeers}</div>
                  {state.vault?.lastError && (
                    <div className="mt-1 break-words text-amber-700 dark:text-amber-300">
                      Last sync error: {state.vault.lastError}
                    </div>
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
            <DialogDescription>Paste a public or encrypted 13xfile app link.</DialogDescription>
          </DialogHeader>
          <Input
            value={incomingLink}
            onChange={(event) => setIncomingLink(event.target.value)}
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

function FeatureLine({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Lock
  title: string
  copy: string
}) {
  return (
    <div className="feature-line">
      <div className="feature-line-icon">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[11px] font-semibold">{title}</div>
        <div className="mt-0.5 text-[9px] text-muted-foreground">{copy}</div>
      </div>
    </div>
  )
}

function ShareLinkBlock({
  icon: Icon,
  title,
  copy,
  value,
  onCopy,
  onOpen,
}: {
  icon: typeof Link2
  title: string
  copy: string
  value: string
  onCopy: () => void
  onOpen?: () => void
}) {
  return (
    <section className="share-link-block">
      <div className="share-link-label">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-xs font-semibold">{title}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{copy}</div>
        </div>
      </div>
      <div className="readonly-link-row mt-3">
        <input readOnly value={value} />
        <Button onClick={onCopy}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
        {onOpen && (
          <Button variant="outline" onClick={onOpen}>
            <ExternalLink className="h-4 w-4" /> Open
          </Button>
        )}
      </div>
    </section>
  )
}

function TransferRows({
  transfers,
  compact = false,
  refresh,
  onRemove,
}: {
  transfers: Transfer[]
  compact?: boolean
  refresh: () => Promise<void>
  onRemove: (transfer: Transfer) => Promise<void>
}) {
  if (!transfers.length) {
    return <div className="py-12 text-center text-xs text-muted-foreground">No transfers yet.</div>
  }

  return (
    <div className={compact ? "transfer-list compact" : "transfer-list"}>
      {transfers.map((item) => {
        const active = item.status === "queued" || item.status === "running"
        const retryable = item.status === "failed" || item.status === "cancelled"

        return (
          <div className="transfer-row" key={item.id}>
            <div className="file-type-icon">
              {item.visibility === "private" ? <Lock className="h-4 w-4" /> : <File className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{item.name}</div>
                  <div className="mt-1 text-[9px] text-muted-foreground">
                    {item.stage} · {visibilityLabel(item.visibility)} · {formatBytes(item.size)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {item.status === "complete" && <Check className="h-4 w-4 text-emerald-500" />}
                  {compact ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="transfer-remove-button"
                      aria-label={active ? `Cancel ${item.name}` : `Remove ${item.name} from transfer history`}
                      title={active ? "Cancel transfer" : "Remove from transfer history"}
                      onClick={() =>
                        active
                          ? request(`/transfers/${item.id}/cancel`, { method: "POST" }).then(refresh)
                          : onRemove(item)
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}>
                          <Ellipsis className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {active && (
                          <DropdownMenuItem
                            onSelect={() =>
                              request(`/transfers/${item.id}/cancel`, { method: "POST" }).then(refresh)
                            }
                          >
                            <X className="mr-2 h-4 w-4" /> Cancel transfer
                          </DropdownMenuItem>
                        )}
                        {retryable && (
                          <DropdownMenuItem
                            onSelect={() =>
                              request(`/transfers/${item.id}/retry`, { method: "POST" }).then(refresh)
                            }
                          >
                            <RefreshCw className="mr-2 h-4 w-4" /> Retry
                          </DropdownMenuItem>
                        )}
                        {!active && (
                          <>
                            {retryable && <DropdownMenuSeparator />}
                            <DropdownMenuItem className="text-red-600" onSelect={() => onRemove(item)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Remove from list
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {active && (
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={item.progress} className="h-1.5 flex-1" />
                  <span className="w-8 text-right text-[9px] font-medium text-primary">{item.progress}%</span>
                </div>
              )}
              {item.error && <div className="mt-1 text-[9px] text-red-500">{item.error}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-primary/20 bg-background/95 px-4 py-2 text-xs text-foreground shadow-2xl backdrop-blur">
      {text}
    </div>
  )
}

export default App
