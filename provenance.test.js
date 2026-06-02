const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Kernel = require('./kernel');
const KernelV2 = require('./kernel.v2');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-provenance-'));

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makePaths(name) {
  return {
    memoryPath: path.join(tempDir, `${name}.json`),
    dbPath: path.join(tempDir, `${name}.db`),
  };
}

function makeProvenance(overrides = {}) {
  return {
    provenanceId: 'prov-001',
    sourceRef: 'docs/adr.md#claim',
    sourceTitle: 'ADR Claim',
    sourceType: 'document',
    actor: 'system',
    timestamp: '2026-06-02T00:00:00Z',
    confidence: 0.91,
    workspaceId: 'default',
    trustPolicyVersion: 'trust-policy-v0',
    ...overrides,
  };
}

describe('Provenance System', () => {
  it('stores provenance on node and edge in memory mode', () => {
    const kernel = new Kernel({ noLoad: true, useSQLite: false, ...makePaths('memory') });
    const provenance = makeProvenance();

    kernel.learn('kedi hayvandir', { provenance });

    const node = kernel.graph.getNode('kedi');
    const edge = kernel.graph.getEdge('kedi', 'hayvan', 'tür');

    assert.deepStrictEqual(node.provenance, provenance);
    assert.deepStrictEqual(edge.provenance, provenance);
  });

  it('persists provenance through JSON save/load roundtrip', () => {
    const paths = makePaths('json-roundtrip');
    const provenance = makeProvenance({ provenanceId: 'prov-json' });
    const writer = new Kernel({ noLoad: true, useSQLite: false, ...paths });

    writer.learn('kedi hayvandir', { provenance });
    writer.graph.save();

    const reader = new Kernel({ useSQLite: false, ...paths });
    const node = reader.graph.getNode('kedi');
    const edge = reader.graph.getEdge('kedi', 'hayvan', 'tür');

    assert.deepStrictEqual(node.provenance, provenance);
    assert.deepStrictEqual(edge.provenance, provenance);
  });

  it('persists provenance through SQLite save/load roundtrip', (t) => {
    const paths = makePaths('sqlite-roundtrip');
    const provenance = makeProvenance({ provenanceId: 'prov-sqlite' });
    const writer = new Kernel({ noLoad: true, useSQLite: true, ...paths });

    if (writer.graph.getStats().backend !== 'sqlite') {
      return t.skip('better-sqlite3 is unavailable');
    }

    const reader = new Kernel({ useSQLite: true, ...paths });
    t.after(() => {
      writer.graph.close();
      reader.graph.close();
    });

    writer.learn('kedi hayvandir', { provenance });
    writer.graph.save();
    reader.graph.load();

    const node = reader.graph.getNode('kedi');
    const edge = reader.graph.getEdge('kedi', 'hayvan', 'tür');

    assert.deepStrictEqual(node.provenance, provenance);
    assert.deepStrictEqual(edge.provenance, provenance);
  });

  it('throws ProvenanceError in strict mode when provenance is missing', () => {
    const kernel = new Kernel({ noLoad: true, useSQLite: false, strictProvenance: true });

    assert.throws(
      () => kernel.learn('aslan hayvandir'),
      (error) => error instanceof Kernel.ProvenanceError
        && error.code === 'PROVENANCE_REQUIRED'
        && /provenance is required/i.test(error.message),
    );
  });

  it('supports provenance through KernelV2 delegation', () => {
    const provenance = makeProvenance({ provenanceId: 'prov-v2' });
    const kernel = new KernelV2({ noLoad: true, useSQLite: false, ...makePaths('kernel-v2') });

    kernel.learn('kedi hayvandir', { provenance });

    const node = kernel.graph.getNode('kedi');
    const edge = kernel.graph.getEdge('kedi', 'hayvan', 'tür');

    assert.deepStrictEqual(node.provenance, provenance);
    assert.deepStrictEqual(edge.provenance, provenance);
  });
});
