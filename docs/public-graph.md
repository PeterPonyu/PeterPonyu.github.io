# Public graph maintenance

The Homepage public-graph files are a checked, generated projection of the
SCPortal graph. They are not an additional hand-maintained application list.

- `public-graph.manifest.upstream.json` is the pinned SCPortal v2 source
  snapshot.
- `public-graph.source-ref.json` records the source repository, commit, and
  canonical manifest digest for that snapshot.
- `.github/public-graph.lock.json` pins the same source commit and the SHA-256
  of its exact downloaded bytes. Fetching verifies that digest before writing
  the ignored `.cache/public-graph.manifest.json`.
- The marked graph sections in `index.html` and `sitemap.xml` are generated
  from that verified cache. The cache is checked against the committed source
  snapshot and its canonical digest as well.

Update the snapshot only from a reviewed SCPortal commit, then run:

```bash
node .github/scripts/fetch_public_graph.mjs
node scripts/sync_public_graph.mjs
node .github/scripts/check_public_graph_parity.mjs \
  --source public-graph.manifest.upstream.json \
  --mirror .cache/public-graph.manifest.json \
  --ref public-graph.source-ref.json
node .github/scripts/check_frontend_public_graph.mjs
node .github/scripts/frontend_quality_fixtures.mjs
```

The graph renderer emits only public Pages destinations and the public
documentation URL for local Model Router infrastructure. Local-only sites,
landing-only pages, runtime endpoints, credentials, and workstation paths
must remain outside the generated HTML and sitemap.
