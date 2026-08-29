# Vendored runtime dependencies

`studio-oauth.js` is the unmodified JavaScript payload from the official
[BC Studio OAuth v0.1.2 release](https://github.com/bondage-studio/studio-oauth/releases/tag/v0.1.2).

- Release asset SHA-256: `81fb82866fdbd6321c4d8b3afbb8c983f3a508194a1a63fc9c312f7bbfd151f7`
- Integrated as a side-effect import so AEE remains standalone.
- The public `globalThis.studioOauth` API is used by `src/core/sps.ts`.

When upgrading, replace the file with a newer official release asset, update the
version/hash above, and run the cloud-storage test suite.
