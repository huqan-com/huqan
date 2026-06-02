const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  loadTrustPolicy,
  getTrustPolicyVersion,
  getDefaultConfidence,
  applyTrustPolicyToProvenance,
} = require('./trust-policy');

test('loadTrustPolicy loads the default policy file', () => {
  const policy = loadTrustPolicy();
  assert.strictEqual(policy.version, '0.8.0');
  assert.strictEqual(getTrustPolicyVersion(policy), '0.8.0');
});

test('getDefaultConfidence uses subtype and fallback values', () => {
  const policy = loadTrustPolicy();
  assert.strictEqual(getDefaultConfidence('document', '', policy), 0.8);
  assert.strictEqual(getDefaultConfidence('github', 'release_tag', policy), 0.9);
  assert.strictEqual(getDefaultConfidence('unknown-type', '', policy), 0.5);
});

test('applyTrustPolicyToProvenance keeps explicit confidence and fills trustPolicyVersion', () => {
  const policy = loadTrustPolicy();
  const original = {
    sourceType: 'document',
    sourceRef: 'docs/adr.md',
    confidence: 0.77,
  };

  const { provenance, warnings } = applyTrustPolicyToProvenance(original, policy);

  assert.notStrictEqual(provenance, original);
  assert.strictEqual(provenance.confidence, 0.77);
  assert.strictEqual(provenance.trustPolicyVersion, '0.8.0');
  assert.strictEqual(warnings.length, 0);
});

test('applyTrustPolicyToProvenance fills missing confidence and returns warnings', () => {
  const policy = loadTrustPolicy();

  const { provenance, warnings } = applyTrustPolicyToProvenance({
    sourceType: 'document',
    sourceSubType: 'memo',
  }, policy);

  assert.strictEqual(provenance.confidence, 0.8);
  assert.strictEqual(provenance.trustPolicyVersion, '0.8.0');
  assert.ok(warnings.some(item => item.includes('confidence auto-filled')));
});

test('loadTrustPolicy accepts custom paths', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-policy-'));
  try {
    const policyPath = path.join(tempDir, 'policy.json');
    fs.writeFileSync(policyPath, JSON.stringify({
      version: '0.8.1',
      defaults: { system: 0.42 },
      fallback: { unknown: 0.11 },
    }));

    const policy = loadTrustPolicy(policyPath);
    assert.strictEqual(policy.version, '0.8.1');
    assert.strictEqual(getDefaultConfidence('system', '', policy), 0.42);
    assert.strictEqual(getDefaultConfidence('missing', '', policy), 0.11);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
