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

const sqliteTempDir = path.join(__dirname, 'memory-store-workspace-isolation-' + Date.now());
if (hasSQLite && !fs.existsSync(sqliteTempDir)) {
  fs.mkdirSync(sqliteTempDir, { recursive: true });
}

after(() => {
  if (!hasSQLite) return;
  try {
    fs.rmSync(sqliteTempDir, { recursive: true, force: true });
  } catch (_) {
    // Ignore cleanup failures on Windows if a file handle is still closing.
  }
});

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

function makePackage(workspaceId, label) {
  return {
    version: '1.0.0',
    schemaVersion: 'memory-package-v1',
    workspaceId: 'seed',
    memories: [
      {
        memoryId: 'shared-id',
        workspaceId: 'seed',
        content: `${label} shared claim`,
        createdAt: '2026-06-03T00:00:00.000Z',
        provenance: makeProvenance(workspaceId, `${label}-shared`),
        trustPolicyVersion: '1.0.0',
      },
      {
        memoryId: `peer-${label}`,
        workspaceId: 'seed',
        content: `${label} peer claim`,
        createdAt: '2026-06-03T00:00:01.000Z',
        provenance: makeProvenance(workspaceId, `${label}-peer`),
        trustPolicyVersion: '1.0.0',
      },
    ],
    events: [
      {
        eventId: `evt-${label}-shared`,
        eventType: 'CREATED',
        memoryId: 'shared-id',
        workspaceId: 'seed',
        createdAt: '2026-06-03T00:00:00.000Z',
        actor: 'system',
        provenance: makeProvenance(workspaceId, `${label}-shared-event`),
        trustPolicyVersion: '1.0.0',
        details: {},
      },
      {
        eventId: `evt-${label}-peer`,
        eventType: 'CREATED',
        memoryId: `peer-${label}`,
        workspaceId: 'seed',
        createdAt: '2026-06-03T00:00:01.000Z',
        actor: 'system',
        provenance: makeProvenance(workspaceId, `${label}-peer-event`),
        trustPolicyVersion: '1.0.0',
        details: {},
      },
    ],
    links: [
      {
        linkId: `link-${label}`,
        relation: 'supports',
        fromMemoryId: 'shared-id',
        toMemoryId: `peer-${label}`,
        workspaceId: 'seed',
        createdAt: '2026-06-03T00:00:02.000Z',
        provenance: makeProvenance(workspaceId, `${label}-link`),
        trustPolicyVersion: '1.0.0',
      },
    ],
  };
}

function createStore(backend, name) {
  if (backend === 'sqlite') {
    const dbPath = path.join(sqliteTempDir, `${name}.db`);
    return new MemoryStore({ useSQLite: true, dbPath });
  }
  return new MemoryStore();
}

function backends() {
  const list = [{ name: 'in-memory' }];
  if (hasSQLite) {
    list.push({ name: 'sqlite' });
  }
  return list;
}

describe('SECURITY-P1-2 workspace isolation', () => {
  for (const backend of backends()) {
    it(`${backend.name} keeps workspace lookups isolated`, () => {
      const store = createStore(backend.name, 'workspace-isolation');
      try {
        const defaultRecord = store.store({ content: 'default-visible' });
        assert.strictEqual(defaultRecord.ok, true);
        assert.strictEqual(defaultRecord.memory.workspaceId, 'default');

        const importA = store.importPackage(makePackage('workspace-a', 'alpha'), { targetWorkspaceId: 'workspace-a' });
        const importB = store.importPackage(makePackage('workspace-b', 'beta'), { targetWorkspaceId: 'workspace-b' });
        assert.strictEqual(importA.ok, true);
        assert.strictEqual(importB.ok, true);

        const defaultGet = store.get(defaultRecord.memory.memoryId);
        assert.strictEqual(defaultGet.ok, true);
        assert.strictEqual(defaultGet.memory.workspaceId, 'default');

        const missingWorkspaceGet = store.get('shared-id');
        assert.strictEqual(missingWorkspaceGet.ok, false);
        assert.strictEqual(missingWorkspaceGet.error.code, 'NOT_FOUND');

        const workspaceAGet = store.get('shared-id', { workspaceId: 'workspace-a' });
        const workspaceBGet = store.get('shared-id', { workspaceId: 'workspace-b' });
        assert.strictEqual(workspaceAGet.ok, true);
        assert.strictEqual(workspaceBGet.ok, true);
        assert.strictEqual(workspaceAGet.memory.content, 'alpha shared claim');
        assert.strictEqual(workspaceBGet.memory.content, 'beta shared claim');
        assert.strictEqual(workspaceAGet.memory.workspaceId, 'workspace-a');
        assert.strictEqual(workspaceBGet.memory.workspaceId, 'workspace-b');

        const defaultEvents = store.getEvents('shared-id');
        const defaultLinks = store.getLinks('shared-id');
        assert.deepStrictEqual(defaultEvents, []);
        assert.deepStrictEqual(defaultLinks, []);

        const eventsA = store.getEvents('shared-id', { workspaceId: 'workspace-a' });
        const eventsB = store.getEvents('shared-id', { workspaceId: 'workspace-b' });
        assert.strictEqual(eventsA.length, 1);
        assert.strictEqual(eventsB.length, 1);
        assert.strictEqual(eventsA[0].workspaceId, 'workspace-a');
        assert.strictEqual(eventsB[0].workspaceId, 'workspace-b');

        const linksA = store.getLinks('shared-id', { workspaceId: 'workspace-a' });
        const linksB = store.getLinks('shared-id', { workspaceId: 'workspace-b' });
        assert.strictEqual(linksA.length, 1);
        assert.strictEqual(linksB.length, 1);
        assert.strictEqual(linksA[0].workspaceId, 'workspace-a');
        assert.strictEqual(linksB[0].workspaceId, 'workspace-b');

        const listA = store.list({ workspaceId: 'workspace-a' });
        const listB = store.list({ workspaceId: 'workspace-b' });
        const queryA = store.query({ workspaceId: 'workspace-a', contentIncludes: 'alpha shared claim' });
        const queryB = store.query({ workspaceId: 'workspace-b', contentIncludes: 'beta shared claim' });
        const timelineA = store.timeline({ workspaceId: 'workspace-a' });
        const timelineB = store.timeline({ workspaceId: 'workspace-b' });

        assert.strictEqual(listA.total, 2);
        assert.strictEqual(listB.total, 2);
        assert.strictEqual(queryA.total, 1);
        assert.strictEqual(queryB.total, 1);
        assert.strictEqual(timelineA.total, 2);
        assert.strictEqual(timelineB.total, 2);
        assert.ok(listA.memories.every((record) => record.workspaceId === 'workspace-a'));
        assert.ok(listB.memories.every((record) => record.workspaceId === 'workspace-b'));
        assert.ok(queryA.memories.every((record) => record.workspaceId === 'workspace-a'));
        assert.ok(queryB.memories.every((record) => record.workspaceId === 'workspace-b'));
        assert.ok(timelineA.events.every((event) => event.workspaceId === 'workspace-a'));
        assert.ok(timelineB.events.every((event) => event.workspaceId === 'workspace-b'));
        assert.strictEqual(store.queryLinks({ workspaceId: 'workspace-a' }).total, 1);
        assert.strictEqual(store.queryLinks({ workspaceId: 'workspace-b' }).total, 1);
      } finally {
        store.close();
      }
    });
  }
});
