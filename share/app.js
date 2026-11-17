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
const SHOW_SHARE_QR = false
const openFileForm = document.querySelector("#open-file-form")
const openFileInput = document.querySelector("#open-file-input")

let descriptor = null
let gatewayStates = []
let selectedOrigin = ""
let manualOriginSelection = false
let probeGeneration = 0

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

function validCID(cid) {
  return typeof cid === "string" && /^[A-Za-z0-9]{46,120}$/.test(cid)
}

function encodeDescriptor(desc) {
  const bytes = new TextEncoder().encode(JSON.stringify(desc))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function decodeDescriptor() {
  const payload = location.hash.replace(/^#/, "").trim()

  if (!payload) {
    const params = new URLSearchParams(location.search)
    const cid = (params.get("cid") || "").trim()
    if (!validCID(cid)) {
      throw new Error("Paste a public 13xfile share link or an IPFS CID below to open a download.")
    }
    const name = (params.get("name") || "").trim().slice(0, 240) || "Shared IPFS file"
    const requestedSize = Number(params.get("size"))
    const size = Number.isSafeInteger(requestedSize) && requestedSize > 0 ? requestedSize : 0
    const mime = "application/octet-stream"
    const encoded = encodeDescriptor({ v: 1, name, cid, size, mime, visibility: "public" })
    return { name, cid, size, mime, visibility: "public", payload: encoded }
  }

  if (payload.length > 8192) throw new Error("This share descriptor is too large.")
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const parsed = JSON.parse(new TextDecoder().decode(bytes))

  if (parsed.v !== 1 || typeof parsed.name !== "string" || !validCID(parsed.cid)) {
    throw new Error("This share link uses an unsupported descriptor.")
  }
  if ((parsed.visibility || "public") !== "public") {
    throw new Error("Encrypted browser sharing is not enabled. Open this link in the 13xfile desktop app.")
  }

  return {
    name: parsed.name.slice(0, 240) || "Shared IPFS file",
    cid: parsed.cid,
    size: Number.isSafeInteger(parsed.size) && parsed.size > 0 ? parsed.size : 0,
    mime: typeof parsed.mime === "string" ? parsed.mime : "application/octet-stream",
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
  if (!SHOW_SHARE_QR || !shareQR) return
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
      status.textContent = "Not verified"
    }
    health.appendChild(status)

    select.appendChild(radio)
    select.appendChild(identity)
    select.appendChild(health)

    const copyButton = document.createElement("button")
    copyButton.type = "button"
    copyButton.className = "origin-copy"
    copyButton.textContent = "Copy link"
    copyButton.addEventListener("click", () => {
      if (!descriptor) return
      copyText(gatewayDownloadURL(item.origin, descriptor), copyButton)
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
    originSummary.textContent = "No gateway was verified. Some gateways block browser checks but still support downloads."
    availabilityText.textContent = "Gateway checks inconclusive. Try a direct download or select another route."
    return
  }

  originSummary.textContent =
    ready.length === 1
      ? "1 public gateway can serve this file."
      : `${ready.length} public gateways can serve this file. Fastest route is highlighted.`
  availabilityText.textContent = "Available from the IPFS network"
}

function updateDownloadReadiness() {
  const selected = gatewayStates.find((item) => item.origin === selectedOrigin)
  const route = selected || gatewayStates.find((item) => item.status === "ready") || gatewayStates[0]
  downloadButton.disabled = !route
  downloadLabel.textContent = route
    ? `Download via ${gatewayLabel(route.origin)}`
    : "Finding download route…"
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
  if (!descriptor) return

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
  updateDownloadReadiness()

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
        selectedOrigin = ready[0]?.origin || gatewayStates[0]?.origin || ""
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

  if (!manualOriginSelection || !gatewayStates.some((item) => item.origin === selectedOrigin)) {
    selectedOrigin = ready[0]?.origin || gatewayStates[0]?.origin || ""
  }

  renderOrigins()
  updateOriginSummary()
  updateDownloadReadiness()
  refreshOriginsButton.disabled = false
}

function gatewayDownloadURL(origin, desc) {
  const url = new URL(gatewayURL(origin, desc.cid))
  url.searchParams.set("download", "true")
  url.searchParams.set("filename", desc.name)
  return url.toString()
}

function download() {
  if (!descriptor) return
  const selected = gatewayStates.find((item) => item.origin === selectedOrigin)
  const route = selected || gatewayStates.find((item) => item.status === "ready") || gatewayStates[0]

  if (!route) {
    refreshOrigins()
    return
  }

  // Browser streams from the IPFS gateway. No CDN proxy and no memory buffering.
  const link = document.createElement("a")
  link.href = gatewayDownloadURL(route.origin, descriptor)
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  document.body.appendChild(link)
  link.click()
  link.remove()

  availabilityText.textContent =
    `Download opened via ${gatewayHostname(route.origin)}. Your browser handles progress and saving. ` +
    "If the gateway cannot serve this CID, select another route and retry."
}

openFileForm.addEventListener("submit", (event) => {
  event.preventDefault()
  const input = openFileInput.value.trim()
  if (validCID(input)) {
    location.assign(`${location.pathname}?cid=${encodeURIComponent(input)}`)
    return
  }

  let payload = ""
  if (input.startsWith("x13file://share/") || input.startsWith("13xfile://share/")) {
    payload = input.split("/share/")[1] || ""
  } else {
    try {
      const url = new URL(input)
      if (
        url.origin !== location.origin &&
        url.hostname !== "share.13xfile.app" &&
        url.hostname !== "htmlpreview.github.io"
      ) throw new Error("Unsupported share link host")
      payload = url.hash.replace(/^#/, "")
      if (!payload && validCID(url.searchParams.get("cid") || "")) {
        location.assign(`${location.pathname}?cid=${encodeURIComponent(url.searchParams.get("cid"))}`)
        return
      }
    } catch {
      showError("Invalid link", "Enter a public 13xfile share link or a valid IPFS CID.")
      return
    }
  }

  if (!payload || !/^[A-Za-z0-9_-]{1,8192}$/.test(payload)) {
    showError("Invalid link", "This share link does not contain a valid descriptor.")
    return
  }
  location.assign(`${location.pathname}#${payload}`)
})

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  document.querySelector(".browse-feed-link").href = "http://127.0.0.1:8081/"
}

try {
  descriptor = decodeDescriptor()
  render(descriptor)
  refreshOrigins()
} catch (error) {
  const noFileSelected = !location.hash && !new URLSearchParams(location.search).has("cid")
  showError(
    noFileSelected ? "Open a public file" : "Invalid share link",
    error instanceof Error ? error.message : "This link could not be opened.",
  )
}

downloadButton.addEventListener("click", download)
refreshOriginsButton.addEventListener("click", refreshOrigins)
