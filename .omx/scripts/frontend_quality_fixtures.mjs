#!/usr/bin/env node

const EXPECTED_HOMEPAGE_ROUTE_STEPS = 3;
const EXPECTED_HOMEPAGE_BOUNDARY_NOTES = 2;

const positiveFixtures = Object.freeze({
  homepage: `<!doctype html>
<html>
<head>
  <title>Zeyu Fu · PeterPonyu</title>
  <link rel="canonical" href="https://peterponyu.github.io/">
</head>
<body>
  <section id="apps" aria-label="Flagship routes">
    <aside class="routing-aside">
      <div class="route-step compact">1. Start at Homepage</div>
      <div class="route-step compact">2. Open SCPortal</div>
      <div class="route-step compact">3. Continue to LAIOR Benchmarks</div>
    </aside>
    <div class="public-graph-extra">
      <h2>Also in the public graph</h2>
      <p class="boundary-note">mRNA Intersection remains a focused public node.</p>
      <p class="boundary-note">iAODE Pages stay bounded to public documentation.</p>
      <h2>Hidden by design</h2>
      <p>MCCVAE and local-first workspaces are not promoted as app destinations.</p>
    </div>
  </section>
</body>
</html>`,
  scportal: `<!doctype html>
<html>
<head><title>SCPortal Discovery Hub</title></head>
<body>
  <main data-quality-marker="flagship-journey">
    <h1>SCPortal</h1>
    <a href="https://peterponyu.github.io/">Homepage</a>
    <a href="https://peterponyu.github.io/liora-ui/">LAIOR Benchmarks</a>
    <p>Use this flagship journey route for datasets, models, and benchmark navigation.</p>
  </main>
</body>
</html>`,
  liora: `<!doctype html>
<html>
<head><title>LAIOR Benchmarks</title></head>
<body>
  <main data-quality-marker="benchmark-journey">
    <h1>LAIOR Benchmarks</h1>
    <a href="https://peterponyu.github.io/">Homepage</a>
    <a href="https://peterponyu.github.io/scportal/">SCPortal</a>
    <dl class="benchmark-counts">
      <dt>Models</dt><dd data-quality-count="models">23</dd>
      <dt>Datasets</dt><dd data-quality-count="datasets">66</dd>
      <dt>Metrics</dt><dd data-quality-count="metrics">24</dd>
    </dl>
  </main>
</body>
</html>`,
  mccvae: `<!doctype html>
<html>
<head>
  <title>MCCVAE Landing Page</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="https://peterponyu.github.io/MCCVAE/">
</head>
<body>
  <main>
    <p>Landing-Only Project Surface</p>
    <h1>MCCVAE Landing</h1>
    <p>MCCVAE is exposed here as a landing-only project page for a local-first workflow.</p>
    <p>The operational MCCVAE training interface is intentionally not exposed here as a public app.</p>
    <a href="https://peterponyu.github.io/">Homepage</a>
    <a href="https://peterponyu.github.io/scportal/">SCPortal</a>
    <a href="https://github.com/PeterPonyu/MCCVAE">Open Repository</a>
  </main>
</body>
</html>`,
  iaode: `<!doctype html>
<html>
<head><title>iAODE - Interpretable Accessibility ODE</title></head>
<body>
  <main>
    <h1>iAODE</h1>
    <p>Interpretable Accessibility ODE for Single-Cell Analysis.</p>
    <section>
      <h2>Dataset Browser</h2>
      <a href="./datasets/">Explore Datasets</a>
    </section>
    <section>
      <h2>Continuity Explorer</h2>
      <a href="./explorer/">Launch Explorer</a>
    </section>
    <a href="https://github.com/PeterPonyu/iAODE">GitHub Repository</a>
  </main>
</body>
</html>`,
  profileReadme: `# Zeyu Fu (付泽宇)

[![Homepage](https://img.shields.io/badge/Homepage-peterponyu.github.io-2563eb)](https://peterponyu.github.io/)

**Official homepage:** [peterponyu.github.io](https://peterponyu.github.io/)

## Featured Repositories

### Web Applications

| Repository | Description | Demo |
|:-----------|:------------|:-----|
| [**scportal**](https://github.com/PeterPonyu/scportal) | Single-cell analysis portal and discovery hub | [Live](https://peterponyu.github.io/scportal/) |
| [**liora-ui**](https://github.com/PeterPonyu/liora-ui) | LAIOR single-cell benchmarking dashboard | [Live](https://peterponyu.github.io/liora-ui/) |
| [**mrnapp-intersection**](https://github.com/PeterPonyu/mrnapp-intersection) | mRNA intersection visualization | [Live](https://peterponyu.github.io/mrnapp-intersection/) |

## Selected Publications

**Fu, Z.**, Chen, C., Zhang, K. (2026).
Islands and bridges: Momentum contrastive coupling unifies discrete and continuous structure in single-cell omics.
***Biomedical Signal Processing and Control***, 122, 110376.
[DOI](https://doi.org/10.1016/j.bspc.2026.110376) [Code](https://github.com/PeterPonyu/MCCVAE)

### Archive / Legacy Entries

Older or exploratory project entries are kept discoverable here without competing with the current public pages above.

| Repository | Status | Description |
|:-----------|:-------|:------------|
| [**LAIOR**](https://github.com/PeterPonyu/Liora) | Accepted / legacy code entry | Hyperbolic Neural-ODE VAE |
`,
  mrnaReadme: `<div align="center">
  <a href="https://peterponyu.github.io/">
    <img src="https://peterponyu.github.io/assets/badges/mrnapp-intersection.svg" width="64" alt="ZF Lab · mrnapp-intersection">
  </a>
</div>

# mRNA-seq Static Presentation Site

Public utility surface in the PeterPonyu public graph for browsing precomputed mRNA-seq analysis results.

## Public Graph Status

- This repository is a bounded static-export exception: it currently contains the rendered public export and supporting data/assets rather than the original application source tree.
- Homepage (https://peterponyu.github.io/) and SCPortal (https://peterponyu.github.io/scportal/) are the canonical discovery/root neighbors for this surface.
- The current public boundary is intentional.
`,
});

const negativeCases = Object.freeze([
  {
    id: 'homepage-route-steps-removed',
    expectedFailure: 'Homepage #apps aside must contain exactly 3 compact route steps.',
    mutate: (fixtures) => ({
      ...fixtures,
      homepage: fixtures.homepage.replaceAll(/\s*<div class="route-step compact">[\s\S]*?<\/div>/g, ''),
    }),
  },
  {
    id: 'homepage-hidden-by-design-inside-aside',
    expectedFailure: 'Homepage Hidden by design content must be outside the #apps routing aside.',
    mutate: (fixtures) => ({
      ...fixtures,
      homepage: fixtures.homepage
        .replace('<h2>Hidden by design</h2>\n      ', '')
        .replace('</aside>', '<h2>Hidden by design</h2></aside>'),
    }),
  },
  {
    id: 'scportal-liora-link-removed',
    expectedFailure: 'SCPortal must link to Liora/LAIOR.',
    mutate: (fixtures) => ({
      ...fixtures,
      scportal: fixtures.scportal.replace(
        /\n    <a href="https:\/\/peterponyu\.github\.io\/liora-ui\/">LAIOR Benchmarks<\/a>/,
        '',
      ),
    }),
  },
  {
    id: 'liora-zero-dataset-count',
    expectedFailure: 'Liora datasets count must be nonzero.',
    mutate: (fixtures) => ({
      ...fixtures,
      liora: fixtures.liora.replace('data-quality-count="datasets">66', 'data-quality-count="datasets">0'),
    }),
  },
  {
    id: 'homepage-visible-iaode-workspace-promoted',
    expectedFailure: 'Homepage must not promote iAODE Workspace as a visible app destination.',
    mutate: (fixtures) => ({
      ...fixtures,
      homepage: fixtures.homepage.replace(
        '</aside>',
        '<a class="app-card" href="https://peterponyu.github.io/iAODE/frontend/">iAODE Workspace</a></aside>',
      ),
    }),
  },
  {
    id: 'mccvae-landing-only-language-removed',
    expectedFailure: 'MCCVAE must preserve landing-only language.',
    mutate: (fixtures) => ({
      ...fixtures,
      mccvae: fixtures.mccvae
        .replace('Landing-Only Project Surface', 'Public Application Surface')
        .replace('landing-only project page', 'live hosted application'),
    }),
  },
  {
    id: 'mccvae-live-app-route-promoted',
    expectedFailure: 'MCCVAE must not promote live app routes.',
    mutate: (fixtures) => ({
      ...fixtures,
      mccvae: fixtures.mccvae.replace(
        '<a href="https://github.com/PeterPonyu/MCCVAE">Open Repository</a>',
        '<a href="https://peterponyu.github.io/MCCVAE/models/">Launch App</a>',
      ),
    }),
  },
  {
    id: 'iaode-local-workspace-promoted',
    expectedFailure: 'iAODE public page must not promote local workspace/training UI.',
    mutate: (fixtures) => ({
      ...fixtures,
      iaode: fixtures.iaode.replace(
        '<a href="https://github.com/PeterPonyu/iAODE">GitHub Repository</a>',
        '<a href="http://localhost:8000/ui">Training UI</a><a href="https://github.com/PeterPonyu/iAODE">GitHub Repository</a>',
      ),
    }),
  },
  {
    id: 'profile-homepage-link-removed',
    expectedFailure: 'Profile README must link to the canonical homepage.',
    mutate: (fixtures) => ({
      ...fixtures,
      profileReadme: fixtures.profileReadme.replaceAll('https://peterponyu.github.io/', 'https://example.com/'),
    }),
  },
  {
    id: 'profile-mcc-paper-removed',
    expectedFailure: 'Profile README must promote the published MCCVAE paper and repository.',
    mutate: (fixtures) => ({
      ...fixtures,
      profileReadme: fixtures.profileReadme
        .replace('10.1016/j.bspc.2026.110376', '10.0000/removed')
        .replace('https://github.com/PeterPonyu/MCCVAE', 'https://github.com/PeterPonyu/removed'),
    }),
  },
  {
    id: 'mrna-root-neighbor-link-removed',
    expectedFailure: 'mRNA README must link to SCPortal as a canonical root neighbor.',
    mutate: (fixtures) => ({
      ...fixtures,
      mrnaReadme: fixtures.mrnaReadme
        .replaceAll('https://peterponyu.github.io/scportal/', 'https://example.com/scportal/')
        .replace('SCPortal', 'the analysis portal'),
    }),
  },
]);

function stripTags(value) {
  return value.replaceAll(/<[^>]+>/g, ' ').replaceAll(/\s+/g, ' ').trim();
}

function elementBlockById(html, id) {
  const escaped = id.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<(?<tag>[a-zA-Z][\\w:-]*)\\b[^>]*\\bid=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/\\k<tag>>`, 'i');
  return html.match(pattern)?.[0] ?? '';
}

function firstBlockByClass(html, className) {
  const escaped = className.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<(?<tag>[a-zA-Z][\\w:-]*)\\b[^>]*\\bclass=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\k<tag>>`, 'i');
  return html.match(pattern)?.[0] ?? '';
}

function countClass(html, className) {
  const escaped = className.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...html.matchAll(new RegExp(`\\bclass=["'][^"']*\\b${escaped}\\b`, 'gi'))].length;
}

function hasHrefContaining(html, needle) {
  return new RegExp(`\\bhref=["'][^"']*${needle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*["']`, 'i').test(html);
}

function hasHrefMatching(html, pattern) {
  return [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].some((match) => pattern.test(match[1]));
}

function textIncludes(html, text) {
  return stripTags(html).toLowerCase().includes(text.toLowerCase());
}

function markdownSection(markdown, headingPattern) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return '';
  const currentDepth = lines[start].match(/^#+/)?.[0].length ?? 0;
  const end = lines.findIndex((line, index) => {
    if (index <= start) return false;
    const match = line.match(/^(#+)\s+/);
    return match && match[1].length <= currentDepth;
  });
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

function readCount(html, key) {
  const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`data-quality-count=["']${escaped}["'][^>]*>\\s*([0-9,]+)`, 'i'));
  return match ? Number.parseInt(match[1].replaceAll(',', ''), 10) : Number.NaN;
}

function collectCheck(condition, message, failures) {
  if (!condition) failures.push(message);
}

export function validateHomepageFixture(html) {
  const failures = [];
  const apps = elementBlockById(html, 'apps');
  const aside = firstBlockByClass(apps, 'routing-aside');

  collectCheck(Boolean(apps), 'Homepage must contain #apps section.', failures);
  collectCheck(Boolean(aside), 'Homepage #apps must contain a routing aside.', failures);
  collectCheck(countClass(aside, 'route-step') === EXPECTED_HOMEPAGE_ROUTE_STEPS, 'Homepage #apps aside must contain exactly 3 compact route steps.', failures);
  collectCheck(textIncludes(apps, 'Also in the public graph'), 'Homepage must contain Also in the public graph copy.', failures);
  collectCheck(!textIncludes(aside, 'Also in the public graph'), 'Homepage Also in the public graph content must be outside the #apps routing aside.', failures);
  collectCheck(textIncludes(apps, 'Hidden by design'), 'Homepage must contain Hidden by design copy.', failures);
  collectCheck(!textIncludes(aside, 'Hidden by design'), 'Homepage Hidden by design content must be outside the #apps routing aside.', failures);
  collectCheck(countClass(apps, 'boundary-note') === EXPECTED_HOMEPAGE_BOUNDARY_NOTES, 'Homepage must contain exactly 2 boundary notes.', failures);
  collectCheck(!textIncludes(apps, 'iAODE Workspace'), 'Homepage must not promote iAODE Workspace as a visible app destination.', failures);

  return failures;
}

export function validateScportalFixture(html) {
  const failures = [];
  collectCheck(/<title>[^<]*(SCPortal|Discovery Hub)[^<]*<\/title>/i.test(html), 'SCPortal title must contain SCPortal or Discovery Hub.', failures);
  collectCheck(hasHrefContaining(html, 'peterponyu.github.io/'), 'SCPortal must link to homepage.', failures);
  collectCheck(hasHrefContaining(html, 'liora-ui'), 'SCPortal must link to Liora/LAIOR.', failures);
  collectCheck(textIncludes(html, 'flagship journey') || textIncludes(html, 'task route') || /data-quality-marker=["']flagship-journey["']/i.test(html), 'SCPortal must include flagship journey/task-route markers.', failures);
  return failures;
}

export function validateLioraFixture(html) {
  const failures = [];
  collectCheck(/<title>[^<]*LAIOR Benchmarks[^<]*<\/title>/i.test(html), 'Liora title must contain LAIOR Benchmarks.', failures);
  collectCheck(hasHrefContaining(html, 'peterponyu.github.io/'), 'Liora must link to homepage.', failures);
  collectCheck(hasHrefContaining(html, 'scportal'), 'Liora must link to SCPortal.', failures);
  collectCheck(textIncludes(html, 'benchmark journey') || /data-quality-marker=["']benchmark-journey["']/i.test(html), 'Liora must include benchmark journey marker.', failures);
  for (const key of ['models', 'datasets', 'metrics']) {
    const count = readCount(html, key);
    collectCheck(Number.isFinite(count), `Liora ${key} count must be present.`, failures);
    collectCheck(count > 0, `Liora ${key} count must be nonzero.`, failures);
  }
  return failures;
}

export function validateMccvaeFixture(html) {
  const failures = [];
  const text = stripTags(html).toLowerCase();
  const promotesLiveAppRoutes = hasHrefMatching(html, /\/MCCVAE\/(?:datasets|models|metrics|explorer)(?:\/|$)/i);
  const promotesLiveAppCopy = ['launch app', 'open app', 'try the app', 'explore datasets', 'launch explorer', 'training ui'].some((phrase) => text.includes(phrase));

  collectCheck(/<title>[^<]*MCCVAE[^<]*Landing[^<]*<\/title>/i.test(html), 'MCCVAE title must identify the landing page.', failures);
  collectCheck(/rel=["']canonical["'][^>]*href=["']https:\/\/peterponyu\.github\.io\/MCCVAE\/["']/i.test(html), 'MCCVAE canonical URL must point to /MCCVAE/.', failures);
  collectCheck(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html), 'MCCVAE landing page must keep noindex robots metadata.', failures);
  collectCheck(hasHrefContaining(html, 'peterponyu.github.io/'), 'MCCVAE must link to homepage.', failures);
  collectCheck(hasHrefContaining(html, 'scportal'), 'MCCVAE must link to SCPortal.', failures);
  collectCheck(hasHrefContaining(html, 'github.com/PeterPonyu/MCCVAE'), 'MCCVAE must link to source repository.', failures);
  collectCheck(text.includes('landing-only') || text.includes('landing only'), 'MCCVAE must preserve landing-only language.', failures);
  collectCheck(text.includes('local-first'), 'MCCVAE must preserve local-first boundary language.', failures);
  collectCheck(text.includes('not exposed here as a public app'), 'MCCVAE must state the training interface is not public.', failures);
  collectCheck(!promotesLiveAppRoutes, 'MCCVAE must not promote live app routes.', failures);
  collectCheck(!promotesLiveAppCopy, 'MCCVAE must not use live-app promotion copy.', failures);

  return failures;
}

export function validateIaodeFixture(html) {
  const failures = [];
  const text = stripTags(html).toLowerCase();
  const promotesLocalWorkspace = ['training ui', 'localhost', 'start_training_ui', 'start training ui', 'local workspace', 'workspace ui'].some((phrase) => text.includes(phrase));

  collectCheck(/<title>[^<]*iAODE[^<]*<\/title>/i.test(html), 'iAODE title must contain iAODE.', failures);
  collectCheck(text.includes('interpretable accessibility ode'), 'iAODE public page must preserve the project expansion.', failures);
  collectCheck(text.includes('dataset browser'), 'iAODE public page must expose Dataset Browser.', failures);
  collectCheck(text.includes('continuity explorer'), 'iAODE public page must expose Continuity Explorer.', failures);
  collectCheck(hasHrefMatching(html, /(?:^|\/)datasets\/?$/i), 'iAODE public page must link to public datasets route.', failures);
  collectCheck(hasHrefMatching(html, /(?:^|\/)explorer\/?$/i), 'iAODE public page must link to public explorer route.', failures);
  collectCheck(hasHrefContaining(html, 'github.com/PeterPonyu/iAODE'), 'iAODE public page must link to source repository.', failures);
  collectCheck(!promotesLocalWorkspace, 'iAODE public page must not promote local workspace/training UI.', failures);

  return failures;
}

export const validateIaodePublicFixture = validateIaodeFixture;

export function validateIaodeReadmeFixture(markdown) {
  const failures = [];
  const lower = markdown.toLowerCase();
  collectCheck(lower.includes('https://peterponyu.github.io/'), 'iAODE README must link back to the homepage identity root.', failures);
  collectCheck(lower.includes('https://peterponyu.github.io/scportal/'), 'iAODE README must route interactive public tools to SCPortal.', failures);
  collectCheck(lower.includes('original project page') && lower.includes('https://peterponyu.github.io/iaode/'), 'iAODE README must preserve the public project page link as a snapshot.', failures);
  collectCheck(lower.includes('localhost:8000/ui'), 'iAODE README training UI must remain a localhost/local workflow.', failures);
  collectCheck(!/https:\/\/peterponyu\.github\.io\/iAODE\/(?:frontend|ui|training|workspace)/i.test(markdown), 'iAODE README must not promote local workspace UI as a GitHub Pages app.', failures);
  return failures;
}

export function validateProfileReadmeFixture(markdown) {
  const failures = [];
  const webApps = markdownSection(markdown, /^###\s+Web Applications\b/i);
  const archive = markdownSection(markdown, /^###\s+Archive\s*\/\s*Legacy Entries\b/i);

  collectCheck(/https:\/\/peterponyu\.github\.io\/(?![A-Za-z0-9_-])/i.test(markdown), 'Profile README must link to the canonical homepage.', failures);
  collectCheck(Boolean(webApps), 'Profile README must keep the Web Applications section.', failures);
  collectCheck(textIncludes(webApps, 'scportal') && /https:\/\/peterponyu\.github\.io\/scportal\//i.test(webApps), 'Profile README must list current scportal web app with live link.', failures);
  collectCheck(textIncludes(webApps, 'liora-ui') && /https:\/\/peterponyu\.github\.io\/liora-ui\//i.test(webApps), 'Profile README must list current liora-ui web app with live link.', failures);
  collectCheck(textIncludes(webApps, 'mrnapp-intersection') && /https:\/\/peterponyu\.github\.io\/mrnapp-intersection\//i.test(webApps), 'Profile README must list current mrnapp-intersection web app with live link.', failures);
  collectCheck(Boolean(archive), 'Profile README must keep the Archive / Legacy section.', failures);
  collectCheck(
    /10\.1016\/j\.bspc\.2026\.110376/i.test(markdown) && /https:\/\/github\.com\/PeterPonyu\/MCCVAE/i.test(markdown),
    'Profile README must promote the published MCCVAE paper and repository.',
    failures,
  );
  collectCheck(
    !(textIncludes(archive, 'MCCVAE') && textIncludes(archive, 'landing-only')),
    'Profile README must not keep MCCVAE as a landing-only archive entry after publication.',
    failures,
  );
  return failures;
}

export function validateMrnaReadmeFixture(markdown) {
  const failures = [];
  collectCheck(textIncludes(markdown, 'Public utility surface'), 'mRNA README must describe a bounded public utility surface.', failures);
  collectCheck(textIncludes(markdown, 'bounded static-export exception'), 'mRNA README must keep bounded static-export exception language.', failures);
  collectCheck(textIncludes(markdown, 'precomputed mRNA-seq analysis results'), 'mRNA README must keep precomputed-results utility language.', failures);
  collectCheck(/https:\/\/peterponyu\.github\.io\/(?![A-Za-z0-9_-])/i.test(markdown), 'mRNA README must link to the canonical homepage.', failures);
  collectCheck(/https:\/\/peterponyu\.github\.io\/scportal\//i.test(markdown), 'mRNA README must link to SCPortal as a canonical root neighbor.', failures);
  collectCheck(textIncludes(markdown, 'canonical discovery/root neighbors'), 'mRNA README must keep root-neighbor language.', failures);
  collectCheck(textIncludes(markdown, 'public boundary is intentional'), 'mRNA README must keep intentional public-boundary language.', failures);
  return failures;
}

export function validateFlagshipHtmlFixtures(fixtures) {
  const checks = {
    homepage: validateHomepageFixture(fixtures.homepage),
    scportal: validateScportalFixture(fixtures.scportal),
    liora: validateLioraFixture(fixtures.liora),
    mccvae: validateMccvaeFixture(fixtures.mccvae),
    iaode: validateIaodeFixture(fixtures.iaode),
    profileReadme: validateProfileReadmeFixture(fixtures.profileReadme),
    mrnaReadme: validateMrnaReadmeFixture(fixtures.mrnaReadme),
  };
  const failures = Object.entries(checks).flatMap(([surface, list]) =>
    list.map((message) => ({ surface, message })),
  );
  return { ok: failures.length === 0, checks, failures };
}

export function runNegativeFixtureChecks() {
  const positive = validateFlagshipHtmlFixtures(positiveFixtures);
  if (!positive.ok) {
    return {
      ok: false,
      positiveFixtureOk: false,
      cases: [],
      failures: positive.failures.map(({ surface, message }) => `positive ${surface}: ${message}`),
    };
  }

  const cases = negativeCases.map((fixtureCase) => {
    const mutated = fixtureCase.mutate(positiveFixtures);
    const result = validateFlagshipHtmlFixtures(mutated);
    const observedMessages = result.failures.map(({ message }) => message);
    const ok = observedMessages.includes(fixtureCase.expectedFailure);
    return {
      id: fixtureCase.id,
      ok,
      expectedFailure: fixtureCase.expectedFailure,
      observedFailures: result.failures,
    };
  });

  return {
    ok: cases.every((fixtureCase) => fixtureCase.ok),
    positiveFixtureOk: true,
    cases,
    failures: cases
      .filter((fixtureCase) => !fixtureCase.ok)
      .map((fixtureCase) => `${fixtureCase.id}: expected failure not observed`),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runNegativeFixtureChecks();
  for (const fixtureCase of result.cases) {
    console.log(`${fixtureCase.ok ? 'PASS' : 'FAIL'} ${fixtureCase.id}: ${fixtureCase.expectedFailure}`);
  }
  if (!result.ok) {
    console.error(JSON.stringify(result.failures, null, 2));
    process.exit(1);
  }
}
