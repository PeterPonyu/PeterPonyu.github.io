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

function textIncludes(html, text) {
  return stripTags(html).toLowerCase().includes(text.toLowerCase());
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

export function validateFlagshipHtmlFixtures(fixtures) {
  const checks = {
    homepage: validateHomepageFixture(fixtures.homepage),
    scportal: validateScportalFixture(fixtures.scportal),
    liora: validateLioraFixture(fixtures.liora),
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
