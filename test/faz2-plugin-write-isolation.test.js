'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Real Kernel instance — tests exercise the actual admission gate, not a mock.
function makeKernel(opts = {}) {
  const Kernel = require('../kernel');
  return new Kernel({ noLoad: true, useSQLite: false, loadPlugins: false, paranoidMode: false, ...opts });
}

function nodeCount(kernel) {
  return Object.keys(kernel.graph._nodes || {}).length;
}

function edgeCount(kernel) {
  return (kernel.graph._edges || []).length;
}

function auditEvents(kernel) {
  return kernel.graph._auditEvents || [];
}

describe('FAZ2-PR4: plugin write isolation (F-003)', () => {
  it('kernel exposes proposeEdge and proposeNode as public methods', () => {
    const kernel = makeKernel();
    assert.strictEqual(typeof kernel.proposeEdge, 'function', 'proposeEdge missing');
    assert.strictEqual(typeof kernel.proposeNode, 'function', 'proposeNode missing');
  });

  // ─── proposeEdge ──────────────────────────────────────────────────────────

  it('proposeEdge returns decision/edge/audit object', () => {
    const kernel = makeKernel();
    const result = kernel.proposeEdge('a', 'b', 'relatesTo', { sourceType: 'manual' });
    assert.ok(result && typeof result === 'object', 'result should be an object');
    assert.ok('decision' in result, 'result must have decision field');
    assert.ok('audit' in result, 'result must have audit field');
  });

  it('allow edge proposal writes canonical edge with provenance + LEARN audit', () => {
    const kernel = makeKernel();
    kernel.proposeNode('edge-from', 'edge-from');
    kernel.proposeNode('edge-to', 'edge-to');
    const before = edgeCount(kernel);
    const result = kernel.proposeEdge('edge-from', 'edge-to', 'relatesTo', {
      sourceType: 'manual',
      sourceRef: 'test-ref',
    });
    assert.strictEqual(result.decision, 'allow', `Expected allow, got ${result.decision}`);
    assert.ok(edgeCount(kernel) > before, 'allow must write a canonical edge');
    const written = kernel.graph._edges[kernel.graph._edges.length - 1];
    assert.ok(written.provenance, 'written edge must carry provenance metadata');
    assert.ok(written.source, 'written edge must carry a source');
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'LEARN' && e.targetType === 'background_edge'),
      'allow edge must emit a LEARN audit event'
    );
  });

  it('review edge proposal (approvalRequired) makes NO canonical edge mutation', () => {
    const kernel = makeKernel();
    const before = edgeCount(kernel);
    const result = kernel.proposeEdge('rev-from', 'rev-to', 'relatesTo', {
      sourceType: 'plugin',
      approvalRequired: true,
    });
    assert.notStrictEqual(result.decision, 'allow', 'approval-required edge must not be allowed');
    assert.strictEqual(result.edge, null, 'review edge must not return a written edge');
    assert.strictEqual(edgeCount(kernel), before, 'review edge must not increase canonical edge count');
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'REVIEW' && e.targetType === 'background_edge'),
      'review edge must emit a REVIEW audit event'
    );
  });

  it('rejected edge proposal makes NO canonical edge mutation', () => {
    const kernel = makeKernel();
    const before = edgeCount(kernel);
    const result = kernel.proposeEdge('rej-from', 'rej-to', 'relatesTo', {
      sourceType: 'plugin',
      approvalStatus: 'rejected',
    });
    assert.strictEqual(result.decision, 'reject', `Expected reject, got ${result.decision}`);
    assert.strictEqual(edgeCount(kernel), before, 'reject edge must not increase canonical edge count');
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'REJECT' && e.targetType === 'background_edge'),
      'reject edge must emit a REJECT audit event'
    );
  });

  // ─── proposeNode (the F-003 fix under review) ───────────────────────────────

  it('proposeNode returns decision/node/audit object (admission-aware, not a raw wrapper)', () => {
    const kernel = makeKernel();
    const result = kernel.proposeNode('shape-node', 'Shape Node');
    assert.ok(result && typeof result === 'object', 'proposeNode must return a decision object');
    assert.ok('decision' in result, 'result must have decision field');
    assert.ok('node' in result, 'result must have node field');
    assert.ok('audit' in result, 'result must have audit field');
  });

  it('allow node proposal writes canonical node with provenance + LEARN audit', () => {
    const kernel = makeKernel();
    const before = nodeCount(kernel);
    const result = kernel.proposeNode('allow-node', 'Allow Node', null, {
      sourceType: 'manual',
      sourceRef: 'node-ref',
    });
    assert.strictEqual(result.decision, 'allow', `Expected allow, got ${result.decision}`);
    assert.ok(nodeCount(kernel) > before, 'allow must write a canonical node');
    const written = Object.values(kernel.graph._nodes).find((n) => n.id === 'allow-node');
    assert.ok(written, 'allow node must exist in canonical graph');
    assert.ok(written.provenance, 'written node must carry provenance metadata');
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'LEARN' && e.targetType === 'plugin_node' && e.targetId === 'allow-node'),
      'allow node must emit a LEARN audit event'
    );
  });

  it('review node proposal (approvalRequired) makes NO canonical node mutation', () => {
    const kernel = makeKernel();
    const before = nodeCount(kernel);
    const result = kernel.proposeNode('review-node', 'Review Node', null, {
      sourceType: 'plugin',
      approvalRequired: true,
    });
    assert.notStrictEqual(result.decision, 'allow', 'approval-required node must not be allowed');
    assert.strictEqual(result.node, null, 'review node must not return a written node');
    assert.strictEqual(nodeCount(kernel), before, 'review node must not increase canonical node count');
    assert.strictEqual(
      Object.values(kernel.graph._nodes).find((n) => n.id === 'review-node'),
      undefined,
      'review node must NOT be present in the canonical graph'
    );
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'REVIEW' && e.targetType === 'plugin_node' && e.targetId === 'review-node'),
      'review node must emit a REVIEW audit event'
    );
  });

  it('rejected node proposal makes NO canonical node mutation', () => {
    const kernel = makeKernel();
    const before = nodeCount(kernel);
    const result = kernel.proposeNode('reject-node', 'Reject Node', null, {
      sourceType: 'plugin',
      approvalStatus: 'rejected',
    });
    assert.strictEqual(result.decision, 'reject', `Expected reject, got ${result.decision}`);
    assert.strictEqual(nodeCount(kernel), before, 'reject node must not increase canonical node count');
    assert.strictEqual(
      Object.values(kernel.graph._nodes).find((n) => n.id === 'reject-node'),
      undefined,
      'reject node must NOT be present in the canonical graph'
    );
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'REJECT' && e.targetType === 'plugin_node' && e.targetId === 'reject-node'),
      'reject node must emit a REJECT audit event'
    );
  });

  // ─── real plugin write paths ────────────────────────────────────────────────

  it('company-brain run() routes writes through admission-aware proposeNode/proposeEdge', async () => {
    const companyBrain = require('../plugins/company-brain');
    const kernel = makeKernel();
    const nodeCalls = [];
    const edgeCalls = [];
    const origNode = kernel.proposeNode.bind(kernel);
    const origEdge = kernel.proposeEdge.bind(kernel);
    kernel.proposeNode = (...args) => { nodeCalls.push(args[0]); return origNode(...args); };
    kernel.proposeEdge = (...args) => { edgeCalls.push(args[2]); return origEdge(...args); };

    const nodesBefore = nodeCount(kernel);
    const edgesBefore = edgeCount(kernel);
    const res = await companyBrain.run(kernel, {
      action: 'manual',
      text: 'AXIOM bir grafik motorudur',
      author: 'tester',
    });

    assert.equal(res.ok, true, `company-brain manual ingest should succeed: ${JSON.stringify(res)}`);
    assert.ok(nodeCalls.length > 0, 'company-brain must write nodes via kernel.proposeNode');
    assert.ok(edgeCalls.length > 0, 'company-brain must write edges via kernel.proposeEdge');
    assert.ok(nodeCount(kernel) > nodesBefore, 'company-brain allow path must add canonical nodes');
    assert.ok(edgeCount(kernel) > edgesBefore, 'company-brain allow path must add canonical edges');
    assert.ok(
      auditEvents(kernel).some((e) => e.eventType === 'LEARN' && e.targetType === 'plugin_node'),
      'company-brain node writes must be audited (LEARN/plugin_node)'
    );
  });

  it('repo-memory run() routes github ingest through admission-aware proposeNode/proposeEdge', async () => {
    const repoMemory = require('../plugins/repo-memory');
    const kernel = makeKernel();
    const nodeCalls = [];
    const edgeCalls = [];
    const origNode = kernel.proposeNode.bind(kernel);
    const origEdge = kernel.proposeEdge.bind(kernel);
    kernel.proposeNode = (...args) => { nodeCalls.push(args[0]); return origNode(...args); };
    kernel.proposeEdge = (...args) => { edgeCalls.push(args[2]); return origEdge(...args); };

    const nodesBefore = nodeCount(kernel);
    const edgesBefore = edgeCount(kernel);
    const res = await repoMemory.run(kernel, {
      action: 'ingest',
      sourceType: 'github',
      repoUrl: 'https://github.com/owner/repo',
      workspaceId: 'default',
      actor: 'connector-bot',
      fetchRepoFiles: async () => [{
        owner: 'owner', repo: 'repo', branch: 'main',
        path: 'docs/claim.md', content: '# Claim\nHello world',
        lastModified: '2026-01-01T00:00:00Z',
      }],
      parseRepoUrl: () => ({ owner: 'owner', repo: 'repo' }),
    });

    assert.equal(res.ok, true, `repo-memory github ingest should succeed: ${JSON.stringify(res)}`);
    assert.ok(nodeCalls.includes('repo:owner/repo'), 'repo-memory must write the repo node via kernel.proposeNode');
    assert.ok(edgeCalls.length > 0, 'repo-memory must write edges via kernel.proposeEdge');
    assert.ok(nodeCount(kernel) > nodesBefore, 'repo-memory allow path must add canonical nodes');
    assert.ok(edgeCount(kernel) > edgesBefore, 'repo-memory allow path must add canonical edges');
    const repoNode = Object.values(kernel.graph._nodes).find((n) => n.id === 'repo:owner/repo');
    assert.ok(repoNode, 'repo node must be in canonical graph');
    assert.ok(repoNode.provenance && repoNode.provenance.sourceType === 'github',
      'repo node must carry github provenance on the canonical write');
  });

  // ─── forbidden bypass guard ─────────────────────────────────────────────────

  it('neither proposeEdge nor proposeNode uses the forbidden plugin bypass pattern', () => {
    const kernel = makeKernel();
    const captured = [];
    const origEval = kernel._evaluateLearnAdmission.bind(kernel);
    kernel._evaluateLearnAdmission = function (text, opts, provenance, workspaceId) {
      captured.push(opts || {});
      return origEval(text, opts, provenance, workspaceId);
    };

    kernel.proposeEdge('bp-from', 'bp-to', 'rel', { sourceType: 'plugin' });
    kernel.proposeNode('bp-node', 'bp-node', null, { sourceType: 'plugin' });

    assert.ok(captured.length >= 2, 'admission must be evaluated for both edge and node proposals');
    for (const opts of captured) {
      assert.notStrictEqual(opts.admissionRequired, false,
        'admissionRequired:false would arm the forbidden bypass');
      assert.notStrictEqual(opts.admissionBypassReason, 'plugin',
        'admissionBypassReason:"plugin" is the forbidden bypass pattern');
    }
  });

  it('ingest path (lib/ingest.js handleIngest) routes through kernel.runCapability', () => {
    const { handleIngest } = require('../lib/ingest');
    let runCapabilityCalled = false;
    const fakeKernel = {
      runCapability: async () => {
        runCapabilityCalled = true;
        return { ok: true };
      },
    };
    return handleIngest({
      kernel: fakeKernel,
      data: { text: 'AXIOM causes reasoning', author: 'test', sourceType: 'manual' },
    }).then(() => {
      assert.ok(runCapabilityCalled, 'handleIngest must call kernel.runCapability');
    });
  });
});
