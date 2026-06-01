#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runNegativeFixtureChecks,
  validateIaodePublicFixture,
  validateIaodeReadmeFixture,
  validateMccvaeFixture,
  validateMrnaReadmeFixture,
  validateProfileReadmeFixture,
} from './frontend_quality_fixtures.mjs';

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
  mccvae: {
    label: 'MCCVAE',
    url: 'https://peterponyu.github.io/MCCVAE/',
    screenshotBase: 'mccvae',
  },
  iaode: {
    label: 'iAODE',
    url: 'https://peterponyu.github.io/iAODE/',
    screenshotBase: 'iaode',
  },
};

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

const V2A_SURFACES = {
  profile: {
    label: 'Profile README',
    sources: {
      readme: {
        label: 'README',
        url: 'https://raw.githubusercontent.com/PeterPonyu/PeterPonyu/main/README.md',
        githubApiUrl: 'https://api.github.com/repos/PeterPonyu/PeterPonyu/readme?ref=main',
        localPath: path.resolve(root, '../PeterPonyu-profile/README.md'),
        preferLocal: false,
        fileName: 'profile-readme.md',
      },
    },
  },
  mrna: {
    label: 'mRNA Intersection',
    sources: {
      readme: {
        label: 'README',
        url: 'https://raw.githubusercontent.com/PeterPonyu/mrnapp-intersection/main/README.md',
        githubApiUrl: 'https://api.github.com/repos/PeterPonyu/mrnapp-intersection/readme?ref=main',
        localPath: path.resolve(root, '../peterponyu-readme-audit/mrnapp-intersection/README.md'),
        preferLocal: false,
        fileName: 'mrna-intersection-readme.md',
      },
    },
  },
  mccvae: {
    label: 'MCCVAE landing-only',
    sources: {
      page: {
        label: 'Landing page',
        url: 'https://peterponyu.github.io/MCCVAE/',
        localPath: path.resolve(root, '../ui-phase23/MCCVAE/out/index.html'),
        fileName: 'mccvae.html',
        cacheBust: true,
      },
    },
  },
  iaode: {
    label: 'iAODE public/local-first boundary',
    sources: {
      page: {
        label: 'Public page',
        url: 'https://peterponyu.github.io/iAODE/',
        fileName: 'iaode-public.html',
        cacheBust: true,
      },
      readme: {
        label: 'README',
        url: 'https://raw.githubusercontent.com/PeterPonyu/iAODE/main/README.md',
        githubApiUrl: 'https://api.github.com/repos/PeterPonyu/iAODE/readme?ref=main',
        localPath: path.resolve(root, '../ui-phase23/iAODE/README.md'),
        fileName: 'iaode-readme.md',
      },
    },
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

const hrefMatches = (html, pattern) => [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].some((match) => pattern.test(match[1]));

const hrefPaths = (html, baseUrl) =>
  [...html.matchAll(/\bhref=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        const pathname = new URL(match[1], baseUrl).pathname.replace(/\/+$/g, '');
        return pathname || '/';
      } catch {
        return '';
      }
    })
    .filter(Boolean);

const routePresence = (html, baseUrl, patterns) => {
  const paths = hrefPaths(html, baseUrl);
  return Object.fromEntries(Object.entries(patterns).map(([name, pattern]) => [name, paths.some((hrefPath) => pattern.test(hrefPath))]));
};

const allRoutesPresent = (presence) => Object.values(presence).every(Boolean);
const visibleTextIncludesAny = (visibleText, phrases) => phrases.some((phrase) => visibleText.includes(phrase));
const stripNonVisibleBlocks = (html) => stripHtmlComments(html).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
const normalizePlainText = (value) => stripNonVisibleBlocks(value).replace(/<[^>]+>/g, ' ').replace(/&rarr;|&#x2192;|&RightArrow;/gi, '→').replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

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
  const visibleHtml = stripNonVisibleBlocks(html);
  const dataCount = visibleHtml.match(new RegExp(`data-quality-count=["']${label.toLowerCase()}["'][^>]*>\\s*([0-9,]+)`, 'i'));
  if (dataCount) return Number.parseInt(dataCount[1].replaceAll(',', ''), 10);

  const visibleText = normalizePlainText(visibleHtml);
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`\\b([0-9][0-9,]*)\\s+${escapedLabel}\\b`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = visibleText.match(pattern);
    if (match) return Number.parseInt(match[1].replaceAll(',', ''), 10);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options, { attempts = 2, timeoutMs = 30_000 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(750 * attempt);
    }
  }
  throw lastError;
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
  const response = await fetchWithRetry(url, {
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
  const routingAside = findEnclosingTag(appsSection, appsSection.indexOf('What you will find here'), 'aside');
  const quickGuideBadgeCount = countClassElements(routingAside, 'badge');
  const appsText = normalizeVisibleText(appsSection);
  const asideText = normalizeVisibleText(routingAside);
  const hasCurrentToolGroups = ['start here', 'benchmark and companion pages', 'more linked pages'].every((label) => appsText.includes(label));

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, title.includes('Zeyu Fu'), 'title_contains_zeyu_fu', { title });
  recordCheck(checks, canonical === SURFACES.homepage.url, 'canonical_url', { canonical });
  recordCheck(checks, html.includes('https://peterponyu.github.io/scportal/') || html.includes('/scportal/'), 'contains_scportal_route');
  recordCheck(checks, html.includes('https://peterponyu.github.io/liora-ui/') || html.includes('/liora-ui/'), 'contains_liora_route');
  recordCheck(checks, Boolean(routingAside), 'apps_contains_quick_guide_aside');
  recordCheck(checks, quickGuideBadgeCount >= 4, 'apps_quick_guide_has_at_least_4_badges', { quickGuideBadgeCount });
  recordCheck(checks, hasCurrentToolGroups, 'apps_contains_current_tool_group_headings');
  recordCheck(checks, !appsText.includes('also in the public graph') && !appsText.includes('hidden by design'), 'retired_public_graph_boundary_copy_absent');
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
  const routes = routePresence(html, SURFACES.scportal.url, SCPORTAL_PUBLIC_ROUTE_PATTERNS);

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, /SCPortal|Discovery Hub/i.test(title), 'title_contains_scportal_or_discovery_hub', { title });
  recordCheck(checks, ok, 'canonical_or_og_url_points_to_scportal', { canonical, ogUrl });
  recordCheck(checks, hrefExists(html, SURFACES.homepage.url), 'contains_homepage_link');
  recordCheck(checks, html.includes(SURFACES.liora.url) || html.includes('/liora-ui/'), 'contains_liora_link');
  recordCheck(checks, allRoutesPresent(routes), 'contains_scportal_public_task_routes', routes);
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
  const routes = routePresence(html, SURFACES.liora.url, LIORA_PUBLIC_ROUTE_PATTERNS);
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
  recordCheck(checks, allRoutesPresent(routes), 'contains_liora_model_dataset_metric_routes', routes);
  recordCheck(checks, counts.models > 0 && counts.datasets > 0 && counts.metrics > 0, 'rendered_model_dataset_metric_counts_nonzero', counts);
  recordCheck(checks, !/general ecosystem discovery hub/i.test(visibleText) && !/general hub/i.test(visibleText), 'does_not_present_liora_as_general_ecosystem_hub');
  recordInfo(checks, 'headers', {
    lastModified: headers['last-modified'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
  });

  return { title, canonical, ogUrl, counts, checks };
};

const checkMccvae = ({ html, status, headers }) => {
  const checks = [];
  const title = getTitle(html);
  const { canonical, ogUrl, ok } = checkCanonicalOrOg(html, SURFACES.mccvae.url);
  const robots = getMetaContent(html, 'name', 'robots');
  const visibleText = normalizeVisibleText(html);
  const promotedLiveAppRoutes = hrefMatches(html, /\/MCCVAE\/(?:datasets|models|metrics|explorer)(?:\/|$)/i);
  const liveAppPromotionCopy = visibleTextIncludesAny(visibleText, [
    'launch app',
    'open app',
    'try the app',
    'explore datasets',
    'launch explorer',
    'start training',
    'training ui',
    'upload data',
  ]);

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, /MCCVAE/i.test(title) && /Landing/i.test(title), 'title_contains_mccvae_landing', { title });
  recordCheck(checks, ok, 'canonical_or_og_url_points_to_mccvae', { canonical, ogUrl });
  recordCheck(checks, robots.toLowerCase().includes('noindex'), 'robots_noindex_landing_page', { robots });
  recordCheck(checks, hrefExists(html, SURFACES.homepage.url), 'contains_homepage_link');
  recordCheck(checks, html.includes(SURFACES.scportal.url) || html.includes('/scportal/'), 'contains_scportal_link');
  recordCheck(checks, html.includes('https://github.com/PeterPonyu/MCCVAE'), 'contains_mccvae_source_link');
  recordCheck(checks, visibleText.includes('landing-only') || visibleText.includes('landing only'), 'contains_landing_only_language');
  recordCheck(checks, visibleText.includes('local-first'), 'contains_local_first_boundary_language');
  recordCheck(checks, visibleText.includes('not exposed here as a public app') || visibleText.includes('instead of presenting the operational training interface as a public app'), 'states_operational_interface_not_public_app');
  recordCheck(checks, !promotedLiveAppRoutes, 'does_not_link_live_mccvae_app_routes');
  recordCheck(checks, !liveAppPromotionCopy, 'does_not_use_live_app_promotion_copy');
  recordInfo(checks, 'headers', {
    lastModified: headers['last-modified'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
  });

  return { title, canonical, ogUrl, robots, checks };
};

const checkIaode = ({ html, status, headers }) => {
  const checks = [];
  const title = getTitle(html);
  const visibleText = normalizeVisibleText(html);
  const localWorkspacePromotion = visibleTextIncludesAny(visibleText, [
    'training ui',
    'localhost',
    'start_training_ui',
    'start training ui',
    'local workspace',
    'workspace ui',
    'upload your data',
    'monitor training progress',
  ]);

  recordCheck(checks, status === 200, 'http_200', { status });
  recordCheck(checks, /iAODE/i.test(title), 'title_contains_iaode', { title });
  recordCheck(checks, visibleText.includes('interpretable accessibility ode'), 'contains_project_name_expansion');
  recordCheck(checks, visibleText.includes('dataset browser'), 'contains_dataset_browser_public_card');
  recordCheck(checks, visibleText.includes('continuity explorer'), 'contains_continuity_explorer_public_card');
  recordCheck(checks, hrefMatches(html, /(?:^|\/)datasets\/?$/i), 'contains_public_datasets_route');
  recordCheck(checks, hrefMatches(html, /(?:^|\/)explorer\/?$/i), 'contains_public_explorer_route');
  recordCheck(checks, html.includes('https://github.com/PeterPonyu/iAODE'), 'contains_iaode_repository_link');
  recordCheck(checks, !localWorkspacePromotion, 'does_not_promote_local_workspace_or_training_ui');
  recordInfo(checks, 'headers', {
    lastModified: headers['last-modified'] ?? null,
    cacheControl: headers['cache-control'] ?? null,
  });

  return { title, checks };
};

const slugCheckName = (message) =>
  message
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'contract_failure';

const sourceUrlWithCacheBust = (source, surfaceKey, sourceKey) => {
  if (!source.cacheBust) return source.url;
  const separator = source.url.includes('?') ? '&' : '?';
  return `${source.url}${separator}v=frontend-quality-v2a-${Date.now()}-${surfaceKey}-${sourceKey}`;
};

const fetchV2ASource = async (surfaceKey, sourceKey, source, reportDir) => {
  let status = null;
  let finalUrl = source.url;
  let headers = {};
  let text = '';
  let origin = 'remote';
  let error = null;

  if (source.preferLocal !== false && source.localPath && fs.existsSync(source.localPath)) {
    origin = 'local';
    finalUrl = source.localPath;
    text = fs.readFileSync(source.localPath, 'utf8');
  } else {
    const remoteAttempts = [
      { url: sourceUrlWithCacheBust(source, surfaceKey, sourceKey), transform: 'text' },
      ...(source.githubApiUrl ? [{ url: source.githubApiUrl, transform: 'githubContentsBase64' }] : []),
    ];
    for (const attempt of remoteAttempts) {
      try {
        const response = await fetchWithRetry(attempt.url, {
          redirect: 'follow',
          headers: { 'user-agent': 'frontend-quality-v2a/1.0 (+https://peterponyu.github.io/)' },
        });
        status = response.status;
        finalUrl = response.url;
        headers = Object.fromEntries(response.headers.entries());
        if (response.status !== 200) throw new Error(`HTTP ${response.status} fetching ${attempt.url}`);
        if (attempt.transform === 'githubContentsBase64') {
          const payload = await response.json();
          text = Buffer.from(String(payload.content ?? '').replace(/\s+/g, ''), 'base64').toString('utf8');
        } else {
          text = await response.text();
        }
        error = null;
        break;
      } catch (fetchError) {
        error = fetchError.stack || String(fetchError);
      }
    }
  }

  const outputPath = path.join(reportDir, source.fileName);
  writeText(outputPath, text);
  return {
    key: sourceKey,
    label: source.label,
    origin,
    status,
    url: source.url,
    finalUrl,
    localPath: source.localPath ?? null,
    path: relativePath(outputPath),
    bytes: Buffer.byteLength(text),
    headers,
    text,
    error,
    available: !error && text.length > 0 && (origin === 'local' || status === 200),
  };
};

const validationChecks = (messages) => {
  if (messages.length === 0) {
    return [{ name: 'v2a_contract_checks', status: CHECK_STATUS.pass }];
  }
  return messages.map((message) => ({
    name: slugCheckName(message),
    status: CHECK_STATUS.fail,
    details: message,
  }));
};

const checkV2ASurface = (surfaceKey, fetchedSources) => {
  const checks = [];
  for (const source of Object.values(fetchedSources)) {
    recordCheck(checks, source.available, `${source.key}_source_available`, {
      origin: source.origin,
      status: source.status,
      path: source.path,
      url: source.url,
      ...(source.error ? { error: source.error } : {}),
    });
  }

  const missingSources = Object.values(fetchedSources).filter((source) => !source.available);
  if (missingSources.length > 0) {
    checks.push({
      name: 'v2a_contract_checks_skipped_source_unavailable',
      status: CHECK_STATUS.info,
      details: missingSources.map((source) => ({ key: source.key, error: source.error ?? null, status: source.status })),
    });
    const primary = fetchedSources.page ?? fetchedSources.readme ?? Object.values(fetchedSources)[0];
    return {
      label: V2A_SURFACES[surfaceKey].label,
      title: primary?.text ? getTitle(primary.text) || V2A_SURFACES[surfaceKey].label : V2A_SURFACES[surfaceKey].label,
      url: primary?.url ?? '',
      sources: Object.fromEntries(
        Object.entries(fetchedSources).map(([sourceKey, source]) => [
          sourceKey,
          {
            label: source.label,
            origin: source.origin,
            status: source.status,
            url: source.url,
            finalUrl: source.finalUrl,
            localPath: source.localPath,
            path: source.path,
            bytes: source.bytes,
            error: source.error,
          },
        ]),
      ),
      checks,
    };
  }

  const validationFailures = [];
  if (surfaceKey === 'profile') {
    const readme = fetchedSources.readme?.text ?? '';
    recordCheck(checks, /https:\/\/peterponyu\.github\.io\/(?![A-Za-z0-9_-])/i.test(readme), 'profile_contains_canonical_homepage_link');
    recordCheck(checks, /current focus/i.test(readme) && /ai agent harnesses/i.test(readme), 'profile_states_current_ai_agent_focus');
    recordCheck(checks, /##\s+Academic Proofs:\s+Selected Publications/i.test(readme), 'profile_contains_selected_publications_section');
    recordCheck(
      checks,
      readme.includes('10.1016/j.bspc.2026.110376') && /https:\/\/github\.com\/PeterPonyu\/MCCVAE/i.test(readme),
      'profile_promotes_published_mccvae_paper_and_repo',
    );
    recordCheck(checks, /\*\*Public identity:\*\*/i.test(readme) && /ORCID/i.test(readme) && /Scopus/i.test(readme), 'profile_contains_public_identity_links');
    validationFailures.push(...validateProfileReadmeFixture(readme));
  } else if (surfaceKey === 'mrna') {
    const readme = fetchedSources.readme?.text ?? '';
    const text = normalizePlainText(readme);
    recordCheck(checks, text.includes('public utility surface'), 'mrna_contains_public_utility_surface_language');
    recordCheck(checks, text.includes('bounded static-export exception'), 'mrna_contains_bounded_static_export_exception_language');
    recordCheck(checks, text.includes('precomputed mrna-seq analysis results'), 'mrna_contains_precomputed_results_language');
    recordCheck(checks, /https:\/\/peterponyu\.github\.io\/(?![A-Za-z0-9_-])/i.test(readme), 'mrna_contains_canonical_homepage_link');
    recordCheck(checks, /https:\/\/peterponyu\.github\.io\/scportal\//i.test(readme), 'mrna_contains_scportal_root_neighbor_link');
    recordCheck(checks, text.includes('canonical discovery/root neighbors'), 'mrna_contains_root_neighbor_language');
    recordCheck(checks, text.includes('public boundary is intentional'), 'mrna_contains_intentional_public_boundary_language');
    recordCheck(checks, !text.includes('root discovery hub'), 'mrna_does_not_claim_root_discovery_hub_role');
    validationFailures.push(...validateMrnaReadmeFixture(readme));
  } else if (surfaceKey === 'mccvae') {
    validationFailures.push(...validateMccvaeFixture(fetchedSources.page?.text ?? ''));
  } else if (surfaceKey === 'iaode') {
    validationFailures.push(...validateIaodePublicFixture(fetchedSources.page?.text ?? ''));
    validationFailures.push(...validateIaodeReadmeFixture(fetchedSources.readme?.text ?? ''));
  }

  checks.push(...validationChecks(validationFailures));
  const primary = fetchedSources.page ?? fetchedSources.readme ?? Object.values(fetchedSources)[0];
  return {
    label: V2A_SURFACES[surfaceKey].label,
    title: primary?.text ? getTitle(primary.text) || V2A_SURFACES[surfaceKey].label : V2A_SURFACES[surfaceKey].label,
    url: primary?.url ?? '',
    sources: Object.fromEntries(
      Object.entries(fetchedSources).map(([sourceKey, source]) => [
        sourceKey,
        {
          label: source.label,
          origin: source.origin,
          status: source.status,
          url: source.url,
          finalUrl: source.finalUrl,
          localPath: source.localPath,
          path: source.path,
          bytes: source.bytes,
          error: source.error,
        },
      ]),
    ),
    checks,
  };
};

const runV2AQualityAudit = async (reportDir) => {
  const results = {};
  for (const [surfaceKey, surface] of Object.entries(V2A_SURFACES)) {
    const fetchedSources = {};
    for (const [sourceKey, source] of Object.entries(surface.sources)) {
      fetchedSources[sourceKey] = await fetchV2ASource(surfaceKey, sourceKey, source, reportDir);
    }
    results[surfaceKey] = checkV2ASurface(surfaceKey, fetchedSources);
  }
  return results;
};

const checkerBySurface = {
  homepage: checkHomepage,
  scportal: checkScportal,
  liora: checkLiora,
  mccvae: checkMccvae,
  iaode: checkIaode,
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
  const aside = findEnclosingTag(apps, apps.indexOf('What you will find here'), 'aside');
  const appsText = normalizeVisibleText(apps);
  return {
    quickGuideBadges: countClassElements(aside, 'badge'),
    hasStartHere: appsText.includes('start here'),
    hasBenchmarkAndCompanionPages: appsText.includes('benchmark and companion pages'),
    hasMoreLinkedPages: appsText.includes('more linked pages'),
  };
};

const geometryForScportal = (html) => ({
  hasHomepageLink: hrefExists(html, SURFACES.homepage.url),
  hasLioraLink: html.includes(SURFACES.liora.url) || html.includes('/liora-ui/'),
  routes: routePresence(html, SURFACES.scportal.url, SCPORTAL_PUBLIC_ROUTE_PATTERNS),
});

const geometryForLiora = (html) => ({
  routes: routePresence(html, SURFACES.liora.url, LIORA_PUBLIC_ROUTE_PATTERNS),
  counts: {
    models: countForLabel(html, 'Models'),
    datasets: countForLabel(html, 'Datasets'),
    metrics: countForLabel(html, 'Metrics'),
  },
  hasHomepageLink: hrefExists(html, SURFACES.homepage.url),
  hasScportalLink: html.includes(SURFACES.scportal.url) || html.includes('/scportal/'),
});

const geometryForMccvae = (html) => {
  const visibleText = normalizeVisibleText(html);
  return {
    containsLandingOnly: visibleText.includes('landing-only') || visibleText.includes('landing only'),
    containsLocalFirst: visibleText.includes('local-first'),
    robotsNoindex: getMetaContent(html, 'name', 'robots').toLowerCase().includes('noindex'),
    hasHomepageLink: hrefExists(html, SURFACES.homepage.url),
    hasScportalLink: html.includes(SURFACES.scportal.url) || html.includes('/scportal/'),
    hasSourceLink: html.includes('https://github.com/PeterPonyu/MCCVAE'),
    promotesLiveAppRoutes: hrefMatches(html, /\/MCCVAE\/(?:datasets|models|metrics|explorer)(?:\/|$)/i),
  };
};

const geometryForIaode = (html) => {
  const visibleText = normalizeVisibleText(html);
  return {
    containsDatasetBrowser: visibleText.includes('dataset browser'),
    containsContinuityExplorer: visibleText.includes('continuity explorer'),
    hasDatasetsRoute: hrefMatches(html, /(?:^|\/)datasets\/?$/i),
    hasExplorerRoute: hrefMatches(html, /(?:^|\/)explorer\/?$/i),
    hasSourceLink: html.includes('https://github.com/PeterPonyu/iAODE'),
    promotesLocalWorkspace: visibleTextIncludesAny(visibleText, [
      'training ui',
      'localhost',
      'start_training_ui',
      'start training ui',
      'local workspace',
      'workspace ui',
    ]),
  };
};

const geometryBySurface = {
  homepage: geometryForHomepage,
  scportal: geometryForScportal,
  liora: geometryForLiora,
  mccvae: geometryForMccvae,
  iaode: geometryForIaode,
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

const buildSummaryMarkdown = ({ timestamp, reportDir, chrome, publicGraphAudit, surfaces, v2aSurfaces, screenshots, failures }) => {
  const lines = [
    '# Frontend Quality V2-A Report',
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

  lines.push('', '## V2-A Cross-Surface Documents', '');
  lines.push('| Surface | URL | Result | Sources |');
  lines.push('| --- | --- | --- | --- |');
  for (const [surfaceKey, result] of Object.entries(v2aSurfaces)) {
    const allChecksPass = result.checks.every((check) => check.status !== CHECK_STATUS.fail);
    const sources = Object.entries(result.sources)
      .map(([sourceKey, source]) => `${sourceKey}: \`${source.path}\` (${source.origin}${source.status === null ? '' : ` ${source.status}`})`)
      .join('<br>');
    lines.push(`| ${surfaceKey} | ${result.url} | ${allChecksPass ? 'PASS' : 'FAIL'} | ${sources} |`);
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

  lines.push('## V2-A Document Checks', '');
  for (const [surfaceKey, result] of Object.entries(v2aSurfaces)) {
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
  lines.push('- Uses installed Chrome/Chromium directly; the gate intentionally does not add Playwright.');
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
  const v2aSurfaces = await runV2AQualityAudit(reportDir);

  const fetchResults = Object.fromEntries(
    await Promise.all(
      Object.entries(SURFACES).map(async ([surfaceKey, surface]) => [surfaceKey, await fetchSurface(surfaceKey, surface, reportDir)]),
    ),
  );

  const surfaces = {};
  const failures = [];

  for (const [surfaceKey, result] of Object.entries(v2aSurfaces)) {
    for (const check of result.checks) {
      if (check.status === CHECK_STATUS.fail) {
        failures.push(`${surfaceKey}: ${check.name}`);
      }
    }
  }

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
    v2aSurfaces: Object.fromEntries(
      Object.entries(v2aSurfaces).map(([surfaceKey, surface]) => [
        surfaceKey,
        {
          ok: surface.checks.every((check) => check.status !== CHECK_STATUS.fail),
          label: surface.label,
          url: surface.url,
          title: surface.title,
          sources: surface.sources,
          checks: surface.checks,
        },
      ]),
    ),
    screenshots,
    failures,
  };

  writeText(path.join(reportDir, 'result.json'), JSON.stringify(result, null, 2));
  writeText(path.join(reportDir, 'summary.md'), buildSummaryMarkdown({ timestamp, reportDir, chrome, publicGraphAudit, surfaces, v2aSurfaces, screenshots, failures }));

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
