#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNegativeFixtureChecks } from './frontend_quality_fixtures.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const reportsRoot = path.join(root, '.omx/reports');
const publicGraphScript = path.join(root, '.omx/scripts/check_frontend_public_graph.mjs');

const SURFACES = {
  homepage: {
    label: 'Homepage',
    url: 'https://peterponyu.github.io/',
    screenshotBase: 'homepage',
  },
  scportal: {
    label: 'SCPortal',
    url: 'https://peterponyu.github.io/scportal/',
    screenshotBase: 'scportal',
  },
  liora: {
    label: 'Liora UI',
    url: 'https://peterponyu.github.io/liora-ui/',
    screenshotBase: 'liora',
  },
};

const VIEWPORTS = {
  desktop: { width: 1440, height: 1200 },
  mobile: { width: 390, height: 1400 },
};

const CHECK_STATUS = {
  pass: 'pass',
  fail: 'fail',
  info: 'info',
};

const args = new Set(process.argv.slice(2));
const runFixtureSelfTest = args.has('--fixture-self-test') || args.has('--self-test');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const writeText = (filePath, content) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
};
const relativePath = (filePath) => path.relative(root, filePath).split(path.sep).join('/');
const timestampForDirectory = (date = new Date()) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const stripHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const stripTags = (html) =>
  stripHtmlComments(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rarr;|&#x2192;|&RightArrow;/gi, '→')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const normalizeVisibleText = (html) => stripTags(html).toLowerCase();

const getTitle = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : '';
};

const getLinkHref = (html, rel) => {
  const linkPattern = new RegExp(`<link\\b(?=[^>]*\\brel=["'][^"']*${rel}[^"']*["'])([^>]*)>`, 'i');
  const link = html.match(linkPattern);
  return link?.[1]?.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? '';
};

const getMetaContent = (html, attrName, attrValue) => {
  const metaPattern = new RegExp(`<meta\\b(?=[^>]*\\b${attrName}=["']${attrValue}["'])([^>]*)>`, 'i');
  const meta = html.match(metaPattern);
  return meta?.[1]?.match(/\bcontent=["']([^"']+)["']/i)?.[1] ?? '';
};

const hrefExists = (html, expected) => {
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\bhref=["'][^"']*${escaped}[^"']*["']`, 'i').test(html) || html.includes(expected);
};

const extractSectionById = (html, id) => {
  const marker = html.search(new RegExp(`<section\\b[^>]*\\bid=["']${id}["']`, 'i'));
  if (marker < 0) return '';
  const close = html.indexOf('</section>', marker);
  if (close < 0) return '';
  return html.slice(marker, close + '</section>'.length);
};

const findEnclosingTag = (html, markerIndex, tagName) => {
  if (markerIndex < 0) return '';
  const before = html.slice(0, markerIndex);
  const open = before.lastIndexOf(`<${tagName}`);
  if (open < 0) return '';
  const close = html.indexOf(`</${tagName}>`, markerIndex);
  if (close < 0) return '';
  return html.slice(open, close + tagName.length + 3);
};

const countClassElements = (html, className) => {
  const classAttr = /<[^>]+\bclass=["']([^"']+)["'][^>]*>/gi;
  let count = 0;
  let match;
  while ((match = classAttr.exec(html)) !== null) {
    const classes = match[1].split(/\s+/);
    if (classes.includes(className)) count += 1;
  }
  return count;
};

const countElementsWithClasses = (html, requiredClasses) => {
  const classAttr = /<[^>]+\bclass=["']([^"']+)["'][^>]*>/gi;
  let count = 0;
  let match;
  while ((match = classAttr.exec(html)) !== null) {
    const classes = new Set(match[1].split(/\s+/));
    if (requiredClasses.every((className) => classes.has(className))) count += 1;
  }
  return count;
};

const countForLabel = (html, label) => {
  const withoutComments = stripHtmlComments(html);
  const patterns = [
    new RegExp(`>\\s*(\\d+)\\s*<[^>]+>\\s*${label}\\b`, 'i'),
    new RegExp(`(\\d+)\\s+${label}\\b`, 'i'),
    new RegExp(`${label}\\D{0,80}(\\d+)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = withoutComments.match(pattern);
    if (match) return Number.parseInt(match[1], 10);
  }
  return 0;
};

const recordCheck = (checks, condition, name, details = undefined) => {
  checks.push({ name, status: condition ? CHECK_STATUS.pass : CHECK_STATUS.fail, ...(details === undefined ? {} : { details }) });
  return condition;
};

const recordInfo = (checks, name, details) => {
  checks.push({ name, status: CHECK_STATUS.info, details });
};

const runCommand = (command, argsForCommand, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, argsForCommand, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
    child.on('error', (error) => resolve({ status: 127, signal: null, stdout, stderr: String(error) }));
  });

const findChrome = () => {
  const candidates = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) {
      return { command: candidate, version: (result.stdout || result.stderr || '').trim() };
    }
  }
  return null;
};

const fetchSurface = async (surfaceKey, surface, reportDir) => {
  const url = `${surface.url}${surface.url.includes('?') ? '&' : '?'}v=frontend-quality-${Date.now()}-${surfaceKey}`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'frontend-quality-v1/1.0 (+https://peterponyu.github.io/)' },
  });
  const html = await response.text();
  const headers = Object.fromEntries(response.headers.entries());
  const htmlPath = path.join(reportDir, `${surface.screenshotBase}.html`);
  writeText(htmlPath, html);
  return { surfaceKey, status: response.status, url: response.url, requestedUrl: surface.url, headers, html, htmlPath };
};

const checkCanonicalOrOg = (html, expectedUrl) => {
  const canonical = getLinkHref(html, 'canonical');
  const ogUrl = getMetaContent(html, 'property', 'og:url');
  return { canonical, ogUrl, ok: canonical === expectedUrl || ogUrl === expectedUrl };
};

const checkHomepage = ({ html, status, headers }) => {
  const checks = [];
  const title = getTitle(html);
  const canonical = getLinkHref(html, 'canonical');
  const appsSection = extractSectionById(html, 'apps');
  const routingAside = findEnclosingTag(appsSection, appsSection.indexOf('route-step compact'), 'aside');
  const boundaryNoteCount = countClassElements(appsSection, 'boundary-note');
  const compactRouteStepCount = countElementsWithClasses(routingAside, ['route-step', 'compact']);
  const appsText = normalizeVisibleText(appsSection);
  const asideText = normalizeVisibleText(routingAside);

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, title.includes('Zeyu Fu'), 'title_contains_zeyu_fu', { title });
  recordCheck(checks, canonical === SURFACES.homepage.url, 'canonical_url', { canonical });
  recordCheck(checks, html.includes('https://peterponyu.github.io/scportal/') || html.includes('/scportal/'), 'contains_scportal_route');
  recordCheck(checks, html.includes('https://peterponyu.github.io/liora-ui/') || html.includes('/liora-ui/'), 'contains_liora_route');
  recordCheck(checks, compactRouteStepCount === 3, 'apps_routing_aside_has_exactly_3_compact_route_steps', { compactRouteStepCount });
  recordCheck(checks, !asideText.includes('also in the public graph'), 'also_in_public_graph_outside_routing_aside');
  recordCheck(checks, !asideText.includes('hidden by design'), 'hidden_by_design_outside_routing_aside');
  recordCheck(checks, boundaryNoteCount === 2, 'exactly_2_boundary_notes_in_apps_section', { boundaryNoteCount });
  recordCheck(checks, !appsText.includes('iaode workspace'), 'iaode_workspace_not_visible_homepage_app_destination');
  recordCheck(checks, !appsText.includes('mccvae'), 'mccvae_not_visible_live_hosted_app_destination');
  recordInfo(checks, 'headers', {
    lastModified: headers['last-modified'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
  });

  return { title, canonical, checks };
};

const checkScportal = ({ html, status, headers }) => {
  const checks = [];
  const title = getTitle(html);
  const { canonical, ogUrl, ok } = checkCanonicalOrOg(html, SURFACES.scportal.url);
  const visibleText = normalizeVisibleText(html);

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, /SCPortal|Discovery Hub/i.test(title), 'title_contains_scportal_or_discovery_hub', { title });
  recordCheck(checks, ok, 'canonical_or_og_url_points_to_scportal', { canonical, ogUrl });
  recordCheck(checks, hrefExists(html, SURFACES.homepage.url), 'contains_homepage_link');
  recordCheck(checks, html.includes(SURFACES.liora.url) || html.includes('/liora-ui/'), 'contains_liora_link');
  recordCheck(checks, visibleText.includes('flagship journey'), 'contains_flagship_journey_marker');
  recordCheck(
    checks,
    (visibleText.includes('route-finding') || visibleText.includes('task-route')) &&
      (html.includes('/scportal/datasets') || html.includes('/scportal/explorer')) &&
      (html.includes('/scportal/benchmarks') || html.includes('metrics library')),
    'contains_task_route_navigator_markers',
  );
  recordCheck(checks, !visibleText.includes('homepage as a discovery hub replacement'), 'does_not_present_homepage_as_discovery_hub_replacement');
  recordInfo(checks, 'headers', {
    lastModified: headers['last-modified'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
  });

  return { title, canonical, ogUrl, checks };
};

const checkLiora = ({ html, status, headers }) => {
  const checks = [];
  const title = getTitle(html);
  const { canonical, ogUrl, ok } = checkCanonicalOrOg(html, SURFACES.liora.url);
  const visibleText = normalizeVisibleText(html);
  const counts = {
    models: countForLabel(html, 'Models'),
    datasets: countForLabel(html, 'Datasets'),
    metrics: countForLabel(html, 'Metrics'),
  };

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, title.includes('LAIOR Benchmarks'), 'title_contains_laior_benchmarks', { title });
  recordCheck(checks, ok, 'canonical_or_og_url_points_to_liora_ui', { canonical, ogUrl });
  recordCheck(checks, hrefExists(html, SURFACES.homepage.url), 'contains_homepage_link');
  recordCheck(checks, html.includes(SURFACES.scportal.url) || html.includes('/scportal/'), 'contains_scportal_link');
  recordCheck(checks, visibleText.includes('identity → discovery → benchmark proof') || visibleText.includes('identity') && visibleText.includes('discovery') && visibleText.includes('benchmark proof'), 'contains_identity_discovery_benchmark_proof_marker');
  recordCheck(checks, counts.models > 0 && counts.datasets > 0 && counts.metrics > 0, 'rendered_model_dataset_metric_counts_nonzero', counts);
  recordCheck(checks, !/general ecosystem discovery hub/i.test(visibleText) && !/general hub/i.test(visibleText), 'does_not_present_liora_as_general_ecosystem_hub');
  recordInfo(checks, 'headers', {
    lastModified: headers['last-modified'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
  });

  return { title, canonical, ogUrl, counts, checks };
};

const checkerBySurface = {
  homepage: checkHomepage,
  scportal: checkScportal,
  liora: checkLiora,
};

const captureScreenshot = async ({ chrome, surfaceKey, surface, viewportName, viewport, reportDir }) => {
  const screenshotFile = path.join(reportDir, `${surface.screenshotBase}-${viewportName}.png`);
  const argsForChrome = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000',
    `--window-size=${viewport.width},${viewport.height}`,
    `--screenshot=${screenshotFile}`,
    surface.url,
  ];
  const result = await runCommand(chrome.command, argsForChrome);
  const exists = fs.existsSync(screenshotFile);
  const bytes = exists ? fs.statSync(screenshotFile).size : 0;
  return {
    surface: surfaceKey,
    viewport: viewportName,
    width: viewport.width,
    height: viewport.height,
    path: relativePath(screenshotFile),
    ok: result.status === 0 && bytes > 0,
    bytes,
    command: `${chrome.command} ${argsForChrome.join(' ')}`,
    stderr: result.stderr.trim().slice(0, 2000),
  };
};

const dumpDom = async ({ chrome, surfaceKey, surface, reportDir }) => {
  const domFile = path.join(reportDir, `${surface.screenshotBase}-dom.html`);
  const argsForChrome = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--dump-dom',
    '--virtual-time-budget=5000',
    `--window-size=${VIEWPORTS.desktop.width},${VIEWPORTS.desktop.height}`,
    surface.url,
  ];
  const result = await runCommand(chrome.command, argsForChrome);
  if (result.stdout) writeText(domFile, result.stdout);
  return {
    surface: surfaceKey,
    path: relativePath(domFile),
    ok: result.status === 0 && fs.existsSync(domFile) && fs.statSync(domFile).size > 0,
    bytes: fs.existsSync(domFile) ? fs.statSync(domFile).size : 0,
    command: `${chrome.command} ${argsForChrome.join(' ')}`,
    stderr: result.stderr.trim().slice(0, 2000),
  };
};

const geometryForHomepage = (html) => {
  const apps = extractSectionById(html, 'apps');
  const aside = findEnclosingTag(apps, apps.indexOf('route-step compact'), 'aside');
  return {
    routeSteps: countElementsWithClasses(aside, ['route-step', 'compact']),
    boundaryNotes: countClassElements(apps, 'boundary-note'),
    asideContainsAlso: normalizeVisibleText(aside).includes('also in the public graph'),
    asideContainsHidden: normalizeVisibleText(aside).includes('hidden by design'),
  };
};

const geometryForScportal = (html) => ({
  containsJourney: normalizeVisibleText(html).includes('flagship journey'),
  containsTaskRoute: normalizeVisibleText(html).includes('route-finding') || normalizeVisibleText(html).includes('task-route'),
  hasHomepageLink: hrefExists(html, SURFACES.homepage.url),
  hasLioraLink: html.includes(SURFACES.liora.url) || html.includes('/liora-ui/'),
});

const geometryForLiora = (html) => ({
  containsJourney: normalizeVisibleText(html).includes('identity → discovery → benchmark proof') || normalizeVisibleText(html).includes('benchmark proof'),
  counts: {
    models: countForLabel(html, 'Models'),
    datasets: countForLabel(html, 'Datasets'),
    metrics: countForLabel(html, 'Metrics'),
  },
  hasHomepageLink: hrefExists(html, SURFACES.homepage.url),
  hasScportalLink: html.includes(SURFACES.scportal.url) || html.includes('/scportal/'),
});

const geometryBySurface = {
  homepage: geometryForHomepage,
  scportal: geometryForScportal,
  liora: geometryForLiora,
};

const runPublicGraphAudit = async () => {
  const result = await runCommand(process.execPath, [publicGraphScript]);
  return {
    ok: result.status === 0,
    command: `node ${relativePath(publicGraphScript)}`,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
};

const buildSummaryMarkdown = ({ timestamp, reportDir, chrome, publicGraphAudit, surfaces, screenshots, failures }) => {
  const lines = [
    '# Frontend Quality V1 Report',
    '',
    `- Timestamp: \`${timestamp}\``,
    `- Overall: **${failures.length === 0 ? 'PASS' : 'FAIL'}**`,
    `- Report directory: \`${relativePath(reportDir)}\``,
    `- Chrome: \`${chrome?.version ?? 'not-found'}\``,
    `- Public graph audit: **${publicGraphAudit.ok ? 'PASS' : 'FAIL'}**`,
    '',
    '## Surfaces',
    '',
    '| Surface | URL | Title | Result | HTML | DOM dump | Geometry |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const [surfaceKey, result] of Object.entries(surfaces)) {
    const allChecksPass = result.checks.every((check) => check.status !== CHECK_STATUS.fail);
    lines.push(
      `| ${surfaceKey} | ${result.requestedUrl} | ${result.title.replaceAll('|', '\\|')} | ${allChecksPass ? 'PASS' : 'FAIL'} | \`${relativePath(result.htmlPath)}\` | \`${relativePath(result.domDump.path)}\` | desktop: ${relativePath(result.geometry.desktop.path)}<br>mobile: ${relativePath(result.geometry.mobile.path)} |`,
    );
  }

  lines.push('', '## Checks', '');
  for (const [surfaceKey, result] of Object.entries(surfaces)) {
    lines.push(`### ${surfaceKey}`, '');
    for (const check of result.checks) {
      const prefix = check.status === CHECK_STATUS.pass ? '✅' : check.status === CHECK_STATUS.fail ? '❌' : 'ℹ️';
      lines.push(`- ${prefix} \`${check.name}\`${check.details ? ` — \`${JSON.stringify(check.details)}\`` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Screenshots', '');
  for (const screenshot of screenshots) {
    lines.push(`- ${screenshot.ok ? '✅' : '❌'} \`${screenshot.surface}-${screenshot.viewport}\` (${screenshot.width}x${screenshot.height}, ${screenshot.bytes} bytes): \`${screenshot.path}\``);
  }

  lines.push('', '## Failures', '');
  if (failures.length === 0) {
    lines.push('- None.');
  } else {
    for (const failure of failures) lines.push(`- ${failure}`);
  }

  lines.push('', '## Chrome command conventions', '');
  lines.push('- Uses installed Chrome/Chromium directly; V1 intentionally does not add Playwright.');
  lines.push('- Desktop screenshots use `1440x1200`.');
  lines.push('- Mobile screenshots use `390x1400`.');

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  ensureDir(reportsRoot);
  const timestamp = timestampForDirectory();
  const reportDir = path.join(reportsRoot, `frontend-quality-${timestamp}`);
  ensureDir(reportDir);

  if (runFixtureSelfTest) {
    const fixtureResults = runNegativeFixtureChecks();
    const result = {
      ok: fixtureResults.ok,
      timestamp,
      mode: 'fixture-self-test',
      reportDir: relativePath(reportDir),
      failures: fixtureResults.failures,
      cases: fixtureResults.cases,
    };
    writeText(path.join(reportDir, 'result.json'), JSON.stringify(result, null, 2));
    writeText(
      path.join(reportDir, 'summary.md'),
      [
        '# Frontend Quality Fixture Self-Test',
        '',
        `- Timestamp: \`${timestamp}\``,
        `- Overall: **${fixtureResults.ok ? 'PASS' : 'FAIL'}**`,
        '',
        '## Cases',
        '',
        ...fixtureResults.cases.map((fixtureCase) => `- ${fixtureCase.ok ? '✅' : '❌'} \`${fixtureCase.id}\``),
      ].join('\n'),
    );
    if (!fixtureResults.ok) {
      console.error(JSON.stringify(fixtureResults.failures, null, 2));
      process.exit(1);
    }
    console.log('Frontend quality fixture self-test passed.');
    return;
  }

  const chrome = findChrome();
  if (!chrome) {
    throw new Error('No Chrome/Chromium executable found for screenshot capture.');
  }

  const publicGraphAudit = await runPublicGraphAudit();

  const fetchResults = Object.fromEntries(
    await Promise.all(
      Object.entries(SURFACES).map(async ([surfaceKey, surface]) => [surfaceKey, await fetchSurface(surfaceKey, surface, reportDir)]),
    ),
  );

  const surfaces = {};
  const failures = [];

  for (const [surfaceKey, fetchResult] of Object.entries(fetchResults)) {
    const checker = checkerBySurface[surfaceKey];
    const checked = checker(fetchResult);
    const domDump = await dumpDom({ chrome, surfaceKey, surface: SURFACES[surfaceKey], reportDir });
    const desktopGeometry = geometryBySurface[surfaceKey](domDump.ok ? fs.readFileSync(path.join(root, domDump.path), 'utf8') : fetchResult.html);
    const mobileGeometry = desktopGeometry;
    const desktopGeometryPath = path.join(reportDir, `${SURFACES[surfaceKey].screenshotBase}-desktop-geometry.json`);
    const mobileGeometryPath = path.join(reportDir, `${SURFACES[surfaceKey].screenshotBase}-mobile-geometry.json`);
    writeText(desktopGeometryPath, JSON.stringify(desktopGeometry, null, 2));
    writeText(mobileGeometryPath, JSON.stringify(mobileGeometry, null, 2));

    const checks = [...checked.checks];
    if (!publicGraphAudit.ok) {
      checks.push({ name: 'public_graph_audit', status: CHECK_STATUS.fail, details: publicGraphAudit.stderr || publicGraphAudit.stdout });
    } else {
      checks.push({ name: 'public_graph_audit', status: CHECK_STATUS.pass });
    }
    if (!domDump.ok) {
      checks.push({ name: 'dom_dump_available', status: CHECK_STATUS.fail, details: domDump.stderr });
    } else {
      checks.push({ name: 'dom_dump_available', status: CHECK_STATUS.pass, details: { path: domDump.path } });
    }

    surfaces[surfaceKey] = {
      ...fetchResult,
      ...checked,
      checks,
      domDump,
      geometry: {
        desktop: { path: relativePath(desktopGeometryPath), ...desktopGeometry },
        mobile: { path: relativePath(mobileGeometryPath), ...mobileGeometry },
      },
    };

    for (const check of checks) {
      if (check.status === CHECK_STATUS.fail) {
        failures.push(`${surfaceKey}: ${check.name}`);
      }
    }
  }

  const screenshots = [];
  for (const [surfaceKey, surface] of Object.entries(SURFACES)) {
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      screenshots.push(await captureScreenshot({ chrome, surfaceKey, surface, viewportName, viewport, reportDir }));
    }
  }

  for (const screenshot of screenshots) {
    if (!screenshot.ok) failures.push(`${screenshot.surface}-${screenshot.viewport}: screenshot`);
  }

  const result = {
    ok: failures.length === 0,
    timestamp,
    reportDir: relativePath(reportDir),
    chrome: chrome.version,
    publicGraph: publicGraphAudit.ok,
    surfaces: Object.fromEntries(
      Object.entries(surfaces).map(([surfaceKey, surface]) => [
        surfaceKey,
        {
          ok: surface.checks.every((check) => check.status !== CHECK_STATUS.fail),
          url: surface.requestedUrl,
          title: surface.title,
          htmlPath: relativePath(surface.htmlPath),
          domDumpPath: surface.domDump.path,
          geometry: surface.geometry,
          checks: surface.checks,
        },
      ]),
    ),
    screenshots,
    failures,
  };

  writeText(path.join(reportDir, 'result.json'), JSON.stringify(result, null, 2));
  writeText(path.join(reportDir, 'summary.md'), buildSummaryMarkdown({ timestamp, reportDir, chrome, publicGraphAudit, surfaces, screenshots, failures }));

  if (failures.length > 0) {
    console.error(`Frontend quality gate failed with ${failures.length} failure(s).`);
    process.exit(1);
  }

  console.log('Frontend quality gate passed.');
};

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
