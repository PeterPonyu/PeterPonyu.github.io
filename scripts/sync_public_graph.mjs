#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const manifestPath = path.join(repoRoot, 'public-graph.manifest.json');
const homepagePath = path.join(repoRoot, 'index.html');
const sitemapPath = path.join(repoRoot, 'sitemap.xml');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const requiredMarkers = [
  ['publicationList', '<!-- PUBLICATION_LIST_START -->', '<!-- PUBLICATION_LIST_END -->'],
  ['publicationCount', '<!-- HOMEPAGE_PUBLICATION_COUNT_START -->', '<!-- HOMEPAGE_PUBLICATION_COUNT_END -->'],
  ['softwareCount', '<!-- HOMEPAGE_SOFTWARE_COUNT_START -->', '<!-- HOMEPAGE_SOFTWARE_COUNT_END -->'],
  ['routeCount', '<!-- HOMEPAGE_ROUTE_COUNT_START -->', '<!-- HOMEPAGE_ROUTE_COUNT_END -->'],
  ['routeStrip', '<!-- PUBLIC_GRAPH_ROUTE_STRIP_START -->', '<!-- PUBLIC_GRAPH_ROUTE_STRIP_END -->'],
  ['primary', '<!-- PUBLIC_GRAPH_PRIMARY_START -->', '<!-- PUBLIC_GRAPH_PRIMARY_END -->'],
  ['secondaryCards', '<!-- PUBLIC_GRAPH_SECONDARY_CARDS_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_CARDS_END -->'],
  ['secondary', '<!-- PUBLIC_GRAPH_SECONDARY_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_END -->'],
  ['boundaryNotes', '<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_START -->', '<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_END -->']
];

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

assert(Array.isArray(manifest.sites), 'Manifest must contain a sites array.');

for (const site of manifest.sites) {
  assert(typeof site.name === 'string' && site.name.length > 0, 'Each site must define a name.');
  assert(typeof site.canonical_url === 'string', `Site ${site.name} must define canonical_url.`);
  assert(site.visibility && typeof site.visibility === 'object', `Site ${site.name} must define visibility.`);
  assert(typeof site.visibility.homepage === 'string', `Site ${site.name} must define visibility.homepage.`);
  assert(typeof site.visibility.sitemap === 'boolean', `Site ${site.name} must define visibility.sitemap.`);
  assert(site.indexing && typeof site.indexing.mode === 'string', `Site ${site.name} must define indexing.mode.`);
  if (site.visibility.homepage !== 'hidden') {
    assert(
      Number.isInteger(site.visibility.homepage_order),
      `Visible homepage site ${site.name} must define an integer homepage_order.`
    );
    assert(
      typeof site.presentation?.homepage?.summary === 'string' &&
      site.presentation.homepage.summary.length > 0,
      `Visible homepage site ${site.name} must define presentation.homepage.summary.`
    );
    assert(
      typeof site.presentation?.homepage?.cta_label === 'string' &&
      site.presentation.homepage.cta_label.length > 0,
      `Visible homepage site ${site.name} must define presentation.homepage.cta_label.`
    );
  }
  if (site.visibility.homepage === 'hidden' && site.boundary !== 'public') {
    assert(
      typeof site.presentation?.homepage?.boundary_note === 'string' &&
      site.presentation.homepage.boundary_note.length > 0,
      `Hidden non-public site ${site.name} must define presentation.homepage.boundary_note.`
    );
  }
  new URL(site.canonical_url);
}

const visibleSites = manifest.sites
  .filter((site) => site.visibility.homepage !== 'hidden')
  .sort((a, b) => {
    const aOrder = a.visibility.homepage_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.visibility.homepage_order ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

const primarySites = visibleSites.filter((site) => site.visibility.homepage === 'primary');
const secondarySites = visibleSites.filter((site) => site.visibility.homepage === 'secondary');
const boundaryNoteSites = manifest.sites.filter(
  (site) => site.visibility.homepage === 'hidden' && site.boundary !== 'public'
);
const routeStripSites = [...primarySites, ...secondarySites];

const routeBadgeLabel = (site) => {
  if (site.visibility.homepage === 'primary') {
    return 'Primary Route';
  }
  if (site.visibility.homepage === 'secondary') {
    return 'Secondary Route';
  }
  return 'Route';
};

const boundaryLabel = (site) => {
  if (site.boundary === 'local_first') {
    return 'Local-First';
  }
  if (site.boundary === 'landing_only') {
    return 'Landing-Only';
  }
  return site.boundary;
};

const renderRouteCard = (site) => {
  const presentation = site.presentation?.homepage ?? {};
  const kind = presentation.kind ?? site.role;
  const summary = presentation.summary ?? site.name;
  const cta = presentation.cta_label ?? `Open ${site.name}`;
  const badge = routeBadgeLabel(site);

  return `        <a href="${escapeHtml(site.canonical_url)}" target="_blank" rel="noopener noreferrer" class="glass rounded-2xl p-4 block transition-all group">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em]" style="color:var(--text-m)">${escapeHtml(kind)}</span>
            <span class="badge">${escapeHtml(badge)}</span>
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
  const note = site.presentation?.homepage?.boundary_note ?? site.name;
  const label = boundaryLabel(site);
  const heading = `${label} boundary`;

  return `              <div class="step-card">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-medium" style="color:var(--text-h)">${escapeHtml(heading)}</div>
                    <p class="mt-1 text-xs leading-relaxed" style="color:var(--text-m)">${escapeHtml(note)}</p>
                  </div>
                  <span class="badge">${escapeHtml(label)}</span>
                </div>
              </div>`;
};

const routeStripSection = routeStripSites.map(renderRouteCard).join('\n');
const primarySection = primarySites.map(renderPrimaryCard).join('\n');
const secondaryCardsSection = secondarySites.map(renderSecondaryCard).join('\n');
const secondarySection = secondarySites.map(renderSecondaryBadge).join('\n');
const boundaryNotesSection = boundaryNoteSites.map(renderBoundaryNote).join('\n');

let homepage = fs.readFileSync(homepagePath, 'utf8');

for (const [label, startMarker, endMarker] of requiredMarkers) {
  assert(
    homepage.includes(startMarker) && homepage.includes(endMarker),
    `Homepage is missing ${label} public-graph markers.`
  );
}

const publicationSectionMatch = homepage.match(
  /<!-- PUBLICATION_LIST_START -->([\s\S]*?)<!-- PUBLICATION_LIST_END -->/
);
const softwareSectionMatch = homepage.match(
  /<!-- SOFTWARE_CARD_LIST_START -->([\s\S]*?)<!-- SOFTWARE_CARD_LIST_END -->/
);

assert(publicationSectionMatch, 'Homepage is missing PUBLICATION_LIST markers.');
assert(softwareSectionMatch, 'Homepage is missing SOFTWARE_CARD_LIST markers.');

const publicationCount = (publicationSectionMatch[1].match(/<article /g) ?? []).length;
const softwareCount = (softwareSectionMatch[1].match(/<a href=/g) ?? []).length;
const routeCount = routeStripSites.length;

homepage = homepage.replace(
  /<!-- HOMEPAGE_PUBLICATION_COUNT_START -->[\s\S]*?<!-- HOMEPAGE_PUBLICATION_COUNT_END -->/,
  `<!-- HOMEPAGE_PUBLICATION_COUNT_START -->${publicationCount}<!-- HOMEPAGE_PUBLICATION_COUNT_END -->`
);

homepage = homepage.replace(
  /<!-- HOMEPAGE_SOFTWARE_COUNT_START -->[\s\S]*?<!-- HOMEPAGE_SOFTWARE_COUNT_END -->/,
  `<!-- HOMEPAGE_SOFTWARE_COUNT_START -->${softwareCount}<!-- HOMEPAGE_SOFTWARE_COUNT_END -->`
);

homepage = homepage.replace(
  /<!-- HOMEPAGE_ROUTE_COUNT_START -->[\s\S]*?<!-- HOMEPAGE_ROUTE_COUNT_END -->/,
  `<!-- HOMEPAGE_ROUTE_COUNT_START -->${routeCount}<!-- HOMEPAGE_ROUTE_COUNT_END -->`
);

homepage = homepage.replace(
  /<!-- PUBLIC_GRAPH_ROUTE_STRIP_START -->[\s\S]*?<!-- PUBLIC_GRAPH_ROUTE_STRIP_END -->/,
  `<!-- PUBLIC_GRAPH_ROUTE_STRIP_START -->\n${routeStripSection}\n        <!-- PUBLIC_GRAPH_ROUTE_STRIP_END -->`
);

homepage = homepage.replace(
  /<!-- PUBLIC_GRAPH_PRIMARY_START -->[\s\S]*?<!-- PUBLIC_GRAPH_PRIMARY_END -->/,
  `<!-- PUBLIC_GRAPH_PRIMARY_START -->\n${primarySection}\n              <!-- PUBLIC_GRAPH_PRIMARY_END -->`
);

homepage = homepage.replace(
  /<!-- PUBLIC_GRAPH_SECONDARY_CARDS_START -->[\s\S]*?<!-- PUBLIC_GRAPH_SECONDARY_CARDS_END -->/,
  `<!-- PUBLIC_GRAPH_SECONDARY_CARDS_START -->\n${secondaryCardsSection}\n              <!-- PUBLIC_GRAPH_SECONDARY_CARDS_END -->`
);

homepage = homepage.replace(
  /<!-- PUBLIC_GRAPH_SECONDARY_START -->[\s\S]*?<!-- PUBLIC_GRAPH_SECONDARY_END -->/,
  `<!-- PUBLIC_GRAPH_SECONDARY_START -->\n${secondarySection}\n              <!-- PUBLIC_GRAPH_SECONDARY_END -->`
);

homepage = homepage.replace(
  /<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_START -->[\s\S]*?<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_END -->/,
  `<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_START -->\n${boundaryNotesSection}\n              <!-- PUBLIC_GRAPH_BOUNDARY_NOTES_END -->`
);

fs.writeFileSync(homepagePath, homepage);

const sitemapSites = manifest.sites.filter(
  (site) => site.visibility.sitemap === true && site.indexing.mode === 'index_follow'
);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- Generated from public-graph.manifest.json. -->',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapSites.map((site) => `  <url>\n    <loc>${escapeXml(site.canonical_url)}</loc>\n  </url>`),
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync(sitemapPath, sitemap);

console.log(`Synced public graph for ${primarySites.length} primary and ${secondarySites.length} secondary homepage entries.`);
