#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const lockPath = path.join(root, '.github/public-graph.lock.json');

export function verifySha256(content, expected) {
  const actual = createHash('sha256').update(content).digest('hex');
  if (actual !== expected) throw new Error(`public graph checksum mismatch: ${actual}`);
  return actual;
}

const assertImmutableLock = (lock) => {
  if (!lock || typeof lock !== 'object') throw new Error('public graph lock must be an object');
  if (typeof lock.source_repo !== 'string' || lock.source_repo.length === 0) {
    throw new Error('public graph lock must define source_repo');
  }
  if (typeof lock.source_path !== 'string' || lock.source_path.length === 0) {
    throw new Error('public graph lock must define source_path');
  }
  if (!/^[0-9a-f]{40}$/.test(lock.source_ref)) {
    throw new Error('public graph lock source_ref must be a 40-character lowercase hexadecimal commit SHA');
  }
  if (!/^[0-9a-f]{64}$/.test(lock.sha256)) {
    throw new Error('public graph lock sha256 must be a 64-character lowercase hexadecimal digest');
  }
};

export async function fetchPublicGraph(lock) {
  assertImmutableLock(lock);
  const rawUrl = `https://raw.githubusercontent.com/${lock.source_repo}/${lock.source_ref}/${lock.source_path}`;
  const response = await fetch(rawUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`public graph fetch failed: HTTP ${response.status}`);
  const content = await response.text();
  verifySha256(content, lock.sha256);
  const manifest = JSON.parse(content);
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(root, '.cache/public-graph.manifest.json'), content);
  return manifest;
}

const initializeLock = async () => {
  const commitResponse = await fetch('https://api.github.com/repos/PeterPonyu/scportal/commits/main', {
    signal: AbortSignal.timeout(30_000),
  });
  if (!commitResponse.ok) throw new Error(`public graph lock initialization failed: HTTP ${commitResponse.status}`);
  const resolvedCommitSha = (await commitResponse.json()).sha;
  if (!/^[0-9a-f]{40}$/.test(resolvedCommitSha)) {
    throw new Error('public graph lock initialization did not resolve a 40-character lowercase hexadecimal commit SHA');
  }

  const rawUrl = `https://raw.githubusercontent.com/PeterPonyu/scportal/${resolvedCommitSha}/public-graph.manifest.json`;
  const response = await fetch(rawUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`public graph fetch failed: HTTP ${response.status}`);
  const content = await response.text();
  JSON.parse(content);
  const lock = {
    source_repo: 'PeterPonyu/scportal',
    source_path: 'public-graph.manifest.json',
    source_ref: resolvedCommitSha,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Initialized public graph lock at ${lock.source_ref}.`);
};

const selfTest = () => {
  try {
    verifySha256('{"version":"2.0"}', '0000');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('public graph checksum mismatch: ')) {
      console.log('Public graph checksum failure fixture passed.');
      return;
    }
    throw error;
  }
  throw new Error('public graph checksum self-test did not detect a mismatch');
};

if (process.argv.includes('--self-test')) {
  selfTest();
} else if (process.argv.includes('--init-lock')) {
  await initializeLock();
} else {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  await fetchPublicGraph(lock);
  console.log('Fetched and verified pinned public graph.');
}
