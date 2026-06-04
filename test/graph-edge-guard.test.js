'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');

const Graph = require('../graph');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-graph-edge-guard-'));

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeGraph(name) {
  return new Graph({
    useSQLite: false,
    memoryPath: path.join(tempDir, `${name}.json`),
  });
}

function assertFinite01(value, label) {
  assert.equal(Number.isFinite(value), true, `${label} must be finite`);
  assert.ok(value >= 0 && value <= 1, `${label} must stay within [0, 1]`);
}

test('addEdge clamps invalid weight and confidence on new causal edges', () => {
  const graph = makeGraph('new-edge');
  graph.addNode('a', 'a', null, { workspaceId: 'default' });
  graph.addNode('b', 'b', null, { workspaceId: 'default' });

  const edge = graph.addEdge('a', 'b', 'CAUSES', {
    workspaceId: 'default',
    strength: 0.7,
    weight: Infinity,
    confidence: NaN,
  });

  assert.ok(edge);
  assertFinite01(edge.weight, 'edge.weight');
  assertFinite01(edge.confidence, 'edge.confidence');
});

test('addEdge clamps invalid weight and confidence when updating an existing edge', () => {
  const graph = makeGraph('existing-edge');
  graph.addNode('c', 'c', null, { workspaceId: 'default' });
  graph.addNode('d', 'd', null, { workspaceId: 'default' });

  const created = graph.addEdge('c', 'd', 'CAUSES', {
    workspaceId: 'default',
    strength: 0.5,
    weight: 0.4,
    confidence: 0.3,
  });
  assert.ok(created);

  const updated = graph.addEdge('c', 'd', 'CAUSES', {
    workspaceId: 'default',
    strength: 0.5,
    weight: -3,
    confidence: Infinity,
  });

  assert.ok(updated);
  assertFinite01(updated.weight, 'updated.weight');
  assertFinite01(updated.confidence, 'updated.confidence');
});
