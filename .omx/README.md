# Homepage OMX QA

This repo tracks only the repo-local OMX QA scripts needed to verify the live
frontend/public-graph surfaces.

Tracked:

- `.omx/scripts/check_frontend_public_graph.mjs`
- `.omx/scripts/check_frontend_quality.mjs`
- `.omx/scripts/frontend_quality_fixtures.mjs`

Ignored:

- `.omx/reports/`
- any future runtime/state/log/context artifacts

## Commands

Run the repo-local public graph audit:

```bash
node .omx/scripts/check_frontend_public_graph.mjs
```

Run the full V1 flagship-triad quality gate:

```bash
node .omx/scripts/check_frontend_quality.mjs
```

Run only the local negative-fixture self-test:

```bash
node .omx/scripts/check_frontend_quality.mjs --fixture-self-test
```

Reports are written under:

```text
.omx/reports/frontend-quality-<timestamp>/
```

## CI / Release Checks

This repo also runs the quality gate through GitHub Actions:

- after the Pages deployment workflow completes successfully;
- on a daily schedule;
- on manual dispatch;
- and a lightweight script self-check on pull requests or pushes that touch the QA tooling.

The workflow uploads the generated report directory as a build artifact so the
screenshots, DOM dumps, `result.json`, and `summary.md` are easy to inspect
without committing runtime report files into the repo.
