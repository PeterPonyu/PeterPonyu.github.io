#!/usr/bin/env node

const EXPECTED_HOMEPAGE_GUIDE_BADGES = 4;
const SCPORTAL_URL = 'https://peterponyu.github.io/scportal/';
const LIORA_URL = 'https://peterponyu.github.io/liora-ui/';

const SCPORTAL_PUBLIC_ROUTE_PATTERNS = Object.freeze({
  datasets: /^\/scportal\/datasets$/i,
  explorer: /^\/scportal\/explorer$/i,
  benchmarks: /^\/scportal\/(?:benchmarks|metrics)$/i,
  models: /^\/scportal\/(?:models|model-catalog|methods)$/i,
});

const LIORA_PUBLIC_ROUTE_PATTERNS = Object.freeze({
  models: /^\/liora-ui\/models$/i,
  datasets: /^\/liora-ui\/datasets$/i,
  metrics: /^\/liora-ui\/metrics$/i,
});

const positiveFixtures = Object.freeze({
  homepage: `<!doctype html>
<html>
<head>
  <title>Zeyu Fu · PeterPonyu</title>
  <link rel="canonical" href="https://peterponyu.github.io/">
</head>
<body>
  <section id="apps" aria-label="Flagship routes">
    <div class="tool-groups">
      <div>
        <div>Start here</div>
        <a href="https://peterponyu.github.io/scportal/">SCPortal</a>
        <a href="https://peterponyu.github.io/mrnapp-intersection/">mRNA Intersection</a>
      </div>
      <div>
        <div>Benchmark and companion pages</div>
        <a href="https://peterponyu.github.io/liora-ui/">LAIOR Benchmarks</a>
        <a href="https://peterponyu.github.io/iAODE/">iAODE Pages</a>
        <a href="https://peterponyu.github.io/scccvgben-next/">scCCVGBen</a>
        <a href="https://peterponyu.github.io/gahib-site/">GAHIB</a>
      </div>
    </div>
    <aside class="routing-aside">
      <h2>What you will find here</h2>
      <span class="badge">Browse</span>
      <span class="badge">Analyze</span>
      <span class="badge">Compare</span>
      <span class="badge">Read</span>
    </aside>
    <div class="linked-pages">
      <h2>More linked pages</h2>
      <a href="https://peterponyu.github.io/liora-ui/">LAIOR Benchmarks</a>
      <a href="https://peterponyu.github.io/iAODE/">iAODE Pages</a>
    </div>
  </section>
</body>
</html>`,
  scportal: `<!doctype html>
<html>
<head><title>SCPortal Discovery Hub</title></head>
<body>
  <main>
    <h1>SCPortal</h1>
    <a href="https://peterponyu.github.io/">Homepage</a>
    <a href="https://peterponyu.github.io/liora-ui/">LAIOR Benchmarks</a>
    <nav aria-label="Public SCPortal task routes">
      <a href="/scportal/datasets">Datasets</a>
      <a href="/scportal/explorer">Continuity Explorer</a>
      <a href="/scportal/benchmarks">Benchmarks</a>
      <a href="/scportal/models">Models</a>
    </nav>
  </main>
</body>
</html>`,
  liora: `<!doctype html>
<html>
<head><title>LAIOR Benchmarks</title></head>
<body>
  <main>
    <h1>LAIOR Benchmarks</h1>
    <a href="https://peterponyu.github.io/">Homepage</a>
    <a href="https://peterponyu.github.io/scportal/">SCPortal</a>
    <nav aria-label="LAIOR benchmark routes">
      <a href="/liora-ui/models/">Models</a>
      <a href="/liora-ui/datasets/">Datasets</a>
      <a href="/liora-ui/metrics/">Metrics</a>
    </nav>
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

**Current focus:** AI agent harnesses, AI-accelerated research, AI scientist infrastructure, and production-minded mass-vibing systems.

## Academic Proofs: Selected Publications

**Fu, Z.**, Chen, C., Zhang, K. (2026).
Islands and bridges: Momentum contrastive coupling unifies discrete and continuous structure in single-cell omics.
***Biomedical Signal Processing and Control***, 122, 110376.
[DOI](https://doi.org/10.1016/j.bspc.2026.110376) [Code](https://github.com/PeterPonyu/MCCVAE)

## GitHub Stats & AI Usage

**Public identity:** [Homepage](https://peterponyu.github.io/) &middot; [ORCID](https://orcid.org/0009-0001-8329-0108) &middot; [Scopus](https://www.scopus.com/authid/detail.uri?authorId=59315299200)
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
    id: 'homepage-guide-badges-removed',
    expectedFailure: 'Homepage #apps quick guide must contain at least 4 badges.',
    mutate: (fixtures) => ({
      ...fixtures,
      homepage: fixtures.homepage.replaceAll(/\s*<span class="badge">[\s\S]*?<\/span>/g, ''),
    }),
  },
  {
    id: 'homepage-linked-pages-heading-removed',
    expectedFailure: 'Homepage #apps must contain the current tool-group headings.',
    mutate: (fixtures) => ({
      ...fixtures,
      homepage: fixtures.homepage.replace('More linked pages', 'Linked pages'),
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
    id: 'scportal-model-route-removed',
    expectedFailure: 'SCPortal must link to datasets, explorer, benchmarks, and models public routes.',
    mutate: (fixtures) => ({
      ...fixtures,
      scportal: fixtures.scportal.replace(/\n      <a href="\/scportal\/models">Models<\/a>/, ''),
    }),
  },
  {
    id: 'liora-metric-route-removed',
    expectedFailure: 'Liora must link to model, dataset, and metric routes.',
    mutate: (fixtures) => ({
      ...fixtures,
      liora: fixtures.liora.replace(/\n      <a href="\/liora-ui\/metrics\/">Metrics<\/a>/, ''),
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
    id: 'liora-visible-counts-removed-but-hydration-kept',
    expectedFailure: 'Liora models count must be present.',
    mutate: (fixtures) => ({
      ...fixtures,
      liora: fixtures.liora.replace(/<dl class="benchmark-counts">[\s\S]*?<\/dl>/, '<script>self.__next_f = ["23 Models 66 Datasets 24 Metrics"];</script>'),
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
    id: 'profile-current-focus-removed',
    expectedFailure: 'Profile README must state the current AI-agent focus.',
    mutate: (fixtures) => ({
      ...fixtures,
      profileReadme: fixtures.profileReadme.replace('**Current focus:** AI agent harnesses, AI-accelerated research, AI scientist infrastructure, and production-minded mass-vibing systems.', ''),
    }),
  },
  {
    id: 'profile-selected-publications-heading-removed',
    expectedFailure: 'Profile README must keep the selected publications section.',
    mutate: (fixtures) => ({
      ...fixtures,
      profileReadme: fixtures.profileReadme.replace('## Academic Proofs: Selected Publications', '## Publications'),
    }),
  },
  {
    id: 'profile-public-identity-removed',
    expectedFailure: 'Profile README must keep public identity links.',
    mutate: (fixtures) => ({
      ...fixtures,
      profileReadme: fixtures.profileReadme.replace('**Public identity:** [Homepage](https://peterponyu.github.io/) &middot; [ORCID](https://orcid.org/0009-0001-8329-0108) &middot; [Scopus](https://www.scopus.com/authid/detail.uri?authorId=59315299200)', ''),
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

function stripNonVisibleBlocks(value) {
  return value.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
}

function stripTags(value) {
  return stripNonVisibleBlocks(value).replaceAll(/<[^>]+>/g, ' ').replaceAll(/\s+/g, ' ').trim();
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

function hrefPaths(html, baseUrl) {
  return [...html.matchAll(/\bhref=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        const pathname = new URL(match[1], baseUrl).pathname.replace(/\/+$/g, '');
        return pathname || '/';
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function hasRoute(html, baseUrl, pattern) {
  return hrefPaths(html, baseUrl).some((hrefPath) => pattern.test(hrefPath));
}

function routePresence(html, baseUrl, patterns) {
  const paths = hrefPaths(html, baseUrl);
  return Object.fromEntries(Object.entries(patterns).map(([name, pattern]) => [name, paths.some((hrefPath) => pattern.test(hrefPath))]));
}

function allRoutesPresent(presence) {
  return Object.values(presence).every(Boolean);
}

function textIncludes(html, text) {
  return stripTags(html).toLowerCase().includes(text.toLowerCase());
}

function readCount(html, key) {
  const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stripNonVisibleBlocks(html).match(new RegExp(`data-quality-count=["']${escaped}["'][^>]*>\\s*([0-9,]+)`, 'i'));
  return match ? Number.parseInt(match[1].replaceAll(',', ''), 10) : Number.NaN;
}

function collectCheck(condition, message, failures) {
  if (!condition) failures.push(message);
}

export function validateHomepageFixture(html) {
  const failures = [];
  const apps = elementBlockById(html, 'apps');
  const aside = firstBlockByClass(apps, 'routing-aside');
  const appsText = stripTags(apps).toLowerCase();

  collectCheck(Boolean(apps), 'Homepage must contain #apps section.', failures);
  collectCheck(Boolean(aside), 'Homepage #apps must contain a routing aside.', failures);
  collectCheck(countClass(aside, 'badge') >= EXPECTED_HOMEPAGE_GUIDE_BADGES, 'Homepage #apps quick guide must contain at least 4 badges.', failures);
  collectCheck(
    ['start here', 'benchmark and companion pages', 'more linked pages'].every((label) => appsText.includes(label)),
    'Homepage #apps must contain the current tool-group headings.',
    failures,
  );
  collectCheck(!textIncludes(apps, 'Also in the public graph') && !textIncludes(apps, 'Hidden by design'), 'Homepage must not contain retired public-graph boundary copy.', failures);
  collectCheck(!textIncludes(apps, 'iAODE Workspace'), 'Homepage must not promote iAODE Workspace as a visible app destination.', failures);

  return failures;
}

export function validateScportalFixture(html) {
  const failures = [];
  const routes = routePresence(html, SCPORTAL_URL, SCPORTAL_PUBLIC_ROUTE_PATTERNS);
  collectCheck(/<title>[^<]*(SCPortal|Discovery Hub)[^<]*<\/title>/i.test(html), 'SCPortal title must contain SCPortal or Discovery Hub.', failures);
  collectCheck(hasRoute(html, SCPORTAL_URL, /^\/$/), 'SCPortal must link to homepage.', failures);
  collectCheck(hasRoute(html, SCPORTAL_URL, /^\/liora-ui$/), 'SCPortal must link to Liora/LAIOR.', failures);
  collectCheck(allRoutesPresent(routes), 'SCPortal must link to datasets, explorer, benchmarks, and models public routes.', failures);
  return failures;
}

export function validateLioraFixture(html) {
  const failures = [];
  const routes = routePresence(html, LIORA_URL, LIORA_PUBLIC_ROUTE_PATTERNS);
  collectCheck(/<title>[^<]*LAIOR Benchmarks[^<]*<\/title>/i.test(html), 'Liora title must contain LAIOR Benchmarks.', failures);
  collectCheck(hasRoute(html, LIORA_URL, /^\/$/), 'Liora must link to homepage.', failures);
  collectCheck(hasRoute(html, LIORA_URL, /^\/scportal$/), 'Liora must link to SCPortal.', failures);
  collectCheck(allRoutesPresent(routes), 'Liora must link to model, dataset, and metric routes.', failures);
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

  collectCheck(/https:\/\/peterponyu\.github\.io\/(?![A-Za-z0-9_-])/i.test(markdown), 'Profile README must link to the canonical homepage.', failures);
  collectCheck(/current focus/i.test(markdown) && /ai agent harnesses/i.test(markdown), 'Profile README must state the current AI-agent focus.', failures);
  collectCheck(/##\s+Academic Proofs:\s+Selected Publications/i.test(markdown), 'Profile README must keep the selected publications section.', failures);
  collectCheck(
    /10\.1016\/j\.bspc\.2026\.110376/i.test(markdown) && /https:\/\/github\.com\/PeterPonyu\/MCCVAE/i.test(markdown),
    'Profile README must promote the published MCCVAE paper and repository.',
    failures,
  );
  collectCheck(/\*\*Public identity:\*\*/i.test(markdown) && /ORCID/i.test(markdown) && /Scopus/i.test(markdown), 'Profile README must keep public identity links.', failures);
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
