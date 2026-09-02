#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const mirrorPath = path.join(repoRoot, 'public-graph.manifest.json');
const homepagePath = path.join(repoRoot, 'index.html');
const sitemapPath = path.join(repoRoot, 'sitemap.xml');

const sourceFlagIndex = process.argv.findIndex((argument) => argument === '--source' || argument.startsWith('--source='));
let sourceValue = null;
if (sourceFlagIndex >= 0) {
  sourceValue = process.argv[sourceFlagIndex].startsWith('--source=')
    ? process.argv[sourceFlagIndex].slice('--source='.length)
    : process.argv[sourceFlagIndex + 1];
  if (!sourceValue || sourceValue.startsWith('--')) {
    throw new Error('Usage: node scripts/sync_public_graph.mjs [--source <manifest.json>]');
  }
}

const sourcePath = sourceValue ? path.resolve(process.cwd(), sourceValue) : mirrorPath;
const manifest = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const requiredMarkers = [
  ['publicationList', '<!-- PUBLICATION_LIST_START -->', '<!-- PUBLICATION_LIST_END -->'],
  ['publicationCount', '<!-- HOMEPAGE_PUBLICATION_COUNT_START -->', '<!-- HOMEPAGE_PUBLICATION_COUNT_END -->'],
  ['softwareCount', '<!-- HOMEPAGE_SOFTWARE_COUNT_START -->', '<!-- HOMEPAGE_SOFTWARE_COUNT_END -->'],
  ['routeCount', '<!-- HOMEPAGE_ROUTE_COUNT_START -->', '<!-- HOMEPAGE_ROUTE_COUNT_END -->'],
  ['routeStrip', '<!-- PUBLIC_GRAPH_ROUTE_STRIP_START -->', '<!-- PUBLIC_GRAPH_ROUTE_STRIP_END -->'],
  ['primary', '<!-- PUBLIC_GRAPH_PRIMARY_START -->', '<!-- PUBLIC_GRAPH_PRIMARY_END -->'],
  ['secondaryCards', '<!-- PUBLIC_GRAPH_SECONDARY_CARDS_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_CARDS_END -->'],
  ['secondary', '<!-- PUBLIC_GRAPH_SECONDARY_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_END -->'],
  ['resources', '<!-- PUBLIC_GRAPH_RESOURCES_START -->', '<!-- PUBLIC_GRAPH_RESOURCES_END -->'],
  ['boundaryNotes', '<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_START -->', '<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_END -->'],
];

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

assert(manifest.version === '2.0', 'Public graph mirror must use manifest version 2.0.');
assert(manifest.graph && typeof manifest.graph === 'object', 'Manifest must contain graph metadata.');
assert(Array.isArray(manifest.sites), 'Manifest must contain a sites array.');
assert(Array.isArray(manifest.resources), 'Manifest must contain a resources array.');

const siteIds = new Set();
for (const site of manifest.sites) {
  assert(typeof site.id === 'string' && site.id.length > 0, 'Each site must define an id.');
  assert(!siteIds.has(site.id), `Duplicate site id ${site.id}.`);
  siteIds.add(site.id);
  assert(typeof site.name === 'string' && site.name.length > 0, `Site ${site.id} must define a name.`);
  assert(['pages', 'workspace'].includes(site.surface_kind), `Site ${site.id} must define surface_kind.`);
  assert(typeof site.surface_group === 'string' && site.surface_group.length > 0, `Site ${site.id} must define surface_group.`);
  assert(['public', 'local_only', 'landing_only'].includes(site.availability), `Site ${site.id} has invalid availability.`);
  assert(site.canonical_url === null || isHttpsUrl(site.canonical_url), `Site ${site.id} needs an https canonical URL or null.`);
  assert(typeof site.source_repo === 'string' && site.source_repo.length > 0, `Site ${site.id} must define source_repo.`);
  assert(site.deploy_repo === null || typeof site.deploy_repo === 'string', `Site ${site.id} has invalid deploy_repo.`);
  assert(site.visibility && typeof site.visibility === 'object', `Site ${site.id} must define visibility.`);
  assert(typeof site.visibility.homepage === 'string', `Site ${site.id} must define visibility.homepage.`);
  assert(typeof site.visibility.sitemap === 'boolean', `Site ${site.id} must define visibility.sitemap.`);
  assert(site.indexing && typeof site.indexing.mode === 'string', `Site ${site.id} must define indexing.mode.`);

  if (site.availability === 'local_only') {
    assert(site.canonical_url === null, `Local-only site ${site.id} must not define canonical_url.`);
    assert(site.visibility.homepage === 'hidden', `Local-only site ${site.id} must stay hidden on the homepage.`);
    assert(site.visibility.sitemap === false, `Local-only site ${site.id} must stay out of the sitemap.`);
    assert(site.indexing.mode === 'noindex_nofollow', `Local-only site ${site.id} must be noindex_nofollow.`);
  }
  if (site.availability === 'landing_only') {
    assert(site.canonical_url !== null, `Landing-only site ${site.id} needs a reference canonical URL.`);
    assert(site.visibility.homepage === 'hidden', `Landing-only site ${site.id} must stay hidden on the homepage.`);
    assert(site.visibility.sitemap === false, `Landing-only site ${site.id} must stay out of the sitemap.`);
    assert(site.indexing.mode === 'noindex_follow', `Landing-only site ${site.id} must be noindex_follow.`);
  }
  if (site.visibility.homepage !== 'hidden') {
    assert(site.availability === 'public', `Visible homepage site ${site.id} must be public.`);
    assert(site.canonical_url !== null, `Visible homepage site ${site.id} needs a canonical URL.`);
    assert(Number.isInteger(site.visibility.homepage_order), `Visible homepage site ${site.id} needs homepage_order.`);
    assert(typeof site.presentation?.homepage?.summary === 'string' && site.presentation.homepage.summary.length > 0,
      `Visible homepage site ${site.id} needs presentation.homepage.summary.`);
    assert(typeof site.presentation?.homepage?.cta_label === 'string' && site.presentation.homepage.cta_label.length > 0,
      `Visible homepage site ${site.id} needs presentation.homepage.cta_label.`);
  }
  if (site.visibility.homepage === 'hidden' && site.availability !== 'public') {
    assert(typeof site.presentation?.homepage?.boundary_note === 'string' && site.presentation.homepage.boundary_note.length > 0,
      `Hidden non-public site ${site.id} needs a boundary_note.`);
  }
  for (const relatedId of site.related_sites ?? []) {
    assert(siteIds.has(relatedId) || manifest.sites.some((candidate) => candidate.id === relatedId),
      `Site ${site.id} references unknown related site ${relatedId}.`);
  }
}

const resourceIds = new Set();
for (const resource of manifest.resources) {
  assert(typeof resource.id === 'string' && resource.id.length > 0, 'Each resource must define an id.');
  assert(!resourceIds.has(resource.id), `Duplicate resource id ${resource.id}.`);
  resourceIds.add(resource.id);
  assert(typeof resource.name === 'string' && resource.name.length > 0, `Resource ${resource.id} must define a name.`);
  assert(resource.availability === 'local_only', `Resource ${resource.id} must be local_only.`);
  assert(resource.runtime_endpoint === null, `Resource ${resource.id} must not expose a runtime endpoint.`);
  assert(typeof resource.public_url === 'string' && isHttpsUrl(resource.public_url), `Resource ${resource.id} needs an https public_url.`);
  assert(!/(localhost|127\.0\.0\.1|file:|\/home\/)/i.test(resource.public_url), `Resource ${resource.id} contains a private URL.`);
  for (const relatedId of resource.related_sites ?? []) {
    assert(siteIds.has(relatedId), `Resource ${resource.id} references unknown site ${relatedId}.`);
  }
}

const visibleSites = manifest.sites
  .filter((site) => site.availability === 'public' && site.visibility.homepage !== 'hidden' && site.canonical_url !== null)
  .sort((a, b) => a.visibility.homepage_order - b.visibility.homepage_order);
const primarySites = visibleSites.filter((site) => site.visibility.homepage === 'primary');
const secondarySites = visibleSites.filter((site) => site.visibility.homepage === 'secondary');
const boundaryNoteSites = manifest.sites.filter(
  (site) => site.visibility.homepage === 'hidden' && site.availability !== 'public',
);
const routeStripSites = [...primarySites, ...secondarySites];

const routeBadgeLabel = (site) => site.visibility.homepage === 'primary' ? 'Primary Route' : 'Secondary Route';
const boundaryLabel = (site) => site.availability === 'local_only' ? 'Local-First' : 'Landing-Only';

const renderRouteCard = (site) => {
  const presentation = site.presentation?.homepage ?? {};
  const kind = presentation.kind ?? site.role;
  const summary = presentation.summary ?? site.name;
  const cta = presentation.cta_label ?? `Open ${site.name}`;
  return `        <a href="${escapeHtml(site.canonical_url)}" target="_blank" rel="noopener noreferrer" class="glass rounded-2xl p-4 block transition-all group">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em]" style="color:var(--text-m)">${escapeHtml(kind)}</span>
            <span class="badge">${escapeHtml(routeBadgeLabel(site))}</span>
          </div>
          <h3 class="mt-3 text-base font-semibold" style="color:var(--text-h)">${escapeHtml(site.name)}</h3>
          <p class="mt-2 text-xs leading-relaxed" style="color:var(--text-m)">${escapeHtml(summary)}</p>
          <span class="mt-3 inline-flex text-xs font-medium" style="color:var(--accent)">${escapeHtml(cta)} &rarr;</span>
        </a>`;
};

const renderPrimaryCard = (site) => {
  const presentation = site.presentation?.homepage ?? {};
  const kind = presentation.kind ?? site.role;
  const badge = presentation.badge ?? 'Entry';
  const summary = presentation.summary ?? site.name;
  const cta = presentation.cta_label ?? `Open ${site.name}`;
  return `              <a href="${escapeHtml(site.canonical_url)}" target="_blank" rel="noopener noreferrer" class="glass rounded-xl p-4 block transition-all group">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold mb-1" style="color:var(--text-h)">${escapeHtml(site.name)} <span class="text-[10px] font-normal" style="color:var(--text-m)">${escapeHtml(kind)}</span></h3>
                  <span class="badge">${escapeHtml(badge)}</span>
                </div>
                <p class="text-xs mb-2" style="color:var(--text-m)">${escapeHtml(summary)}</p>
                <span class="text-xs font-medium" style="color:var(--accent)">${escapeHtml(cta)} &rarr;</span>
              </a>`;
};

const renderSecondaryBadge = (site) =>
  `              <a href="${escapeHtml(site.canonical_url)}" target="_blank" rel="noopener noreferrer" class="badge">${escapeHtml(site.name)}</a>`;

const renderSecondaryCard = (site) => {
  const presentation = site.presentation?.homepage ?? {};
  const kind = presentation.kind ?? site.role;
  const badge = presentation.badge ?? 'Secondary';
  const summary = presentation.summary ?? site.name;
  const cta = presentation.cta_label ?? `Open ${site.name}`;
  return `              <a href="${escapeHtml(site.canonical_url)}" target="_blank" rel="noopener noreferrer" class="glass rounded-xl p-4 block transition-all group">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-sm font-semibold mb-1" style="color:var(--text-h)">${escapeHtml(site.name)}</h3>
                  <span class="badge">${escapeHtml(badge)}</span>
                </div>
                <p class="text-[10px] uppercase tracking-[0.16em] mb-2" style="color:var(--text-m)">${escapeHtml(kind)}</p>
                <p class="text-xs mb-2" style="color:var(--text-m)">${escapeHtml(summary)}</p>
                <span class="text-xs font-medium" style="color:var(--accent)">${escapeHtml(cta)} &rarr;</span>
              </a>`;
};

const renderBoundaryNote = (site) => {
  const label = boundaryLabel(site);
  const note = site.presentation?.homepage?.boundary_note ?? site.name;
  return `              <div class="boundary-note">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge">${escapeHtml(label)}</span>
                  <span class="text-sm font-medium" style="color:var(--text-h)">${escapeHtml(`${label} boundary`)}</span>
                </div>
                <p class="mt-2 text-xs leading-relaxed" style="color:var(--text-m)">${escapeHtml(note)}</p>
              </div>`;
};

const renderResource = (resource) => `            <a href="${escapeHtml(resource.public_url)}" target="_blank" rel="noopener noreferrer" class="glass rounded-2xl p-4 block transition-all group">
              <div class="flex items-center justify-between gap-3">
                <span class="kicker">Local infrastructure</span>
                <span class="badge">Protocol</span>
              </div>
              <h3 class="mt-2 text-sm font-semibold" style="color:var(--text-h)">${escapeHtml(resource.name)}</h3>
              <p class="mt-2 text-xs leading-relaxed" style="color:var(--text-m)">${escapeHtml(resource.disclosure)}</p>
              <span class="mt-3 inline-flex text-xs font-medium" style="color:var(--accent)">Read public protocol &rarr;</span>
            </a>`;

const replaceMarkedSection = (html, label, startMarker, endMarker, body) => {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end >= 0, `Homepage is missing ${label} public-graph markers.`);
  return `${html.slice(0, start)}${startMarker}\n${body}\n              ${endMarker}${html.slice(end + endMarker.length)}`;
};

let homepage = fs.readFileSync(homepagePath, 'utf8');
for (const [label, startMarker, endMarker] of requiredMarkers) {
  assert(homepage.includes(startMarker) && homepage.includes(endMarker), `Homepage is missing ${label} public-graph markers.`);
}

const publicationSectionMatch = homepage.match(/<!-- PUBLICATION_LIST_START -->([\s\S]*?)<!-- PUBLICATION_LIST_END -->/);
const softwareSectionMatch = homepage.match(/<!-- SOFTWARE_CARD_LIST_START -->([\s\S]*?)<!-- SOFTWARE_CARD_LIST_END -->/);
assert(publicationSectionMatch, 'Homepage is missing PUBLICATION_LIST markers.');
assert(softwareSectionMatch, 'Homepage is missing SOFTWARE_CARD_LIST markers.');
const publicationCount = (publicationSectionMatch[1].match(/<article /g) ?? []).length;
const softwareCount = (softwareSectionMatch[1].match(/<a href=/g) ?? []).length;
const routeCount = routeStripSites.length;

const scalarReplacements = [
  [/<!-- HOMEPAGE_PUBLICATION_COUNT_START -->[\s\S]*?<!-- HOMEPAGE_PUBLICATION_COUNT_END -->/, `<!-- HOMEPAGE_PUBLICATION_COUNT_START -->${publicationCount}<!-- HOMEPAGE_PUBLICATION_COUNT_END -->`],
  [/<!-- HOMEPAGE_SOFTWARE_COUNT_START -->[\s\S]*?<!-- HOMEPAGE_SOFTWARE_COUNT_END -->/, `<!-- HOMEPAGE_SOFTWARE_COUNT_START -->${softwareCount}<!-- HOMEPAGE_SOFTWARE_COUNT_END -->`],
  [/<!-- HOMEPAGE_ROUTE_COUNT_START -->[\s\S]*?<!-- HOMEPAGE_ROUTE_COUNT_END -->/, `<!-- HOMEPAGE_ROUTE_COUNT_START -->${routeCount}<!-- HOMEPAGE_ROUTE_COUNT_END -->`],
];
for (const [pattern, replacement] of scalarReplacements) {
  assert(pattern.test(homepage), 'Homepage is missing a generated count marker.');
  homepage = homepage.replace(pattern, replacement);
}

homepage = replaceMarkedSection(homepage, 'routeStrip', requiredMarkers[4][1], requiredMarkers[4][2], routeStripSites.map(renderRouteCard).join('\n'));
homepage = replaceMarkedSection(homepage, 'primary', requiredMarkers[5][1], requiredMarkers[5][2], primarySites.map(renderPrimaryCard).join('\n'));
homepage = replaceMarkedSection(homepage, 'secondaryCards', requiredMarkers[6][1], requiredMarkers[6][2], secondarySites.map(renderSecondaryCard).join('\n'));
homepage = replaceMarkedSection(homepage, 'secondary', requiredMarkers[7][1], requiredMarkers[7][2], secondarySites.map(renderSecondaryBadge).join('\n'));
homepage = replaceMarkedSection(homepage, 'resources', requiredMarkers[8][1], requiredMarkers[8][2], manifest.resources.map(renderResource).join('\n'));
homepage = replaceMarkedSection(homepage, 'boundaryNotes', requiredMarkers[9][1], requiredMarkers[9][2], boundaryNoteSites.map(renderBoundaryNote).join('\n'));

fs.writeFileSync(homepagePath, homepage);
fs.writeFileSync(mirrorPath, `${JSON.stringify(manifest, null, 2)}\n`);

const sitemapSites = manifest.sites.filter(
  (site) => site.availability === 'public' && site.canonical_url !== null && site.visibility.sitemap === true && site.indexing.mode === 'index_follow',
);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generated from public-graph.manifest.json. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapSites.map((site) => `  <url>\n    <loc>${escapeXml(site.canonical_url)}</loc>\n  </url>`),
  '</urlset>',
  '',
].join('\n');
fs.writeFileSync(sitemapPath, sitemap);

console.log(`Synced v2 public graph from ${path.relative(repoRoot, sourcePath)} for ${primarySites.length} primary and ${secondarySites.length} secondary homepage entries.`);
