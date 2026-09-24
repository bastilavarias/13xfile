(() => {
  const gatewayListURL =
    "https://raw.githubusercontent.com/ipfs/public-gateway-checker/main/gateways.json"

  const fallbackGatewayOrigins = [
    "https://ipfs.filebase.io",
    "https://ipfs.orbitor.dev",
    "https://latam.orbitor.dev",
    "https://apac.orbitor.dev",
    "https://eu.orbitor.dev",
    "https://dget.top",
    "https://ipfs.storry.tv",
    "https://ipfs.io",
    "https://ipfs.cyou",
    "https://dweb.link",
    "https://gateway.pinata.cloud",
    "https://4everland.io",
    "https://trustless-gateway.link",
    "https://ipfs.ecolatam.com",
  ]

  const labels = new Map([
    ["ipfs.filebase.io", "Filebase"],
    ["ipfs.orbitor.dev", "Orbitor Global"],
    ["latam.orbitor.dev", "Orbitor LATAM"],
    ["apac.orbitor.dev", "Orbitor APAC"],
    ["eu.orbitor.dev", "Orbitor Europe"],
    ["dget.top", "DGET"],
    ["ipfs.storry.tv", "Storry"],
    ["ipfs.io", "IPFS.io"],
    ["ipfs.cyou", "IPFS.cyou"],
    ["dweb.link", "Dweb"],
    ["gateway.pinata.cloud", "Pinata"],
    ["4everland.io", "4EVERLAND"],
    ["trustless-gateway.link", "IPFS Trustless"],
    ["ipfs.ecolatam.com", "Ecolatam"],
  ])

  async function loadGatewayOrigins() {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)

    try {
      const response = await fetch(gatewayListURL, {
        cache: "no-store",
        mode: "cors",
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Gateway list HTTP ${response.status}`)

      const payload = await response.json()
      const origins = sanitiseOrigins(payload)
      if (origins.length === 0) throw new Error("Gateway list is empty")
      return origins
    } catch {
      return [...fallbackGatewayOrigins]
    } finally {
      clearTimeout(timeout)
    }
  }

  function gatewayURL(origin, cid) {
    return `${origin.replace(/\/$/, "")}/ipfs/${encodeURIComponent(cid)}`
  }

  function gatewayLabel(origin) {
    try {
      const hostname = new URL(origin).hostname
      return labels.get(hostname) || hostname
    } catch {
      return origin
    }
  }

  function gatewayHostname(origin) {
    try {
      return new URL(origin).hostname
    } catch {
      return origin
    }
  }

  function sanitiseOrigins(payload) {
    if (!Array.isArray(payload)) return []

    return [...new Set(
      payload
        .filter((value) => typeof value === "string")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter((value) => {
          try {
            return new URL(value).protocol === "https:"
          } catch {
            return false
          }
        }),
    )]
  }

  window.ThirteenXGateways = {
    gatewayListURL,
    fallbackGatewayOrigins,
    loadGatewayOrigins,
    gatewayURL,
    gatewayLabel,
    gatewayHostname,
  }
})()
