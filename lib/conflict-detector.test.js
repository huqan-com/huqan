const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Graph = require('../graph');
const Kernel = require('../kernel');
const {
  AUDIT_EVENTS,
} = require('./audit-log');
const {
  CONFLICT_RECOMMENDATIONS,
  CONFLICT_TYPES,
  buildCandidateClaim,
  detectClaimConflict,
  routeCandidateClaim,
} = require('./conflict-detector');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-conflict-'));

test.after(() => {
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
    provenanceId: 'prov-claim-001',
    sourceRef: 'docs/claims.md#1',
    sourceTitle: 'Claims',
    sourceType: 'document',
    actor: 'builder',
    timestamp: '2026-06-02T00:00:00Z',
    confidence: 0.91,
    workspaceId: 'workspace-a',
    trustPolicyVersion: '0.8.0',
    ...overrides,
  };
}

function seedCausalEdge(graph, workspaceId = 'workspace-a') {
  const provenance = makeProvenance({ provenanceId: 'prov-edge-001', workspaceId });
  graph.addNode('fire', 'fire', provenance, { workspaceId });
  graph.addNode('smoke', 'smoke', provenance, { workspaceId });
  graph.addEdge('fire', 'smoke', 'CAUSES', {
    workspaceId,
    provenance,
    strength: 0.9,
    confidence: 0.88,
    source: 'manual',
    sourceRef: provenance.sourceRef,
    evidence: ['fire causes smoke'],
  });
  return provenance;
}

test('buildCandidateClaim normalizes provenance and proposed edge metadata', () => {
  const provenance = makeProvenance({ provenanceId: 'prov-candidate-build', confidence: 0.77 });
  const built = buildCandidateClaim({
    claim: 'fire prevents smoke',
    subject: 'fire',
    relation: 'PREVENTS',
    object: 'smoke',
    provenance,
  }, {
    workspaceId: 'workspace-a',
  });

  assert.ok(built.candidate.candidateId);
  assert.strictEqual(built.candidate.workspaceId, 'workspace-a');
  assert.strictEqual(built.candidate.provenance.provenanceId, provenance.provenanceId);
  assert.strictEqual(built.candidate.provenance.confidence, 0.77);
  assert.strictEqual(built.candidate.provenance.trustPolicyVersion, '0.8.0');
  assert.strictEqual(built.candidate.proposedEdge.from, 'fire');
  assert.strictEqual(built.candidate.proposedEdge.to, 'smoke');
  assert.strictEqual(built.candidate.proposedEdge.relation, 'PREVENTS');
});

test('detectClaimConflict flags contradictory causal claims', () => {
  const graph = new Graph({ noLoad: true, useSQLite: false, ...makePaths('detect-conflict') });
  seedCausalEdge(graph);

  const result = detectClaimConflict(graph, {
    subject: 'fire',
    relation: 'PREVENTS',
    object: 'smoke',
    provenance: makeProvenance({ provenanceId: 'prov-candidate-flag', sourceRef: 'docs/claims.md#2' }),
  }, {
    workspaceId: 'workspace-a',
  });

  assert.strictEqual(result.conflict, true);
  assert.strictEqual(result.type, CONFLICT_TYPES.AGENT_VS_CAUSAL);
  assert.strictEqual(result.recommendation, CONFLICT_RECOMMENDATIONS.FLAG);
  assert.ok(result.existingEvidence.length >= 1);
  assert.strictEqual(result.workspaceId, 'workspace-a');
});

test('routeCandidateClaim quarantines flagged claims and keeps them out of canonical graph', () => {
  const kernel = new Kernel({ noLoad: true, useSQLite: false, ...makePaths('flagged-route') });
  seedCausalEdge(kernel.graph);

  const routed = routeCandidateClaim(kernel, {
    claim: 'fire prevents smoke',
    subject: 'fire',
    relation: 'PREVENTS',
    object: 'smoke',
    provenance: makeProvenance({ provenanceId: 'prov-flagged-route', sourceRef: 'docs/claims.md#3' }),
  }, {
    workspaceId: 'workspace-a',
    reviewedBy: 'reviewer-a',
  });

  assert.strictEqual(routed.candidate.status, 'pending');
  assert.strictEqual(routed.candidate.recommendation, CONFLICT_RECOMMENDATIONS.FLAG);
  assert.strictEqual(routed.conflict.conflict, true);
  assert.strictEqual(kernel.graph.getEdge('fire', 'smoke', 'PREVENTS', 'workspace-a'), null);

  const stored = kernel.graph.getCandidateClaims({ workspaceId: 'workspace-a', candidateId: routed.candidate.candidateId });
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].status, 'pending');
  assert.strictEqual(stored[0].workspaceId, 'workspace-a');

  const conflictEvents = kernel.graph.getAuditEvents({ eventType: AUDIT_EVENTS.CONFLICT_DETECTED, workspaceId: 'workspace-a' });
  const flaggedEvents = kernel.graph.getAuditEvents({ eventType: AUDIT_EVENTS.CLAIM_FLAGGED, workspaceId: 'workspace-a' });
  assert.strictEqual(conflictEvents.length, 1);
  assert.strictEqual(flaggedEvents.length, 1);
});

test('routeCandidateClaim accepts non-conflicting claims into canonical graph', () => {
  const kernel = new Kernel({ noLoad: true, useSQLite: false, ...makePaths('accepted-route') });

  const routed = routeCandidateClaim(kernel, {
    claim: 'kedi hayvandir',
    subject: 'kedi',
    relation: 'tür',
    object: 'hayvan',
    provenance: makeProvenance({ provenanceId: 'prov-accepted-route', sourceRef: 'docs/claims.md#4' }),
  }, {
    workspaceId: 'workspace-a',
    reviewedBy: 'reviewer-a',
  });

  assert.strictEqual(routed.candidate.status, 'accepted');
  assert.strictEqual(routed.candidate.recommendation, CONFLICT_RECOMMENDATIONS.ACCEPT);
  assert.ok(kernel.graph.getEdge('kedi', 'hayvan', 'tür', 'workspace-a'));
  const stored = kernel.graph.getCandidateClaims({ workspaceId: 'workspace-a', candidateId: routed.candidate.candidateId });
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].status, 'accepted');

  const acceptedEvents = kernel.graph.getAuditEvents({ eventType: AUDIT_EVENTS.CLAIM_ACCEPTED, workspaceId: 'workspace-a' });
  assert.strictEqual(acceptedEvents.length, 1);
});

test('routeCandidateClaim enforces strict provenance before writing anything', () => {
  const kernel = new Kernel({ noLoad: true, useSQLite: false, strictProvenance: true, ...makePaths('strict-provenance') });

  assert.throws(() => routeCandidateClaim(kernel, {
    claim: 'kedi hayvandir',
    subject: 'kedi',
    relation: 'tür',
    object: 'hayvan',
  }, {
    workspaceId: 'workspace-a',
    strictProvenance: true,
  }), /provenance is required/i);

  assert.strictEqual(kernel.graph.getCandidateClaims({ workspaceId: 'workspace-a' }).length, 0);
  assert.strictEqual(kernel.graph.getEdges('kedi', 'workspace-a').length, 0);
});

test('candidate claims survive JSON save/load roundtrip', () => {
  const paths = makePaths('json-roundtrip');
  const graph = new Graph({ noLoad: true, useSQLite: false, ...paths });

  const routed = routeCandidateClaim(graph, {
    claim: 'kedi hayvandir',
    subject: 'kedi',
    relation: 'tür',
    object: 'hayvan',
    provenance: makeProvenance({ provenanceId: 'prov-json-candidate', workspaceId: 'workspace-a' }),
  }, {
    workspaceId: 'workspace-a',
  });

  graph.save();

  const reloaded = new Graph({ useSQLite: false, ...paths });
  reloaded.load();

  const claims = reloaded.getCandidateClaims({ workspaceId: 'workspace-a', candidateId: routed.candidate.candidateId });
  assert.strictEqual(claims.length, 1);
  assert.strictEqual(claims[0].status, 'accepted');
  assert.strictEqual(claims[0].provenance.provenanceId, 'prov-json-candidate');
  assert.strictEqual(claims[0].provenance.trustPolicyVersion, '0.8.0');
});

test('candidate claims survive SQLite save/load roundtrip', (t) => {
  const paths = makePaths('sqlite-roundtrip');
  const graph = new Graph({ noLoad: true, useSQLite: true, ...paths });

  if (graph.getStats().backend !== 'sqlite') {
    graph.close();
    return t.skip('better-sqlite3 is unavailable');
  }

  t.after(() => graph.close());

  seedCausalEdge(graph);
  const routed = routeCandidateClaim(graph, {
    claim: 'fire prevents smoke',
    subject: 'fire',
    relation: 'PREVENTS',
    object: 'smoke',
    provenance: makeProvenance({ provenanceId: 'prov-sqlite-candidate', sourceRef: 'docs/claims.md#5' }),
  }, {
    workspaceId: 'workspace-a',
  });

  graph.save();

  const reopened = new Graph({ useSQLite: true, ...paths });
  if (reopened.getStats().backend !== 'sqlite') {
    reopened.close();
    return t.skip('better-sqlite3 reopened backend unavailable');
  }

  t.after(() => reopened.close());
  reopened.load();

  const claims = reopened.getCandidateClaims({ workspaceId: 'workspace-a', candidateId: routed.candidate.candidateId });
  assert.strictEqual(claims.length, 1);
  assert.strictEqual(claims[0].status, 'pending');
  assert.strictEqual(claims[0].provenance.provenanceId, 'prov-sqlite-candidate');
  assert.strictEqual(claims[0].provenance.trustPolicyVersion, '0.8.0');
  assert.strictEqual(reopened.getAuditEvents({ eventType: AUDIT_EVENTS.CLAIM_FLAGGED, workspaceId: 'workspace-a' }).length, 1);
});
