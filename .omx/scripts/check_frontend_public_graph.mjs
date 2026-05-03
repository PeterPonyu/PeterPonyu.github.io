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
const text = homepage.toLowerCase();
const matchTags = (tagName, predicate) =>
  [...homepage.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]).filter(predicate);
const hasAttribute = (tag, attributeName) => new RegExp(`\\b${attributeName}=["'][^"']+["']`, 'i').test(tag);

const homepageSite = siteById.get('homepage');
const scportalSite = siteById.get('scportal');
const lioraSite = siteById.get('liora_benchmarks');
const iaodeWorkspaceSite = siteById.get('iaode_workspace');
const mccvaeSite = siteById.get('mccvae');

assert(homepageSite?.role === 'identity_root', 'Homepage must remain identity_root.');
assert(scportalSite?.role === 'discovery_hub', 'SCPortal must remain discovery_hub.');
assert(lioraSite?.role === 'microsite', 'Liora must remain a microsite.');
assert(iaodeWorkspaceSite?.boundary === 'local_first', 'iAODE workspace must remain local_first.');
assert(mccvaeSite?.boundary === 'landing_only', 'MCCVAE must remain landing_only.');

assert(
  homepage.includes('href="https://peterponyu.github.io/"') ||
    homepage.includes('href="https://peterponyu.github.io"'),
  'Homepage must keep canonical self-linking.',
);
assert(homepage.includes('https://peterponyu.github.io/scportal/'), 'Homepage must link to SCPortal.');
assert(homepage.includes('https://peterponyu.github.io/liora-ui/'), 'Homepage must link to Liora UI.');
assert(!text.includes('iaode workspace'), 'Homepage must not visibly promote iAODE Workspace.');

assert(sitemap.includes('https://peterponyu.github.io/'), 'Sitemap must include homepage.');
assert(sitemap.includes('https://peterponyu.github.io/scportal/'), 'Sitemap must include SCPortal.');
assert(sitemap.includes('https://peterponyu.github.io/liora-ui/'), 'Sitemap must include Liora UI.');
assert(sitemap.includes('https://peterponyu.github.io/iAODE/'), 'Sitemap must include iAODE Pages.');
assert(!sitemap.includes('https://peterponyu.github.io/iAODE/frontend/'), 'Sitemap must exclude iAODE workspace.');
assert(!sitemap.includes('https://peterponyu.github.io/MCCVAE/'), 'Sitemap must exclude MCCVAE landing-only surface.');

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
