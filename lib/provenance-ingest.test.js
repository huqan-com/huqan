const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Kernel = require('../kernel');
const { buildProvenance, ingestWithProvenance } = require('./provenance-ingest');

function tempPaths(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    memoryPath: path.join(dir, 'memory.json'),
    dbPath: path.join(dir, 'memory.db'),
  };
}

test('buildProvenance auto-fills missing fields in non-strict mode', () => {
  const { provenance, warnings } = buildProvenance({
    sourceType: 'document',
    sourceRef: 'docs/adr.md#claim',
  }, {
    strictProvenance: false,
  });

  assert.strictEqual(provenance.sourceType, 'document');
  assert.strictEqual(provenance.confidence, 0.8);
  assert.strictEqual(provenance.trustPolicyVersion, '0.8.0');
  assert.ok(provenance.provenanceId);
  assert.ok(provenance.actor);
  assert.ok(provenance.timestamp);
  assert.ok(provenance.workspaceId);
  assert.ok(warnings.length > 0);
  assert.ok(warnings.some(item => item.includes('confidence auto-filled')));
});

test('buildProvenance uses github subtype defaults', () => {
  const { provenance } = buildProvenance({
    sourceType: 'github',
    sourceSubType: 'release_tag',
    sourceRef: 'github.com/agiulucom42-del/axiom/releases/tag/v0.7.0',
    sourceTitle: 'AXIOM v0.7.0',
  });

  assert.strictEqual(provenance.confidence, 0.9);
  assert.strictEqual(provenance.trustPolicyVersion, '0.8.0');
});

test('buildProvenance preserves explicit confidence and rejects empty strict input', () => {
  const explicit = buildProvenance({
    sourceType: 'user',
    sourceRef: 'user-note',
    confidence: 0.97,
  });
  assert.strictEqual(explicit.provenance.confidence, 0.97);

  assert.throws(() => buildProvenance({}, { strictProvenance: true }), {
    name: 'ProvenanceError',
    code: 'PROVENANCE_REQUIRED',
  });
});

test('ingestWithProvenance writes normalized provenance to nodes and edges', async () => {
  const paths = tempPaths('axiom-prov-memory-');
  try {
    const kernel = new Kernel({ noLoad: true, useSQLite: false, memoryPath: paths.memoryPath });
    const result = await ingestWithProvenance(kernel, {
      text: 'kedi hayvandir',
      provenance: {
        sourceType: 'document',
        sourceRef: 'docs/adr.md#claim',
        sourceTitle: 'Trust Claim',
      },
    });

    assert.strictEqual(result.ok, true);
    assert.ok(result.provenanceWarnings.length > 0);

    const node = kernel.graph.getNode('kedi');
    const edge = kernel.graph.getEdge('kedi', 'hayvan', 'tür');
    assert.strictEqual(node.provenance.trustPolicyVersion, '0.8.0');
    assert.strictEqual(edge.provenance.trustPolicyVersion, '0.8.0');
    assert.strictEqual(node.provenance.confidence, 0.8);
    assert.strictEqual(edge.provenance.confidence, 0.8);
  } finally {
    fs.rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('ingestWithProvenance preserves JSON roundtrip provenance metadata', async () => {
  const paths = tempPaths('axiom-prov-json-');
  try {
    const writer = new Kernel({ noLoad: true, useSQLite: false, memoryPath: paths.memoryPath });
    await ingestWithProvenance(writer, {
      text: 'kedi hayvandir',
      provenance: {
        sourceType: 'document',
        sourceRef: 'docs/adr.md#claim',
        sourceTitle: 'Trust Claim',
      },
    });
    writer.graph.save();

    const reader = new Kernel({ useSQLite: false, memoryPath: paths.memoryPath });
    const node = reader.graph.getNode('kedi');
    const edge = reader.graph.getEdge('kedi', 'hayvan', 'tür');

    assert.strictEqual(node.provenance.trustPolicyVersion, '0.8.0');
    assert.strictEqual(edge.provenance.trustPolicyVersion, '0.8.0');
  } finally {
    fs.rmSync(paths.dir, { recursive: true, force: true });
  }
});

test('ingestWithProvenance preserves SQLite roundtrip provenance metadata', async (t) => {
  const paths = tempPaths('axiom-prov-sqlite-');
  const writer = new Kernel({ noLoad: true, useSQLite: true, memoryPath: paths.memoryPath, dbPath: paths.dbPath });
  if (writer.graph.getStats().backend !== 'sqlite') {
    writer.graph.close();
    fs.rmSync(paths.dir, { recursive: true, force: true });
    return t.skip('better-sqlite3 is unavailable');
  }

  const reader = new Kernel({ useSQLite: true, memoryPath: paths.memoryPath, dbPath: paths.dbPath });
  t.after(() => {
    writer.graph.close();
    reader.graph.close();
    fs.rmSync(paths.dir, { recursive: true, force: true });
  });

  await ingestWithProvenance(writer, {
    text: 'kedi hayvandir',
    provenance: {
      sourceType: 'github',
      sourceSubType: 'release_tag',
      sourceRef: 'github.com/agiulucom42-del/axiom/releases/tag/v0.7.0',
      sourceTitle: 'AXIOM v0.7.0',
    },
  });
  writer.graph.save();
  reader.graph.load();

  const node = reader.graph.getNode('kedi');
  const edge = reader.graph.getEdge('kedi', 'hayvan', 'tür');

  assert.strictEqual(node.provenance.trustPolicyVersion, '0.8.0');
  assert.strictEqual(edge.provenance.trustPolicyVersion, '0.8.0');
  assert.strictEqual(node.provenance.confidence, 0.9);
  assert.strictEqual(edge.provenance.confidence, 0.9);
});
