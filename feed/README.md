# 13xfile Feed

Standalone frontend intended for:

```text
feed.13xfile.app
```

This is deliberately separate from `/web`.

The frontend uses the centralized feed API as the fast path for search, filtering, sorting and pagination. If that index is unavailable, it can fall back to the IPNS/IPFS manifest chain.

Configuration lives in `config.js`:

- `apiBase`
- `ipnsName`
- `shareBase`
- gateway list
- fallback manifest limit
- page size

The browser caches the last IPNS name returned by `/v1/feed/root`, so an existing visitor can still attempt the decentralized path if the API later goes offline.
