'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const MemoryStore = require('../lib/memory-store');

let hasSQLite = false;
try {
  require('better-sqlite3');
  hasSQLite = true;
} catch (_) {
  hasSQLite = false;
}

const sqliteTempDir = path.join(__dirname, 'memory-store-dos-limits-' + Date.now());
if (hasSQLite && !fs.existsSync(sqliteTempDir)) {
  fs.mkdirSync(sqliteTempDir, { recursive: true });
}

after(() => {
  if (!hasSQLite) return;
  try {
    fs.rmSync(sqliteTempDir, { recursive: true, force: true });
  } catch (_) {
    // Ignore Windows file-handle timing during test cleanup.
  }
});

function createStore(backend, name) {
  if (backend === 'sqlite') {
    return new MemoryStore({
      useSQLite: true,
      dbPath: path.join(sqliteTempDir, `${name}.db`),
    });
  }
  return new MemoryStore();
}

function backends() {
  const list = ['in-memory'];
  if (hasSQLite) list.push('sqlite');
  return list;
}

function makeProvenance(workspaceId, label) {
  return {
    provenanceId: `prov-${label}-${workspaceId}`,
    sourceRef: 'axiom-memory-core',
    sourceTitle: 'AXIOM Memory Core',
    sourceType: 'memory-api',
    actor: 'system',
    timestamp: '2026-06-03T00:00:00.000Z',
    workspaceId,
    trustPolicyVersion: '1.0.0',
    confidence: 1.0,
  };
}

function makeMemoryPackage(count, workspaceId) {
  const memories = [];
  const events = [];
  for (let i = 0; i < count; i++) {
    const memoryId = `mem-${workspaceId}-${i}`;
    memories.push({
      memoryId,
      workspaceId,
      content: `content-${i}`,
      createdAt: `2026-06-03T00:00:${String(i % 60).padStart(2, '0')}.000Z`,
      provenance: makeProvenance(workspaceId, `mem-${i}`),
      trustPolicyVersion: '1.0.0',
      metadata: { index: i },
    });
    events.push({
      eventId: `evt-${workspaceId}-${i}`,
      eventType: 'CREATED',
      memoryId,
      workspaceId,
      createdAt: `2026-06-03T00:01:${String(i % 60).padStart(2, '0')}.000Z`,
      actor: 'system',
      provenance: makeProvenance(workspaceId, `evt-${i}`),
      trustPolicyVersion: '1.0.0',
      details: {},
    });
  }
  return {
    version: '1.0.0',
    schemaVersion: 'memory-package-v1',
    workspaceId,
    memories,
    events,
    links: [],
  };
}

describe('SECURITY-P1-3 memory store DoS limits', () => {
  it('rejects import packages that exceed max memory count', () => {
    const store = new MemoryStore();
    const overLimit = makeMemoryPackage(1001, 'dos-import');
    const atLimit = makeMemoryPackage(1000, 'dos-import-ok');

    const fail = store.importPackage(overLimit, { targetWorkspaceId: 'dos-import' });
    assert.strictEqual(fail.ok, false);
    assert.strictEqual(fail.error.code, 'INVALID_PACKAGE');

    const pass = store.importPackage(atLimit, { targetWorkspaceId: 'dos-import-ok' });
    assert.strictEqual(pass.ok, true);
    assert.strictEqual(pass.imported.memories, 1000);
  });

  it('rejects import packages that exceed max event and link counts', () => {
    const store = new MemoryStore();
    const pkg = makeMemoryPackage(1, 'dos-events');
    pkg.events = Array.from({ length: 5001 }, (_, i) => ({
      eventId: `evt-${i}`,
      eventType: 'CREATED',
      memoryId: pkg.memories[0].memoryId,
      workspaceId: 'dos-events',
      createdAt: '2026-06-03T00:00:00.000Z',
      actor: 'system',
      provenance: makeProvenance('dos-events', `event-${i}`),
      trustPolicyVersion: '1.0.0',
      details: {},
    }));
    const eventFail = store.importPackage(pkg, { targetWorkspaceId: 'dos-events' });
    assert.strictEqual(eventFail.ok, false);
    assert.strictEqual(eventFail.error.code, 'INVALID_PACKAGE');

    const pkgLinks = makeMemoryPackage(2, 'dos-links');
    pkgLinks.links = Array.from({ length: 5001 }, (_, i) => ({
      linkId: `link-${i}`,
      relation: 'supports',
      fromMemoryId: pkgLinks.memories[0].memoryId,
      toMemoryId: pkgLinks.memories[1].memoryId,
      workspaceId: 'dos-links',
      createdAt: '2026-06-03T00:00:00.000Z',
      provenance: makeProvenance('dos-links', `link-${i}`),
      trustPolicyVersion: '1.0.0',
      metadata: {},
    }));
    const linkFail = store.importPackage(pkgLinks, { targetWorkspaceId: 'dos-links' });
    assert.strictEqual(linkFail.ok, false);
    assert.strictEqual(linkFail.error.code, 'INVALID_PACKAGE');
  });

  it('rejects oversized import content and metadata payloads', () => {
    const store = new MemoryStore();
    const oversizedContent = makeMemoryPackage(1, 'dos-content');
    oversizedContent.memories[0].content = 'x'.repeat(64001);

    const contentFail = store.importPackage(oversizedContent, { targetWorkspaceId: 'dos-content' });
    assert.strictEqual(contentFail.ok, true);
    assert.ok(Array.isArray(contentFail.conflicts));
    assert.match(String(contentFail.conflicts[0].reason), /content exceeds max size/i);

    const oversizedMetadata = makeMemoryPackage(1, 'dos-meta');
    oversizedMetadata.memories[0].metadata = { blob: 'x'.repeat(32001) };

    const metadataFail = store.importPackage(oversizedMetadata, { targetWorkspaceId: 'dos-meta' });
    assert.strictEqual(metadataFail.ok, true);
    assert.ok(Array.isArray(metadataFail.conflicts));
    assert.match(String(metadataFail.conflicts[0].reason), /metadata exceeds max size/i);
  });

  it('rejects oversized query text and preserves normal query behavior', () => {
    const store = new MemoryStore();
    store.store({ content: 'cold chain shipment remained between 2C and 8C' });

    const tooLong = store.query({ text: 'x'.repeat(2001) });
    assert.strictEqual(tooLong.ok, false);
    assert.strictEqual(tooLong.error.code, 'VALIDATION_ERROR');

    const ok = store.query({ text: 'cold chain' });
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(ok.total, 1);
  });

  it('caps default list/query/timeline output and blocks unsafe explicit limits', () => {
    const store = new MemoryStore();
    for (let i = 0; i < 520; i++) {
      store.store({ content: `item-${i}` });
    }

    const listed = store.list({});
    assert.strictEqual(listed.ok, true);
    assert.strictEqual(listed.total, 520);
    assert.strictEqual(listed.memories.length, 500);
    assert.strictEqual(listed.limit, 500);

    const queried = store.query({ limit: null });
    assert.strictEqual(queried.ok, true);
    assert.strictEqual(queried.memories.length, 500);
    assert.strictEqual(queried.limit, 500);

    const timeline = store.timeline({ limit: null });
    assert.strictEqual(timeline.ok, true);
    assert.strictEqual(timeline.events.length, 500);
    assert.strictEqual(timeline.limit, 500);

    const badInfinity = store.query({ limit: Infinity });
    assert.strictEqual(badInfinity.ok, false);
    assert.strictEqual(badInfinity.error.code, 'VALIDATION_ERROR');
  });

  it('blocks oversized exports instead of dumping unbounded workspace data', () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5001; i++) {
      store.store({ content: `export-${i}` });
    }

    const exported = store.exportPackage({});
    assert.strictEqual(exported.ok, false);
    assert.strictEqual(exported.error.code, 'VALIDATION_ERROR');
  });

  it('preserves workspace isolation under limit handling', () => {
    const store = new MemoryStore();
    store.store({ content: 'default-only', workspaceId: 'default' });
    store.store({ content: 'workspace-a', workspaceId: 'workspace-a' });
    store.store({ content: 'workspace-b', workspaceId: 'workspace-b' });

    const defaultList = store.list({});
    assert.strictEqual(defaultList.ok, true);
    assert.strictEqual(defaultList.total, 1);
    assert.strictEqual(defaultList.memories[0].workspaceId, 'default');

    const listA = store.list({ workspaceId: 'workspace-a', limit: null });
    assert.strictEqual(listA.ok, true);
    assert.strictEqual(listA.total, 1);
    assert.strictEqual(listA.memories[0].content, 'workspace-a');

    const queryB = store.query({ workspaceId: 'workspace-b', text: 'workspace-a' });
    assert.strictEqual(queryB.ok, true);
    assert.strictEqual(queryB.total, 0);
  });

  for (const backend of backends()) {
    it(`${backend} enforces import count limits without bypass`, () => {
      const store = createStore(backend, 'dos-import-limit');
      try {
        const pkg = makeMemoryPackage(1001, `${backend}-ws`);
        const result = store.importPackage(pkg, { targetWorkspaceId: `${backend}-ws` });
        assert.strictEqual(result.ok, false);
        assert.strictEqual(result.error.code, 'INVALID_PACKAGE');
      } finally {
        if (typeof store.close === 'function') {
          store.close();
        }
      }
    });
  }
});
