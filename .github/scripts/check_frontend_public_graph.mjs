#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');

const manifestPath = path.join(root, 'public-graph.manifest.json');
const indexPath = path.join(root, 'index.html');
const sitemapPath = path.join(root, 'sitemap.xml');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const homepage = fs.readFileSync(indexPath, 'utf8');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');

const siteById = new Map(manifest.sites.map((site) => [site.id, site]));
const markedBlock = (start, end) => {
  const startIndex = homepage.indexOf(start);
  const endIndex = homepage.indexOf(end, startIndex + start.length);
  return startIndex >= 0 && endIndex >= 0 ? homepage.slice(startIndex, endIndex + end.length) : '';
};
const generatedGraphText = [
  markedBlock('<!-- PUBLIC_GRAPH_ROUTE_STRIP_START -->', '<!-- PUBLIC_GRAPH_ROUTE_STRIP_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_PRIMARY_START -->', '<!-- PUBLIC_GRAPH_PRIMARY_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_SECONDARY_CARDS_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_CARDS_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_SECONDARY_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_RESOURCES_START -->', '<!-- PUBLIC_GRAPH_RESOURCES_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_START -->', '<!-- PUBLIC_GRAPH_BOUNDARY_NOTES_END -->'),
].join('\n');
const generatedRouteText = [
  markedBlock('<!-- PUBLIC_GRAPH_ROUTE_STRIP_START -->', '<!-- PUBLIC_GRAPH_ROUTE_STRIP_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_PRIMARY_START -->', '<!-- PUBLIC_GRAPH_PRIMARY_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_SECONDARY_CARDS_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_CARDS_END -->'),
  markedBlock('<!-- PUBLIC_GRAPH_SECONDARY_START -->', '<!-- PUBLIC_GRAPH_SECONDARY_END -->'),
].join('\n');
const hasExactHref = (html, url) => {
  const escaped = url.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  return new RegExp(`href=["']${escaped}["']`, 'i').test(html);
};
const matchTags = (tagName, predicate) =>
  [...homepage.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]).filter(predicate);
const hasAttribute = (tag, attributeName) => new RegExp(`\\b${attributeName}=["'][^"']+["']`, 'i').test(tag);

const homepageSite = siteById.get('homepage');
const scportalSite = siteById.get('scportal');
const lioraSite = siteById.get('liora_benchmarks');
const iaodeWorkspaceSite = siteById.get('iaode_workspace');
const mccvaeSite = siteById.get('mccvae');
const atlasSite = siteById.get('scccvgben_atlas');
const modelRouter = manifest.resources?.find((resource) => resource.id === 'model_router');

assert(manifest.version === '2.0', 'Homepage mirror must use public-graph v2.');
assert(homepageSite?.role === 'identity_root', 'Homepage must remain identity_root.');
assert(scportalSite?.role === 'discovery_hub', 'SCPortal must remain discovery_hub.');
assert(lioraSite?.role === 'microsite', 'Liora must remain a microsite.');
assert(iaodeWorkspaceSite?.availability === 'local_only', 'iAODE workspace must remain local_only.');
assert(mccvaeSite?.availability === 'landing_only', 'MCCVAE must remain landing_only.');
assert(atlasSite?.canonical_url === 'https://peterponyu.github.io/scCCVGBen/', 'scCCVGBen atlas must remain canonical.');
assert(modelRouter?.runtime_endpoint === null, 'Model Router must not expose a runtime endpoint.');
assert(modelRouter?.public_url === 'https://github.com/PeterPonyu/model-router', 'Model Router public URL must remain GitHub-only.');

for (const site of manifest.sites) {
  if (site.visibility.homepage !== 'hidden' && site.availability === 'public') {
    assert(site.canonical_url && hasExactHref(generatedRouteText, site.canonical_url), `Homepage graph must render ${site.id}.`);
    assert(generatedRouteText.includes(site.name), `Homepage graph must render the ${site.name} label.`);
  }
  if (site.visibility.homepage === 'hidden' && site.canonical_url) {
    assert(!hasExactHref(generatedRouteText, site.canonical_url), `Homepage graph must not render hidden site ${site.id}.`);
  }
}
for (const resource of manifest.resources ?? []) {
  assert(generatedGraphText.includes(resource.name), `Homepage graph must render resource ${resource.id}.`);
  assert(hasExactHref(generatedGraphText, resource.public_url), `Homepage graph must render resource URL ${resource.id}.`);
  assert(!generatedGraphText.includes('runtime_endpoint'), 'Homepage graph must not render resource runtime fields.');
}

assert(
  homepage.includes('href="https://peterponyu.github.io/"') ||
    homepage.includes('href="https://peterponyu.github.io"'),
  'Homepage must keep canonical self-linking.',
);
assert(homepage.includes('https://peterponyu.github.io/scportal/'), 'Homepage must link to SCPortal.');
assert(homepage.includes('https://peterponyu.github.io/liora-ui/'), 'Homepage must link to Liora UI.');
assert(homepage.includes('https://peterponyu.github.io/scCCVGBen/'), 'Homepage must link to the scCCVGBen atlas.');
assert(homepage.includes('https://github.com/PeterPonyu/model-router'), 'Homepage must link to the Model Router public protocol.');
assert(!homepage.includes('href="https://peterponyu.github.io/iAODE/frontend/"'), 'Homepage must not link to iAODE Workspace.');
assert(!generatedGraphText.includes('https://peterponyu.github.io/MCCVAE/'), 'Generated graph cards must not promote MCCVAE landing-only pages.');

assert(sitemap.includes('https://peterponyu.github.io/'), 'Sitemap must include homepage.');
assert(sitemap.includes('https://peterponyu.github.io/scportal/'), 'Sitemap must include SCPortal.');
assert(sitemap.includes('https://peterponyu.github.io/liora-ui/'), 'Sitemap must include Liora UI.');
assert(sitemap.includes('https://peterponyu.github.io/iAODE/'), 'Sitemap must include iAODE Pages.');
assert(sitemap.includes('https://peterponyu.github.io/scCCVGBen/'), 'Sitemap must include the scCCVGBen atlas.');
assert(!sitemap.includes('https://peterponyu.github.io/iAODE/frontend/'), 'Sitemap must exclude iAODE workspace.');
assert(!sitemap.includes('https://peterponyu.github.io/MCCVAE/'), 'Sitemap must exclude MCCVAE landing-only surface.');
assert(!/(localhost|127\.0\.0\.1|file:\/|\/home\/)/i.test(homepage), 'Homepage must not expose private runtime URLs or paths.');
assert(!/(localhost|127\.0\.0\.1|file:\/|\/home\/)/i.test(sitemap), 'Sitemap must not expose private runtime URLs or paths.');

const mobileMenuButton = matchTags('button', (tag) => /\bid=["']mob-btn["']/i.test(tag))[0] ?? '';
const mainLandmarks = matchTags('main', () => true);
assert(mainLandmarks.length === 1, 'Homepage must expose exactly one main landmark around primary content.');
assert(/\bid=["']main-content["']/i.test(mainLandmarks[0]), 'Homepage main landmark must identify the primary content region.');

assert(homepage.includes('.brand-link') && homepage.includes('min-height:44px'), 'Brand link must keep a 44px touch target.');

assert(hasAttribute(mobileMenuButton, 'aria-label'), 'Mobile menu button must have an accessible name.');
assert(/\baria-controls=["']mob-menu["']/i.test(mobileMenuButton), 'Mobile menu button must reference the controlled menu.');
assert(/\baria-expanded=["']false["']/i.test(mobileMenuButton), 'Mobile menu button must expose its collapsed state.');
assert(homepage.includes('.mobile-menu-button') && homepage.includes('width:44px') && homepage.includes('height:44px'), 'Mobile menu button must keep a 44px touch target.');

assert(homepage.includes('.hero-cta') && homepage.includes('min-height:44px'), 'Hero CTAs must keep 44px touch targets.');

const themeButtons = matchTags('button', (tag) => /\bclass=["'][^"']*\btheme-btn\b/i.test(tag));
assert(themeButtons.length >= 6, 'Homepage must expose the available theme choices.');
assert(themeButtons.every((tag) => hasAttribute(tag, 'aria-label')), 'Every theme swatch must have an aria-label.');
assert(themeButtons.every((tag) => /\brole=["']menuitemradio["']/i.test(tag)), 'Theme choices must be exposed as radio-like menu items.');
assert(themeButtons.every((tag) => /\baria-checked=["'](?:true|false)["']/i.test(tag)), 'Theme choices must expose checked state.');
assert(homepage.includes('.theme-menu-toggle') && homepage.includes('min-height:44px'), 'Theme menu trigger and swatches must keep 44px touch targets.');

assert(homepage.includes('@media(prefers-reduced-motion:reduce)'), 'Homepage must declare a reduced-motion CSS media query.');
assert(homepage.includes('transition-duration:.001ms'), 'Reduced-motion CSS must disable transitions.');
assert(homepage.includes("matchMedia('(prefers-reduced-motion: reduce)'") || homepage.includes('matchMedia("(prefers-reduced-motion: reduce)"'), 'Canvas animation must observe prefers-reduced-motion.');

assert(homepage.includes('site-footer'), 'Footer must use the readable site-footer treatment.');
assert(homepage.includes('footer-link'), 'Footer links must use enlarged touch-target styling.');
assert(/\.site-footer \.badge\{[^}]*min-height:44px/i.test(homepage), 'Footer chips must keep 44px touch targets.');
assert(/\.footer-link\{[^}]*min-height:44px/i.test(homepage), 'Footer links must keep 44px touch targets.');

console.log('Frontend public-graph audit passed.');
