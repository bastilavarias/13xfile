window.ThirteenXFeedConfig = {
  apiBase: location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8090"
    : "https://api.13xfile.app",
  ipnsName: "",
  shareBase: location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "../share/index.html"
    : "https://share.13xfile.app/",
  gateways: [
    "https://dweb.link",
    "https://ipfs.io"
  ],
  fallbackManifestLimit: 50,
  pageSize: 20
};
