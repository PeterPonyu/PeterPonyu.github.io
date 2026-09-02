#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');

const parseArgs = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--self-test') {
      result.selfTest = true;
      continue;
    }
    if (argument === '--source' || argument === '--mirror' || argument === '--ref') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a path.`);
      result[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--source=') || argument.startsWith('--mirror=') || argument.startsWith('--ref=')) {
      const [key, value] = argument.slice(2).split(/=(.*)/s);
      if (!value) throw new Error(`--${key} requires a path.`);
      result[key] = value;
      continue;
    }
    throw new Error(`Unknown argument ${argument}.`);
  }
  return result;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
};

export const canonicalJson = (value) => JSON.stringify(normalize(value));
export const manifestDigest = (manifest) => crypto.createHash('sha256').update(canonicalJson(manifest)).digest('hex');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const resolvePath = (value, fallback) => value ? path.resolve(process.cwd(), value) : path.join(root, fallback);

export const checkParity = ({ source, mirror, ref }) => {
  assert(source && mirror && ref, 'Parity requires source, mirror, and ref documents.');
  assert(source.version === '2.0', 'Source manifest must use version 2.0.');
  assert(mirror.version === '2.0', 'Mirror manifest must use version 2.0.');
  assert(canonicalJson(source) === canonicalJson(mirror), 'Source and mirror manifests differ after normalization.');
  assert(typeof ref.repository === 'string' && ref.repository.length > 0, 'Source ref must define repository.');
  assert(typeof ref.path === 'string' && ref.path.length > 0, 'Source ref must define path.');
  assert(typeof ref.commit === 'string' && /^[0-9a-f]{7,64}$/i.test(ref.commit), 'Source ref must define a commit SHA.');
  assert(typeof ref.sha256 === 'string' && /^[0-9a-f]{64}$/.test(ref.sha256), 'Source ref must define a SHA-256 digest.');
  const digest = manifestDigest(source);
  assert(ref.sha256 === digest, `Source ref digest mismatch: expected ${digest}, received ${ref.sha256}.`);
  return { digest, siteCount: source.sites?.length ?? 0, resourceCount: source.resources?.length ?? 0 };
};

const runSelfTest = () => {
  const source = {
    version: '2.0',
    graph: { identity_root: 'homepage' },
    resources: [],
    sites: [{ id: 'homepage', name: 'Homepage', canonical_url: 'https://example.invalid/', availability: 'public' }],
  };
  const ref = {
    repository: 'PeterPonyu/scportal',
    path: 'public-graph.manifest.json',
    commit: 'e5778dff8af874fa77fce72283042d99517d04a1',
    sha256: manifestDigest(source),
  };
  const expectFailure = (label, mutateMirror, pattern, mutateRef = (value) => value) => {
    try {
      checkParity({
        source,
        mirror: mutateMirror(structuredClone(source)),
        ref: mutateRef(structuredClone(ref)),
      });
    } catch (error) {
      assert(pattern.test(String(error.message)), `${label} failed with an unexpected message: ${error.message}`);
      return;
    }
    throw new Error(`${label} unexpectedly passed.`);
  };
  checkParity({ source, mirror: structuredClone(source), ref });
  expectFailure('version mutation', (mirror) => { mirror.version = '1.0'; return mirror; }, /version 2\.0|differ/i);
  expectFailure('site name mutation', (mirror) => { mirror.sites[0].name = 'Changed'; return mirror; }, /differ/i);
  expectFailure('canonical mutation', (mirror) => { mirror.sites[0].canonical_url = 'https://changed.invalid/'; return mirror; }, /differ/i);
  expectFailure('digest mutation', (mirror) => mirror, /differ|digest/i, (reference) => {
    reference.sha256 = '0'.repeat(64);
    return reference;
  });
  console.log('public graph parity self-test passed (version, name, canonical, and digest mutations rejected).');
};

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly && process.argv.includes('--self-test')) {
  runSelfTest();
} else if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolvePath(args.source, 'public-graph.manifest.upstream.json');
  const mirrorPath = resolvePath(args.mirror, 'public-graph.manifest.json');
  const refPath = resolvePath(args.ref, 'public-graph.source-ref.json');
  const result = checkParity({ source: readJson(sourcePath), mirror: readJson(mirrorPath), ref: readJson(refPath) });
  console.log(`Public graph parity passed: ${result.siteCount} sites, ${result.resourceCount} resources, digest ${result.digest}.`);
}
