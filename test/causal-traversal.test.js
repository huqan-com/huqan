'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  traverseCausalGraph,
} = require('../lib/causal');

function createAdapter(nodes, edges) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  return {
    getNode(id) {
      return nodeMap.get(id) || null;
    },
    getEdges(id) {
      return edges.filter(edge => edge.from === id || edge.fromId === id || edge.from_id === id || edge.source === id);
    },
  };
}

function edge(id, from, to, relation, extra = {}) {
  return {
    id,
    from,
    to,
    relation,
    strength: extra.strength ?? 0.8,
    ...extra,
  };
}

function traversalIds(result) {
  return result.traversal.traversalOrder.map(entry => `${entry.from}->${entry.to}:${entry.relation}:${entry.edgeId || ''}`);
}

test('linear chain traverses in depth order', () => {
  const adapter = createAdapter(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      edge('e1', 'A', 'B', 'CAUSES'),
      edge('e2', 'B', 'C', 'ENABLES'),
    ],
  );

  const result = traverseCausalGraph(adapter, 'A');

  assert.equal(result.traversal.completed, true);
  assert.equal(result.traversal.stopReason, 'terminus');
  assert.deepEqual(traversalIds(result), ['A->B:CAUSES:e1', 'B->C:ENABLES:e2']);
  assert.equal(result.traversal.maxDepthReached, 2);
  assert.equal(result.traversal.visitedEdgeCount, 2);
});

test('branch ordering is deterministic by relation priority and ids', () => {
  const adapter = createAdapter(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }],
    [
      edge('z-edge', 'A', 'F', 'PREVENTS'),
      edge('b-edge', 'A', 'C', 'ENABLES'),
      edge('a-edge', 'A', 'B', 'CAUSES'),
      edge('d-edge', 'A', 'E', 'DEPENDS_ON'),
      edge('c-edge', 'A', 'D', 'LEADS_TO'),
    ],
  );

  const first = traverseCausalGraph(adapter, 'A');
  const second = traverseCausalGraph(adapter, 'A');

  assert.deepEqual(first, second);
  assert.deepEqual(traversalIds(first), [
    'A->B:CAUSES:a-edge',
    'A->C:ENABLES:b-edge',
    'A->D:LEADS_TO:c-edge',
    'A->E:DEPENDS_ON:d-edge',
    'A->F:PREVENTS:z-edge',
  ]);
});

test('maxDepth blocks deeper hops but keeps partial traversal', () => {
  const adapter = createAdapter(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      edge('e1', 'A', 'B', 'CAUSES'),
      edge('e2', 'B', 'C', 'CAUSES'),
    ],
  );

  const result = traverseCausalGraph(adapter, 'A', { maxDepth: 1 });

  assert.equal(result.traversal.completed, false);
  assert.equal(result.traversal.stopReason, 'depth_exceeded');
  assert.deepEqual(result.traversal.stopReasons, ['depth_exceeded']);
  assert.equal(result.traversal.visitedEdgeCount, 1);
  assert.equal(result.traversal.maxDepthReached, 1);
  assert.equal(result.traversal.blockedBranches.length, 1);
  assert.equal(result.traversal.blockedBranches[0].reason, 'depth_exceeded');
});

test('cycle detection is path-local and stops the branch hard', () => {
  const adapter = createAdapter(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      edge('e1', 'A', 'B', 'CAUSES'),
      edge('e2', 'B', 'C', 'CAUSES'),
      edge('e3', 'C', 'A', 'CAUSES'),
    ],
  );

  const result = traverseCausalGraph(adapter, 'A');

  assert.equal(result.traversal.completed, false);
  assert.equal(result.traversal.stopReason, 'cycle_detected');
  assert.deepEqual(result.traversal.stopReasons, ['cycle_detected']);
  assert.deepEqual(result.traversal.cycleNodeIds, ['A']);
  assert.deepEqual(result.traversal.cycleEdgeIds, ['e3']);
  assert.equal(result.traversal.blockedBranches.length, 1);
  assert.equal(result.traversal.blockedBranches[0].reason, 'cycle_detected');
});

test('convergent dag is not treated as a cycle', () => {
  const adapter = createAdapter(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    [
      edge('e1', 'A', 'B', 'CAUSES'),
      edge('e2', 'A', 'C', 'CAUSES'),
      edge('e3', 'B', 'D', 'CAUSES'),
      edge('e4', 'C', 'D', 'CAUSES'),
    ],
  );

  const result = traverseCausalGraph(adapter, 'A');

  assert.equal(result.traversal.stopReason, 'terminus');
  assert.deepEqual(result.traversal.cycleNodeIds, []);
  assert.deepEqual(result.traversal.cycleEdgeIds, []);
  assert.deepEqual(result.traversal.blockedBranches, []);
  assert.equal(result.traversal.visitedEdgeCount, 4);
});

test('missing start produces missing_start without traversal', () => {
  const adapter = createAdapter([], []);

  const result = traverseCausalGraph(adapter, 'A');

  assert.equal(result.traversal.completed, false);
  assert.equal(result.traversal.stopReason, 'missing_start');
  assert.deepEqual(result.traversal.stopReasons, ['missing_start']);
  assert.equal(result.traversal.visitedEdgeCount, 0);
  assert.equal(result.traversal.traversalOrder.length, 0);
});

test('empty graph with a known start terminates cleanly', () => {
  const adapter = createAdapter([{ id: 'A' }], []);

  const result = traverseCausalGraph(adapter, 'A');

  assert.equal(result.traversal.completed, true);
  assert.equal(result.traversal.stopReason, 'terminus');
  assert.equal(result.traversal.visitedEdgeCount, 0);
  assert.equal(result.traversal.traversalOrder.length, 0);
});

test('maxEdges stops traversal globally after the allowed number of edges', () => {
  const adapter = createAdapter(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    [
      edge('e1', 'A', 'B', 'CAUSES'),
      edge('e2', 'A', 'C', 'ENABLES'),
      edge('e3', 'A', 'D', 'LEADS_TO'),
    ],
  );

  const result = traverseCausalGraph(adapter, 'A', { maxEdges: 2 });

  assert.equal(result.traversal.completed, false);
  assert.equal(result.traversal.stopReason, 'max_edges_exceeded');
  assert.deepEqual(result.traversal.stopReasons, ['max_edges_exceeded']);
  assert.equal(result.traversal.visitedEdgeCount, 2);
  assert.equal(result.traversal.blockedBranches.length, 1);
  assert.equal(result.traversal.blockedBranches[0].reason, 'max_edges_exceeded');
});

test('non-causal edges are ignored when only getEdges is available', () => {
  const adapter = {
    getNode(id) {
      return id === 'A' || id === 'B' ? { id } : null;
    },
    getEdges(id) {
      if (id !== 'A') return [];
      return [
        edge('e1', 'A', 'B', 'CAUSES'),
        edge('e2', 'A', 'B', 'related_to'),
      ];
    },
  };

  const result = traverseCausalGraph(adapter, 'A');

  assert.equal(result.traversal.visitedEdgeCount, 1);
  assert.deepEqual(traversalIds(result), ['A->B:CAUSES:e1']);
});
