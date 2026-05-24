const { describe, it } = require('node:test');
const assert = require('node:assert');
const { evaluateRegression } = require('./check-regression');

describe('benchmark regression checker', () => {
  it('passes when current metrics are under threshold', () => {
    const baseline = {
      version: '2.0.0',
      fixtures: {
        small: { nodes: 5, edges: 4, learn: 10, ask: 2, verify: 2, reason: 2, compare: 2, dream: 5 },
      },
    };
    const current = {
      iterations: 2,
      results: [
        {
          label: 'small',
          nodes: 5,
          edges: 4,
          learn: { avgMs: 12 },
          ask: { avgMs: 2.2 },
          verify: { avgMs: 2.1 },
          reason: { avgMs: 1.9 },
          compare: { avgMs: 1.8 },
          dream: { avgMs: 5.5 },
        },
      ],
    };
    const result = evaluateRegression(baseline, current, { allowedMultiplier: 1.75 });
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.failures, []);
  });

  it('fails when metric exceeds threshold', () => {
    const baseline = {
      fixtures: {
        small: { nodes: 5, edges: 4, learn: 10, ask: 2, verify: 2, reason: 2, compare: 2, dream: 5 },
      },
    };
    const current = {
      results: [
        {
          label: 'small',
          nodes: 5,
          edges: 4,
          learn: { avgMs: 30 },
          ask: { avgMs: 2 },
          verify: { avgMs: 2 },
          reason: { avgMs: 2 },
          compare: { avgMs: 2 },
          dream: { avgMs: 5 },
        },
      ],
    };
    const result = evaluateRegression(baseline, current, { allowedMultiplier: 1.75 });
    assert.strictEqual(result.ok, false);
    assert.ok(result.failures.some(line => line.includes('small.learn')));
  });
});
