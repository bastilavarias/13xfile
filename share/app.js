import { publicGateways } from "./gateways.js"

const card = document.querySelector("#share-card")
const errorCard = document.querySelector("#error-card")
const downloadButton = document.querySelector("#download-button")
const downloadLabel = document.querySelector("#download-label")
const progressWrap = document.querySelector("#progress-wrap")
const progressBar = document.querySelector("#progress-bar")
const progressLabel = document.querySelector("#progress-label")
const progressPercent = document.querySelector("#progress-percent")

let descriptor = null

function showError(title, message) {
  card.hidden = true
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
    throw new Error("Private browser sharing is not enabled in this prototype yet.")
  }

  return {
    name: parsed.name,
    cid: parsed.cid,
    size: Number(parsed.size) || 0,
    mime: parsed.mime || "application/octet-stream",
    visibility: "public",
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

function render(desc) {
  document.title = `${desc.name} · 13xfile`
  document.querySelector("#file-name").textContent = desc.name
  document.querySelector("#file-size").textContent = formatBytes(desc.size)
  document.querySelector("#file-cid").textContent = desc.cid
  document.querySelector("#file-type").textContent = desc.mime
  errorCard.hidden = true
  card.hidden = false
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

async function fetchFromGateway(url, desc) {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    headers: { Accept: "application/octet-stream" },
  })
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

async function download() {
  if (!descriptor) return

  downloadButton.disabled = true
  downloadLabel.textContent = "Downloading…"
  progressWrap.hidden = false
  progressLabel.textContent = "Finding the file…"
  progressPercent.textContent = ""
  progressBar.style.width = "5%"

  let lastError = null

  for (const buildURL of publicGateways) {
    try {
      const url = buildURL(descriptor.cid)
      const blob = await fetchFromGateway(url, descriptor)
      const objectURL = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectURL
      anchor.download = descriptor.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(objectURL), 10_000)

      progressBar.style.width = "100%"
      progressPercent.textContent = "100%"
      progressLabel.textContent = "Download ready"
      downloadLabel.textContent = "Download again"
      downloadButton.disabled = false
      return
    } catch (error) {
      lastError = error
    }
  }

  downloadButton.disabled = false
  downloadLabel.textContent = "Retry download"
  progressBar.style.width = "0%"
  progressPercent.textContent = ""
  progressLabel.textContent = "Could not retrieve the file from the current browser transports."
  document.querySelector("#availability-text").textContent = "File lookup failed — try again in a moment"
  console.warn("13xfile public download failed", lastError)
}

try {
  descriptor = decodeDescriptor()
  render(descriptor)
} catch (error) {
  showError("Invalid share link", error instanceof Error ? error.message : "This link could not be opened.")
}

downloadButton.addEventListener("click", download)
