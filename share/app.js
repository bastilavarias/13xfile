const {
  gatewayHostname,
  gatewayLabel,
  gatewayURL,
  loadGatewayOrigins,
} = window.ThirteenXGateways || {}

if (!gatewayHostname || !gatewayLabel || !gatewayURL || !loadGatewayOrigins) {
  throw new Error("13xfile gateway adapter failed to load")
}

const card = document.querySelector("#share-card")
const gatewayCard = document.querySelector("#gateway-card")
const featureStrip = document.querySelector("#feature-strip")
const errorCard = document.querySelector("#error-card")
const downloadButton = document.querySelector("#download-button")
const downloadLabel = document.querySelector("#download-label")
const downloadSize = document.querySelector("#download-size")
const progressWrap = document.querySelector("#progress-wrap")
const progressBar = document.querySelector("#progress-bar")
const progressLabel = document.querySelector("#progress-label")
const progressPercent = document.querySelector("#progress-percent")
const originList = document.querySelector("#origin-list")
const originSummary = document.querySelector("#origin-summary")
const refreshOriginsButton = document.querySelector("#refresh-origins")
const availabilityText = document.querySelector("#availability-text")
const appLinkInput = document.querySelector("#app-link")
const cidInput = document.querySelector("#file-cid")
const copyAppLinkButton = document.querySelector("#copy-app-link")
const copyCIDButton = document.querySelector("#copy-cid")
const themeToggle = document.querySelector("#theme-toggle")
const themeIcon = document.querySelector("#theme-icon")
const themeLabel = document.querySelector("#theme-label")
const shareQR = document.querySelector("#share-qr")

let descriptor = null
let gatewayStates = []
let selectedOrigin = ""
let manualOriginSelection = false
let probeGeneration = 0
let isDownloading = false

function setTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem("13xfile-share-theme", theme)
  themeIcon.textContent = theme === "dark" ? "☾" : "☀"
  themeLabel.textContent = theme === "dark" ? "Dark" : "Light"
}

const savedTheme = localStorage.getItem("13xfile-share-theme")
setTheme(
  savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark",
)

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
})

function showError(title, message) {
  card.hidden = true
  gatewayCard.hidden = true
  featureStrip.hidden = true
  errorCard.hidden = false
  document.querySelector("#error-title").textContent = title
  document.querySelector("#error-message").textContent = message
}

function decodeDescriptor() {
  const payload = location.hash.replace(/^#/, "").trim()
  if (!payload) throw new Error("This share link does not contain a file descriptor.")

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const parsed = JSON.parse(new TextDecoder().decode(bytes))

  if (parsed.v !== 1 || typeof parsed.cid !== "string" || typeof parsed.name !== "string") {
    throw new Error("This share link uses an unsupported descriptor.")
  }
  if (!/^[A-Za-z0-9]+$/.test(parsed.cid)) {
    throw new Error("The file CID in this link is invalid.")
  }
  if ((parsed.visibility || "public") !== "public") {
    throw new Error("Encrypted browser sharing is not enabled. Open this link in the 13xfile desktop app.")
  }

  return {
    name: parsed.name,
    cid: parsed.cid,
    size: Number(parsed.size) || 0,
    mime: parsed.mime || "application/octet-stream",
    visibility: "public",
    payload,
  }
}

function formatBytes(bytes) {
  if (!bytes) return "Unknown size"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function friendlyType(mime, name) {
  const extension = name.includes(".") ? name.split(".").pop().toUpperCase() : ""
  if (extension && extension.length <= 8) return extension
  if (mime.startsWith("image/")) return "IMG"
  if (mime.startsWith("video/")) return "VIDEO"
  if (mime.startsWith("audio/")) return "AUDIO"
  if (mime === "application/pdf") return "PDF"
  return "FILE"
}

function renderQR() {
  if (!shareQR) return
  if (!window.QRCode?.toCanvas) {
    shareQR.closest(".qr-panel").style.display = "none"
    return
  }
  window.QRCode.toCanvas(
    shareQR,
    location.href,
    {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#07111f", light: "#ffffff" },
    },
    () => {},
  )
}

function render(desc) {
  document.title = `${desc.name} · 13xfile`
  document.querySelector("#file-name").textContent = desc.name
  document.querySelector("#file-size").textContent = formatBytes(desc.size)
  downloadSize.textContent = formatBytes(desc.size)
  cidInput.value = desc.cid
  document.querySelector("#file-type").textContent = desc.mime
  document.querySelector("#file-type-short").textContent = friendlyType(desc.mime, desc.name)
  appLinkInput.value = `x13file://share/${desc.payload}`
  errorCard.hidden = true
  card.hidden = false
  gatewayCard.hidden = false
  featureStrip.hidden = false
  renderQR()
}

function updateProgress(received, total) {
  progressWrap.hidden = false
  if (total > 0) {
    const percent = Math.max(0, Math.min(100, Math.round((received / total) * 100)))
    progressBar.style.width = `${percent}%`
    progressPercent.textContent = `${percent}%`
    progressLabel.textContent = `${formatBytes(received)} of ${formatBytes(total)}`
  } else {
    progressBar.style.width = "30%"
    progressPercent.textContent = ""
    progressLabel.textContent = `${formatBytes(received)} downloaded`
  }
}

async function copyText(value, button) {
  await navigator.clipboard.writeText(value)
  const old = button.textContent
  button.textContent = "Copied"
  window.setTimeout(() => {
    button.textContent = old
  }, 1200)
}

copyAppLinkButton.addEventListener("click", () => copyText(appLinkInput.value, copyAppLinkButton))
copyCIDButton.addEventListener("click", () => copyText(cidInput.value, copyCIDButton))

function renderOrigins() {
  originList.replaceChildren()

  if (gatewayStates.length === 0) {
    const empty = document.createElement("div")
    empty.className = "origin-empty"
    empty.textContent = "Loading public IPFS gateways…"
    originList.appendChild(empty)
    return
  }

  const sorted = [...gatewayStates].sort((a, b) => {
    const rank = { ready: 0, checking: 1, unavailable: 2 }
    const stateDiff = rank[a.status] - rank[b.status]
    if (stateDiff !== 0) return stateDiff
    if (a.status === "ready") return a.latency - b.latency
    return a.index - b.index
  })

  const fastest = sorted.find((item) => item.status === "ready")?.origin || ""

  for (const item of sorted) {
    const row = document.createElement("div")
    row.className = "origin-row"
    row.dataset.status = item.status
    row.dataset.selected = String(item.origin === selectedOrigin)

    const select = document.createElement("button")
    select.type = "button"
    select.className = "origin-select"
    select.disabled = item.status !== "ready" || isDownloading
    select.addEventListener("click", () => {
      selectedOrigin = item.origin
      manualOriginSelection = true
      renderOrigins()
      updateDownloadReadiness()
    })

    const radio = document.createElement("span")
    radio.className = "origin-radio"
    radio.setAttribute("aria-hidden", "true")

    const identity = document.createElement("span")
    identity.className = "origin-identity"

    const nameLine = document.createElement("span")
    nameLine.className = "origin-name-line"

    const name = document.createElement("span")
    name.className = "origin-name"
    name.textContent = gatewayLabel(item.origin)
    nameLine.appendChild(name)

    if (item.origin === fastest && item.status === "ready") {
      const recommended = document.createElement("span")
      recommended.className = "recommended"
      recommended.textContent = "Recommended"
      nameLine.appendChild(recommended)
    }

    const hostname = document.createElement("span")
    hostname.className = "origin-host"
    hostname.textContent = descriptor ? gatewayURL(item.origin, descriptor.cid) : item.origin

    identity.appendChild(nameLine)
    identity.appendChild(hostname)

    const health = document.createElement("span")
    health.className = "origin-health"

    const dot = document.createElement("span")
    dot.className = "origin-health-dot"
    health.appendChild(dot)

    const status = document.createElement("span")
    if (item.status === "checking") {
      status.textContent = "Checking"
    } else if (item.status === "ready") {
      status.textContent = `${item.latency} ms`
    } else {
      status.textContent = "Unavailable"
    }
    health.appendChild(status)

    select.appendChild(radio)
    select.appendChild(identity)
    select.appendChild(health)

    const copyButton = document.createElement("button")
    copyButton.type = "button"
    copyButton.className = "origin-copy"
    copyButton.textContent = "Copy link"
    copyButton.disabled = item.status !== "ready"
    copyButton.addEventListener("click", () => {
      if (!descriptor) return
      copyText(gatewayURL(item.origin, descriptor.cid), copyButton)
    })

    row.appendChild(select)
    row.appendChild(copyButton)
    originList.appendChild(row)
  }
}

function updateOriginSummary() {
  const ready = gatewayStates.filter((item) => item.status === "ready")
  const checking = gatewayStates.filter((item) => item.status === "checking")

  if (checking.length > 0) {
    originSummary.textContent = `Checking ${gatewayStates.length} public gateways against this CID…`
    return
  }

  if (ready.length === 0) {
    originSummary.textContent = "No browser-compatible gateway returned this CID. Retry in a moment."
    availabilityText.textContent = "No public gateway currently found the file"
    return
  }

  originSummary.textContent =
    ready.length === 1
      ? "1 public gateway can serve this file."
      : `${ready.length} public gateways can serve this file. Fastest route is highlighted.`
  availabilityText.textContent = "Available from the IPFS network"
}

function updateDownloadReadiness() {
  const selected = gatewayStates.find(
    (item) => item.origin === selectedOrigin && item.status === "ready",
  )

  if (isDownloading) {
    downloadButton.disabled = true
    return
  }

  if (selected) {
    downloadButton.disabled = false
    downloadLabel.textContent = `Download via ${gatewayLabel(selected.origin)}`
  } else {
    downloadButton.disabled = true
    downloadLabel.textContent = "Finding download route…"
  }
}

async function probeGateway(origin, cid, signal) {
  const started = performance.now()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 6500)
  const relayAbort = () => controller.abort()
  signal?.addEventListener("abort", relayAbort, { once: true })

  try {
    const response = await fetch(gatewayURL(origin, cid), {
      method: "GET",
      mode: "cors",
      redirect: "follow",
      headers: {
        Accept: "application/octet-stream",
        Range: "bytes=0-0",
      },
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body?.getReader()
    if (reader) {
      await reader.read()
      await reader.cancel()
    }

    return Math.max(1, Math.round(performance.now() - started))
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", relayAbort)
  }
}

async function refreshOrigins() {
  if (!descriptor || isDownloading) return

  const generation = ++probeGeneration
  refreshOriginsButton.disabled = true
  selectedOrigin = ""
  manualOriginSelection = false
  updateDownloadReadiness()

  const origins = await loadGatewayOrigins()
  if (generation !== probeGeneration) return

  gatewayStates = origins.map((origin, index) => ({
    origin,
    index,
    status: "checking",
    latency: 0,
  }))

  renderOrigins()
  updateOriginSummary()

  const groupController = new AbortController()

  await Promise.all(
    gatewayStates.map(async (item) => {
      try {
        const latency = await probeGateway(item.origin, descriptor.cid, groupController.signal)
        if (generation !== probeGeneration) return
        item.status = "ready"
        item.latency = latency
      } catch {
        if (generation !== probeGeneration) return
        item.status = "unavailable"
        item.latency = 0
      }

      if (!manualOriginSelection) {
        const ready = gatewayStates
          .filter((candidate) => candidate.status === "ready")
          .sort((a, b) => a.latency - b.latency)
        selectedOrigin = ready[0]?.origin || ""
      }

      renderOrigins()
      updateOriginSummary()
      updateDownloadReadiness()
    }),
  )

  if (generation !== probeGeneration) return

  const ready = gatewayStates
    .filter((item) => item.status === "ready")
    .sort((a, b) => a.latency - b.latency)

  if (!manualOriginSelection || !ready.some((item) => item.origin === selectedOrigin)) {
    selectedOrigin = ready[0]?.origin || ""
  }

  renderOrigins()
  updateOriginSummary()
  updateDownloadReadiness()
  refreshOriginsButton.disabled = false
}

async function fetchFromGateway(origin, desc) {
  const controller = new AbortController()
  const connectTimeout = window.setTimeout(() => controller.abort(), 15000)

  let response
  try {
    response = await fetch(gatewayURL(origin, desc.cid), {
      method: "GET",
      mode: "cors",
      redirect: "follow",
      headers: { Accept: "application/octet-stream" },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(connectTimeout)
  }

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`)
  }

  const headerLength = Number(response.headers.get("content-length")) || 0
  const total = desc.size || headerLength
  const reader = response.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    updateProgress(received, total)
  }

  return new Blob(chunks, { type: desc.mime })
}

function saveBlob(blob, name) {
  const objectURL = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectURL
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectURL), 10000)
}

async function download() {
  if (!descriptor || isDownloading) return

  const ready = gatewayStates
    .filter((item) => item.status === "ready")
    .sort((a, b) => a.latency - b.latency)

  if (ready.length === 0) {
    await refreshOrigins()
    return
  }

  const selected = ready.find((item) => item.origin === selectedOrigin)
  const candidates = [
    ...(selected ? [selected] : []),
    ...ready.filter((item) => item.origin !== selectedOrigin),
  ]

  isDownloading = true
  refreshOriginsButton.disabled = true
  renderOrigins()
  updateDownloadReadiness()
  progressWrap.hidden = false
  progressPercent.textContent = ""
  progressBar.style.width = "4%"

  let lastError = null

  for (const candidate of candidates) {
    selectedOrigin = candidate.origin
    renderOrigins()
    downloadLabel.textContent = `Downloading via ${gatewayLabel(candidate.origin)}…`
    progressLabel.textContent = `Connecting to ${gatewayHostname(candidate.origin)}…`
    progressPercent.textContent = ""
    progressBar.style.width = "4%"

    try {
      const blob = await fetchFromGateway(candidate.origin, descriptor)
      saveBlob(blob, descriptor.name)

      progressBar.style.width = "100%"
      progressPercent.textContent = "100%"
      progressLabel.textContent = `Downloaded via ${gatewayLabel(candidate.origin)}`
      availabilityText.textContent = `Served by ${gatewayHostname(candidate.origin)}`
      isDownloading = false
      refreshOriginsButton.disabled = false
      renderOrigins()
      updateDownloadReadiness()
      return
    } catch (error) {
      lastError = error
      candidate.status = "unavailable"
      candidate.latency = 0
      renderOrigins()
      updateOriginSummary()
    }
  }

  selectedOrigin = ""
  isDownloading = false
  refreshOriginsButton.disabled = false
  progressBar.style.width = "0%"
  progressPercent.textContent = ""
  progressLabel.textContent = "All currently available gateways failed during download."
  availabilityText.textContent = "Public gateways are temporarily unavailable"
  renderOrigins()
  updateDownloadReadiness()
  console.warn("13xfile public download failed", lastError)
}

try {
  descriptor = decodeDescriptor()
  render(descriptor)
  refreshOrigins()
} catch (error) {
  showError(
    "Invalid share link",
    error instanceof Error ? error.message : "This link could not be opened.",
  )
}

downloadButton.addEventListener("click", download)
refreshOriginsButton.addEventListener("click", refreshOrigins)
