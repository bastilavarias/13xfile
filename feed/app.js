const config = window.ThirteenXFeedConfig || {};
const apiBase = String(config.apiBase || "").replace(/\/$/, "");
const shareBase = String(config.shareBase || "https://share.13xfile.app/").replace(/\/$/, "");
const gateways = Array.isArray(config.gateways) && config.gateways.length ? config.gateways : ["https://dweb.link"];
const pageSize = Number(config.pageSize) || 20;
const fallbackManifestLimit = Number(config.fallbackManifestLimit) || 50;

const searchInput = document.querySelector("#search");
const categorySelect = document.querySelector("#category");
const sortSelect = document.querySelector("#sort");
const refreshButton = document.querySelector("#refresh");
const list = document.querySelector("#file-list");
const resultCount = document.querySelector("#result-count");
const sourceLabel = document.querySelector("#source-label");
const networkState = document.querySelector("#network-state");
const pagination = document.querySelector("#pagination");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const pageLabel = document.querySelector("#page-label");

let page = 1;
let total = 0;
let fallbackItems = [];
let fallbackLoaded = false;
let loadToken = 0;
let debounceTimer = 0;

function setNetwork(mode, label) {
  networkState.classList.remove("ready", "fallback");
  if (mode) networkState.classList.add(mode);
  networkState.querySelector("b").textContent = label;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return value.toFixed(index === 0 ? 0 : 1) + " " + units[index];
}

function relativeDate(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return Math.max(1, Math.floor(diff / minute)) + "m ago";
  if (diff < day) return Math.floor(diff / hour) + "h ago";
  if (diff < 30 * day) return Math.floor(diff / day) + "d ago";
  return new Date(timestamp).toLocaleDateString();
}

function fileType(entry) {
  const name = entry.file?.name || "";
  const ext = name.includes(".") ? name.split(".").pop().slice(0, 5).toUpperCase() : "";
  if (ext) return ext;
  const mime = entry.file?.mime || "";
  if (mime.startsWith("image/")) return "IMG";
  if (mime.startsWith("video/")) return "VID";
  if (mime.startsWith("audio/")) return "AUD";
  return "FILE";
}

function base64url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function shareURL(entry) {
  const descriptor = {
    v: 1,
    id: entry.file?.id || "",
    name: entry.file?.name || "shared-file",
    cid: entry.file?.cid || "",
    size: entry.file?.size || 0,
    mime: entry.file?.mime || "application/octet-stream",
    visibility: "public"
  };
  return shareBase + "#" + base64url(JSON.stringify(descriptor));
}

function render(items, source) {
  list.replaceChildren();
  sourceLabel.textContent = source;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No public files match these filters.";
    list.appendChild(empty);
  } else {
    for (const item of items) {
      const entry = item.entry || item;
      const row = document.createElement("article");
      row.className = "file-row";

      const identity = document.createElement("div");
      identity.className = "identity";

      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.textContent = fileType(entry);

      const identityCopy = document.createElement("div");
      identityCopy.style.minWidth = "0";

      const name = document.createElement("b");
      name.textContent = entry.file?.name || "Unnamed file";

      const cid = document.createElement("code");
      cid.textContent = entry.file?.cid || "";

      identityCopy.append(name, cid);
      identity.append(icon, identityCopy);

      const size = document.createElement("span");
      size.className = "meta";
      size.textContent = formatBytes(Number(entry.file?.size || 0));

      const date = document.createElement("span");
      date.className = "meta";
      date.textContent = relativeDate(entry.publishedAt);

      const visibility = document.createElement("span");
      visibility.className = "public-badge";
      visibility.textContent = "Public";

      const open = document.createElement("button");
      open.className = "open-button";
      open.type = "button";
      open.textContent = "Open";
      open.addEventListener("click", () => {
        window.open(shareURL(entry), "_blank", "noopener,noreferrer");
      });

      row.append(identity, size, date, visibility, open);
      list.appendChild(row);
    }
  }

  resultCount.textContent = total + (total === 1 ? " file" : " files");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  pagination.hidden = pageCount <= 1;
  pageLabel.textContent = "Page " + page + " of " + pageCount;
  previousButton.disabled = page <= 1;
  nextButton.disabled = page >= pageCount;
}

async function refreshRootHint() {
  if (!apiBase) return;
  try {
    const response = await fetch(apiBase + "/v1/feed/root", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    if (data.ipnsName) localStorage.setItem("13xfile-feed-ipns", String(data.ipnsName));
  } catch {
    // The fast index can work even if root discovery is temporarily unavailable.
  }
}

async function apiFeed() {
  if (!apiBase) throw new Error("API not configured");
  const url = new URL(apiBase + "/v1/feed");
  url.searchParams.set("q", searchInput.value.trim());
  url.searchParams.set("category", categorySelect.value);
  url.searchParams.set("sort", sortSelect.value);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(pageSize));

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Feed API " + response.status);
  const data = await response.json();
  total = Number(data.total) || 0;
  return Array.isArray(data.items) ? data.items : [];
}

async function fetchGateway(path) {
  let lastError = null;
  for (const gateway of gateways) {
    try {
      const response = await fetch(String(gateway).replace(/\/$/, "") + path, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No gateway available");
}

async function loadFallbackRecords() {
  if (fallbackLoaded) return fallbackItems;
  const ipnsName = String(config.ipnsName || localStorage.getItem("13xfile-feed-ipns") || "").trim();
  if (!ipnsName) throw new Error("Decentralized feed root is not configured");

  const latest = await fetchGateway("/ipns/" + encodeURIComponent(ipnsName));
  let manifest = latest;
  let visited = 0;
  const metadataCIDs = [];

  while (manifest && visited < fallbackManifestLimit) {
    if (manifest.type !== "13xfile.feed.manifest" || manifest.version !== 1) break;
    if (Array.isArray(manifest.entries)) metadataCIDs.push(...manifest.entries);
    const previous = String(manifest.previous || "").trim();
    if (!previous) break;
    manifest = await fetchGateway("/ipfs/" + encodeURIComponent(previous));
    visited++;
  }

  const unique = [...new Set(metadataCIDs)];
  const records = [];
  for (const cid of unique) {
    try {
      const entry = await fetchGateway("/ipfs/" + encodeURIComponent(cid));
      if (entry?.type === "13xfile.feed.entry" && entry?.file?.visibility === "public") {
        records.push({ metadataCid: cid, entry });
      }
    } catch {
      // A missing metadata block should not make the whole fallback feed unusable.
    }
  }
  fallbackItems = records;
  fallbackLoaded = true;
  return records;
}

function matchesCategory(entry, category) {
  if (!category || category === "all") return true;
  const mime = String(entry.file?.mime || "");
  if (category === "images") return mime.startsWith("image/");
  if (category === "video") return mime.startsWith("video/");
  if (category === "audio") return mime.startsWith("audio/");
  if (category === "documents") return mime.startsWith("text/") || mime === "application/pdf" || mime.includes("document");
  if (category === "archives") return mime.includes("zip") || mime.includes("tar") || mime.includes("compressed");
  return true;
}

function fallbackPage(records) {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const sort = sortSelect.value;

  let items = records.filter(({ entry }) => {
    const name = String(entry.file?.name || "").toLowerCase();
    const cid = String(entry.file?.cid || "").toLowerCase();
    return (!query || name.includes(query) || cid.includes(query)) && matchesCategory(entry, category);
  });

  items.sort((a, b) => {
    const ae = a.entry;
    const be = b.entry;
    if (sort === "oldest") return new Date(ae.publishedAt).getTime() - new Date(be.publishedAt).getTime();
    if (sort === "name") return String(ae.file?.name || "").localeCompare(String(be.file?.name || ""));
    if (sort === "size") return Number(be.file?.size || 0) - Number(ae.file?.size || 0);
    return new Date(be.publishedAt).getTime() - new Date(ae.publishedAt).getTime();
  });

  total = items.length;
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

async function load() {
  const token = ++loadToken;
  refreshButton.disabled = true;
  setNetwork("", "Connecting");

  try {
    const items = await apiFeed();
    if (token !== loadToken) return;
    setNetwork("ready", "Indexed API");
    render(items, "Fast index");
    refreshRootHint();
  } catch (apiError) {
    try {
      const records = await loadFallbackRecords();
      if (token !== loadToken) return;
      setNetwork("fallback", "IPFS fallback");
      render(fallbackPage(records), "IPFS / IPNS");
    } catch (fallbackError) {
      if (token !== loadToken) return;
      total = 0;
      setNetwork("", "Unavailable");
      list.innerHTML = '<div class="empty">Feed is temporarily unavailable. The official index could not be reached and no decentralized IPNS fallback is configured yet.</div>';
      resultCount.textContent = "0 files";
      sourceLabel.textContent = "Unavailable";
      pagination.hidden = true;
      console.warn("13xfile feed load failed", apiError, fallbackError);
    }
  } finally {
    if (token === loadToken) refreshButton.disabled = false;
  }
}

function filtersChanged() {
  page = 1;
  load();
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(filtersChanged, 220);
});
categorySelect.addEventListener("change", filtersChanged);
sortSelect.addEventListener("change", filtersChanged);
refreshButton.addEventListener("click", () => {
  fallbackLoaded = false;
  load();
});
previousButton.addEventListener("click", () => {
  if (page <= 1) return;
  page--;
  load();
});
nextButton.addEventListener("click", () => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (page >= pages) return;
  page++;
  load();
});

load();
