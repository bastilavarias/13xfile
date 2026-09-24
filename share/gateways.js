// Temporary browser transport adapter for the public-sharing prototype.
// Keep this isolated: the share descriptor and UI do not depend on a specific gateway.
export const publicGateways = [
  (cid) => `https://ipfs.io/ipfs/${encodeURIComponent(cid)}`,
  (cid) => `https://dweb.link/ipfs/${encodeURIComponent(cid)}`,
  (cid) => `https://w3s.link/ipfs/${encodeURIComponent(cid)}`,
]
