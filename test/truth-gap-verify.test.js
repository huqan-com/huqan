'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Kernel = require('../kernel');

test('truth-gap-verify: no evidence returns bilinmiyor', async () => {
  const k = new Kernel();
  const r = await k.verify('XYZ bilinmeyen sey 12345');
  // Current behavior: bilinmiyor — this is CORRECT
  assert.equal(r.data.status, 'bilinmiyor', 'No-evidence claim must return bilinmiyor');
  assert.equal(r.data.confidence, 0, 'No-evidence claim must have zero confidence');
});

test('truth-gap-verify: unsupported claim must not return dogrulandi', async () => {
  const k = new Kernel();
  const r = await k.verify('Bu tamamen uydurma bir ifade 98765');
  // This must NOT return dogrulandi since the fact was never learned
  assert.notEqual(r.data.status, 'dogrulandi', 'Unsupported claim must not be verified');
});

test('truth-gap-verify: contradiction correctly detected but threshold gap', async () => {
  const k = new Kernel();
  await k.learn('Deniz tuzludur');
  const r = await k.verify('Deniz tuzsuzdur');

  // Contradiction IS detected at signal level
  assert.equal(r.meta.semanticTrust.matchType, 'contradiction',
    'Contradiction matchType must be detected');

  // CURRENT GAP: status is bilinmiyor instead of celiski (threshold 0.7 > score 0.6)
  // TODO(PR-TRUTH-1): should return celiski when matchType=contradiction
  console.log('  [GAP] contradiction matchType but status:', r.data.status,
    '(expected celiski, threshold gap)');
});

test('truth-gap-verify: weak partial match must not be verified', async () => {
  const k = new Kernel();
  await k.learn('Deniz tuzludur');
  const r = await k.verify('Bugun hava cok guzel');

  assert.notEqual(r.data.status, 'dogrulandi',
    'Unrelated claim must not be verified');
});

test('truth-gap-verify: known fact returns dogrulandi', async () => {
  const k = new Kernel();
  await k.learn('Deniz tuzludur');
  const r = await k.verify('Deniz tuzludur');

  assert.equal(r.data.status, 'dogrulandi',
    'Known fact must return dogrulandi');
  assert.ok(r.data.confidence >= 0.5,
    'Confidence must be at least 0.5 for direct match');
});
