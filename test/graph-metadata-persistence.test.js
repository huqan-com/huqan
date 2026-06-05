'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const Graph = require('../graph');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-graph-metadata-persistence-'));

after(() => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {
    // Windows can briefly hold SQLite/temp handles open after the test exits.
    // The directory is outside the repo, so a best-effort cleanup is enough.
  }
});

function makeGraph(label, opts = {}) {
  return new Graph({
    memoryPath: path.join(tempDir, `${label}.json`),
    dbPath: path.join(tempDir, `${label}.db`),
    ...opts,
  });
}

function seedGraph(graph, workspaceId = 'default') {
  graph.addNode('b737', 'Boeing 737', { source: 'seed', workspaceId }, { workspaceId });
  graph.addNode('aircraft', 'Aircraft', { source: 'seed', workspaceId }, { workspaceId });

  return graph.addEdge('b737', 'aircraft', 'CAUSES', {
    workspaceId,
    strength: 0.72,
    weight: 0.88,
    confidence: 0.91,
    source: 'learn',
    sourceRef: 'claim-1',
    sessionId: 'session-1',
    evidence: ['seed-fact'],
    evidenceType: 'seed',
    provenance: { source: 'fixture', workspaceId },
    companyMode: true,
    sourceType: 'benchmark',
    meta: {
      entityResolution: {
        canonicalId: 'boeing_737',
        aliases: ['B737', 'Boeing 737'],
        domain: 'aviation',
      },
    },
  });
}

function loadJsonGraph(label) {
  const graph = makeGraph(label, { useSQLite: false });
  graph.load();
  return graph;
}

function readJsonGraphFile(label) {
  return JSON.parse(fs.readFileSync(path.join(tempDir, `${label}.json`), 'utf8'));
}

function writeJsonGraphFile(label, data) {
  fs.writeFileSync(path.join(tempDir, `${label}.json`), JSON.stringify(data));
}

function assertRoundTripEdge(edge, expectedMeta) {
  assert.ok(edge, 'edge must exist after reload');
  assert.deepStrictEqual(edge.meta, expectedMeta);
  assert.equal(edge.source, 'learn');
  assert.equal(edge.source_ref, 'claim-1');
  assert.equal(edge.session_id, 'session-1');
  assert.deepStrictEqual(edge.evidence, ['seed-fact']);
  assert.equal(edge.evidence_type, 'seed');
  assert.equal(edge.company_mode, 1);
  assert.equal(edge.source_type, 'benchmark');
  assert.equal(edge.weight, 0.88);
  assert.equal(edge.confidence, 0.91);
  assert.equal(edge.strength, 0.72);
  assert.deepStrictEqual(edge.provenance, { source: 'fixture', workspaceId: 'default' });
}

test('JSON roundtrip preserves edge.meta.entityResolution and existing edge fields', () => {
  const graph = makeGraph('json-roundtrip', { useSQLite: false });
  seedGraph(graph);
  graph.save();

  const reloaded = loadJsonGraph('json-roundtrip');
  const edge = reloaded.getEdge('b737', 'aircraft', 'CAUSES', 'default');

  assertRoundTripEdge(edge, {
    entityResolution: {
      canonicalId: 'boeing_737',
      aliases: ['B737', 'Boeing 737'],
      domain: 'aviation',
    },
  });

  graph.close();
  reloaded.close();
});

test('old JSON graphs without meta load with empty edge.meta', () => {
  const label = 'old-json';
  const graph = makeGraph(label, { useSQLite: false });
  seedGraph(graph);
  graph.save();

  const data = readJsonGraphFile(label);
  data.edges[0] = { ...data.edges[0] };
  delete data.edges[0].meta;
  writeJsonGraphFile(label, data);

  const reloaded = loadJsonGraph(label);
  const edge = reloaded.getEdge('b737', 'aircraft', 'CAUSES', 'default');

  assert.ok(edge);
  assert.deepStrictEqual(edge.meta, {});

  graph.close();
  reloaded.close();
});

test('malformed JSON edge meta is sanitized away', () => {
  const label = 'malformed-json';
  const graph = makeGraph(label, { useSQLite: false });
  seedGraph(graph);
  graph.save();

  const data = readJsonGraphFile(label);
  data.edges[0] = {
    ...data.edges[0],
    meta: {
      entityResolution: 'not-an-object',
      otherNamespace: { should: 'be-dropped' },
    },
  };
  writeJsonGraphFile(label, data);

  const reloaded = loadJsonGraph(label);
  const edge = reloaded.getEdge('b737', 'aircraft', 'CAUSES', 'default');

  assert.ok(edge);
  assert.deepStrictEqual(edge.meta, {});

  graph.close();
  reloaded.close();
});

test('oversized JSON edge meta is rejected', () => {
  const label = 'oversized-json';
  const graph = makeGraph(label, { useSQLite: false });
  seedGraph(graph);
  graph.save();

  const data = readJsonGraphFile(label);
  data.edges[0] = {
    ...data.edges[0],
    meta: {
      entityResolution: {
        canonicalId: 'boeing_737',
        aliases: ['B737', 'Boeing 737', 'x'.repeat(5000)],
        domain: 'aviation',
      },
    },
  };
  writeJsonGraphFile(label, data);

  const reloaded = loadJsonGraph(label);
  const edge = reloaded.getEdge('b737', 'aircraft', 'CAUSES', 'default');

  assert.ok(edge);
  assert.deepStrictEqual(edge.meta, {});

  graph.close();
  reloaded.close();
});

test('unknown JSON edge meta namespaces are dropped but entityResolution survives', () => {
  const label = 'namespaced-json';
  const graph = makeGraph(label, { useSQLite: false });
  seedGraph(graph);
  graph.save();

  const data = readJsonGraphFile(label);
  data.edges[0] = {
    ...data.edges[0],
    meta: {
      entityResolution: {
        canonicalId: 'boeing_737',
        aliases: ['B737'],
        domain: 'aviation',
      },
      unsupportedNamespace: {
        should: 'be-dropped',
      },
    },
  };
  writeJsonGraphFile(label, data);

  const reloaded = loadJsonGraph(label);
  const edge = reloaded.getEdge('b737', 'aircraft', 'CAUSES', 'default');

  assert.ok(edge);
  assert.deepStrictEqual(edge.meta, {
    entityResolution: {
      canonicalId: 'boeing_737',
      aliases: ['B737'],
      domain: 'aviation',
    },
  });

  graph.close();
  reloaded.close();
});

test('SQLite roundtrip preserves edge.meta.entityResolution and existing edge fields', (t) => {
  const label = 'sqlite-roundtrip';
  const graph = makeGraph(label, { useSQLite: true });
  const stats = graph.getStats();

  if (stats.backend !== 'sqlite') {
    graph.close();
    return t.skip('better-sqlite3 is unavailable');
  }

  seedGraph(graph);
  graph.save();
  graph.close();

  const reloaded = makeGraph(label, { useSQLite: true });
  const reloadedStats = reloaded.getStats();

  if (reloadedStats.backend !== 'sqlite') {
    reloaded.close();
    return t.skip('better-sqlite3 is unavailable on reload');
  }

  reloaded.load();
  const edge = reloaded.getEdge('b737', 'aircraft', 'CAUSES', 'default');

  assertRoundTripEdge(edge, {
    entityResolution: {
      canonicalId: 'boeing_737',
      aliases: ['B737', 'Boeing 737'],
      domain: 'aviation',
    },
  });

  reloaded.close();
});
