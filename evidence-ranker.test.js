const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WEIGHTS,
  rankEvidence,
  adjustedConfidence,
} = require('./evidence-ranker');

test('WEIGHTS: required evidence types exist', () => {
  assert.deepEqual(Object.keys(WEIGHTS).sort(), [
    'benchmark',
    'blog',
    'chat_memory',
    'docs',
    'experiment',
    'peer_reviewed',
    'replicated',
    'user_experience',
    'user_opinion',
  ]);
});

test('rankEvidence: returns mapped weights', () => {
  assert.equal(rankEvidence('user_opinion'), 0.25);
  assert.equal(rankEvidence('user_experience'), 0.4);
  assert.equal(rankEvidence('chat_memory'), 0.45);
  assert.equal(rankEvidence('blog'), 0.5);
  assert.equal(rankEvidence('docs'), 0.6);
  assert.equal(rankEvidence('benchmark'), 0.7);
  assert.equal(rankEvidence('experiment'), 0.8);
  assert.equal(rankEvidence('peer_reviewed'), 0.9);
  assert.equal(rankEvidence('replicated'), 1.0);
});

test('rankEvidence: unknown type falls back to 0.25', () => {
  assert.equal(rankEvidence('unknown_type'), 0.25);
  assert.equal(rankEvidence(undefined), 0.25);
});

test('adjustedConfidence: multiplies base by type weight', () => {
  assert.equal(adjustedConfidence(0.8, 'docs'), 0.48);
  assert.equal(adjustedConfidence(1, 'replicated'), 1);
});

test('adjustedConfidence: clamps output to [0,1]', () => {
  assert.equal(adjustedConfidence(2, 'replicated'), 1);
  assert.equal(adjustedConfidence(-1, 'replicated'), 0);
});

test('adjustedConfidence: non-numeric base is treated as 0', () => {
  assert.equal(adjustedConfidence('abc', 'docs'), 0);
  assert.equal(adjustedConfidence(null, 'docs'), 0);
});
