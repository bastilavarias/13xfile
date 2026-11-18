# 13xfile static web deployment (Netlify)

The `web/`, `feed/`, and `share/` folders are **three independent static sites**. Do not combine them or upload game files to Netlify. File bytes stay on IPFS; the browser downloads directly from an external IPFS gateway. The Go feed API and Kubo storage peer run separately and must not be exposed as an unrestricted Netlify proxy.

## Create three Netlify sites

Connect the same GitHub repository, `bastilavarias/13xfile`, three times. Use these build settings for each new Netlify site:

| Site | Base directory | Publish directory | Build command | Custom domain |
| --- | --- | --- | --- | --- |
| Product | `web` | `.` | leave empty | `13xfile.app` |
| Public feed | `feed` | `.` | leave empty | `feed.13xfile.app` |
| Download/share | `share` | `.` | leave empty | `share.13xfile.app` |

The `netlify.toml` and `_headers` files in each directory provide site-specific static configuration. Keep each site's base directory set to its own folder. Deploy branch: `main`; set up DNS/custom domains and HTTPS inside Netlify after preview testing. Do not claim these domains are live before the DNS and TLS checks succeed.

No Netlify Functions, rewrites to gateways, edge proxies, blob storage, or game archive files are needed. **Do not use a `200` rewrite from `/download` to an IPFS gateway:** the large response would transit Netlify and consume its bandwidth credits. Direct browser navigation to `https://<gateway>/ipfs/<CID>?download=true&filename=<name>` bypasses Netlify file-transfer bandwidth.

## What can go live independently?

1. `web/` can go live as a static product website.
2. `share/` can go live as a static, CID-driven download page. Visitors can paste a public 13xfile share link or CID when visiting its root URL. Existing desktop share-descriptor links also work.
3. `feed/` is static, but dynamic listings require the separate `api.13xfile.app` feed API or a configured IPNS fallback. It displays an unavailable state until one is reachable.

The static share page does not authenticate readers: treat every public CID and descriptor as public. Private/encrypted files remain app-to-app only.

## Desktop-created share links

Both development builds and production builds now default to `https://share.13xfile.app`. No environment variable is required: newly generated public web share links use this domain automatically.

The optional `WEB_SHARE_BASE_URL` environment variable remains available for an explicit override (for example, `WEB_SHARE_BASE_URL=http://127.0.0.1:8082` when testing an isolated local share page). Without an override, **local desktop development still points to Netlify**.

Deploy `share/` and verify its custom domain and HTTPS before distributing the desktop app update. Until DNS and TLS are live, newly generated public links cannot resolve.

## Feed API deployment is a separate phase

Run the Go `api/` service and its Kubo node on a persistent machine, potentially SEBASTECH behind a dedicated secure reverse proxy. Keep Kubo RPC private and preserve `feed-data` / `feed-ipfs` Docker volumes. Configure `feed/config.js` with the correct production API and IPNS name when confirmed. Restrict the API's CORS origin to the public feed domain and enforce TLS.

**Security blocker:** `POST /v1/feed/submissions` currently has no authentication or rate limiting. Do not publish it unrestricted to the internet before implementing access control, moderation, rate limits, and abuse protections. CORS is **not** a substitute for authentication.

## Large downloads and availability

- The share page requests the file from public IPFS gateways in a **new browser download**. No full-file `fetch`, JavaScript `Blob`, or static-host file relay occurs.
- Gateway checks can fail because of CORS even when manual download works. Users can choose and retry a gateway.
- Browser download progress, pause, and resume depend on the browser and the chosen gateway. 13xfile does not promise them.
- IPFS does not guarantee availability; keep game builds pinned on at least one continuously connected peer and ideally additional authorized replicas.
- Public gateways may impose file-size limits, traffic policies, rate limits or content moderation. For frequent multi-GB downloads, evaluate a dedicated read-only IPFS gateway or paid pinning/CDN service and budget its bandwidth separately.
- Distribute only files you have rights to publish, such as original/homebrew projects or legally distributable port components. Do not upload proprietary game data without distribution rights.

## Netlify bandwidth and monitoring

As of November 2026, credit-based Netlify plans charge 20 credits per GB served from Netlify; free accounts get 300 credits per month for all usage types, including deployment and requests. Direct IPFS-gateway transfers are billed, if applicable, by the gateway operator, **not by Netlify**. Netlify still counts page requests and static page assets. Check your account's specific plan (legacy plans differ) and verify current pricing before public launch.

Sources:
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- https://docs.netlify.com/build/configure-builds/monorepos/
- https://docs.ipfs.tech/reference/http/gateway/

## Before declaring launch complete

- Run `node --test docs/share-download.test.cjs` and the static JavaScript syntax checks.
- Test each `*.netlify.app` preview on phone and desktop, dark/light themes, and no-descriptor share page.
- Test one real legal small file, then a representative multi-GB archive from a persistent pin through a public gateway.
- Confirm browser network inspection shows file bytes loaded from the gateway domain rather than Netlify.
- Verify CDN cost/credits and gateway quotas with realistic traffic.
- Validate Netlify custom-domain DNS and HTTPS, API CORS, and index behavior before switching the desktop share base.
- Keep existing local Docker Compose URLs (`127.0.0.1:8080/8081/8082`) working.
