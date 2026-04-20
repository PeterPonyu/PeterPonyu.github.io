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

console.log('Frontend public-graph audit passed.');
