'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('truth-gap-connectors: github-adapter is api-wrapper (no graph write)', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'adapters', 'github-adapter.js'), 'utf8');
  const writesGraph = code.includes('addNode') || code.includes('addEdge') || code.includes('graph.');
  assert.equal(writesGraph, false,
    'github-adapter must be classified as api-wrapper (no graph write)');
  console.log('  [GAP] github-adapter: api-wrapper, no graph/provenance/audit');
});

test('truth-gap-connectors: markdown-adapter is api-wrapper (no graph write)', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'adapters', 'markdown-adapter.js'), 'utf8');
  const writesGraph = code.includes('addNode') || code.includes('addEdge') || code.includes('graph.');
  assert.equal(writesGraph, false,
    'markdown-adapter must be classified as api-wrapper');
  console.log('  [GAP] markdown-adapter: api-wrapper, no graph write');
});

test('truth-gap-connectors: llmAdapter is api-wrapper (no graph write)', () => {
  const p = path.join(__dirname, '..', 'llmAdapter.js');
  if (!fs.existsSync(p)) {
    console.log('  [SKIP] llmAdapter.js not found at root level');
    return;
  }
  const code = fs.readFileSync(p, 'utf8');
  const writesGraph = code.includes('addNode') || code.includes('addEdge') || code.includes('graph.');
  assert.equal(writesGraph, false,
    'llmAdapter must be classified as api-wrapper');
});

test('truth-gap-connectors: github-connector writes graph+provenance+audit', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'lib', 'github-connector.js'), 'utf8');
  const writesGraph = code.includes('addNode') || code.includes('addEdge') || code.includes('graph.');
  const writesProvenance = code.includes('provenance') || code.includes('buildProvenance');
  const writesAudit = code.includes('audit') || code.includes('Audit');
  assert.equal(writesGraph, true, 'github-connector must write graph');
  assert.equal(writesProvenance, true, 'github-connector must write provenance');
  assert.equal(writesAudit, true, 'github-connector must write audit');
  console.log('  [OK] github-connector: trust-connected (graph+provenance+audit)');
});

test('truth-gap-connectors: kernel learn builds provenance but does not attach', async () => {
  const Kernel = require('../kernel');
  const k = new Kernel();
  await k.learn('test fact 123');
  const nodes = Object.values(k.graph._nodes);
  const edges = k.graph._edges;
  const nodesWithProvenance = nodes.filter(n => n.provenance);
  const edgesWithProvenance = edges.filter(e => e.provenance);
  assert.equal(nodesWithProvenance.length, 0,
    'Learned nodes must NOT have provenance attached (current gap)');
  // TODO(PR-TRUTH-2): After fix, this should assert >0
  console.log('  [GAP] kernel learn() builds provenance but does not attach to nodes/edges');
});
