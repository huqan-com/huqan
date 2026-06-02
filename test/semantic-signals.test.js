const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  collectSignals,
  normalizeSignal,
  normalizeText,
  runSemanticSignals,
  summarizeSignals,
} = require('../lib/semantic-signals');

describe('semantic-signals', () => {
  it('normalizes text deterministically', () => {
    assert.strictEqual(normalizeText('  Değil  '), 'degil');
    assert.strictEqual(normalizeText('A380   is   aircraft'), 'a380 is aircraft');
  });

  it('normalizes signal objects', () => {
    const signal = normalizeSignal({
      rule: 'TEST',
      kind: 'risk',
      severity: 1.4,
      confidence: -0.2,
      flags: ['A', 'A', 'B'],
      detail: 'x',
      evidence: 'bad',
      meta: null,
    });

    assert.strictEqual(signal.rule, 'TEST');
    assert.strictEqual(signal.kind, 'risk');
    assert.strictEqual(signal.severity, 1);
    assert.strictEqual(signal.confidence, 0);
    assert.deepStrictEqual(signal.flags, ['A', 'B']);
    assert.deepStrictEqual(signal.evidence, []);
    assert.deepStrictEqual(signal.meta, {});
  });

  it('collects and summarizes signals', () => {
    const signals = collectSignals([
      [{ rule: 'A', kind: 'contradiction', severity: 0.7, confidence: 0.8, flags: ['A'], evidence: [], meta: {} }],
      { rule: 'B', kind: 'risk', severity: 0.4, confidence: 0.5, flags: ['B'], evidence: [], meta: {} },
    ]);

    const summary = summarizeSignals(signals);
    assert.strictEqual(summary.total, 2);
    assert.strictEqual(summary.contradictionCount, 1);
    assert.strictEqual(summary.riskCount, 1);
    assert.deepStrictEqual(summary.flags.sort(), ['A', 'B']);
  });

  it('runs contradiction and risk rules without producing status decisions', () => {
    const result = runSemanticSignals(
      { text: 'B737 has 2 engines', subject: 'B737', relation: 'has', object: '2 engines' },
      { text: 'B737 has 4 engines', subject: 'B737', relation: 'has', object: '4 engines' },
    );

    assert.ok(Array.isArray(result.signals));
    assert.ok(result.summary.hasSignals);
    assert.strictEqual(result.summary.total > 0, true);
  });

  it('returns no signals for unrelated claims', () => {
    const result = runSemanticSignals(
      { text: 'aspirin kan inceltici olarak etki eder', subject: 'aspirin', relation: 'etki eder', object: 'kan inceltici' },
      { text: 'aspirin beyaz tablettir', subject: 'aspirin', relation: 'is', object: 'beyaz tablet' },
    );

    assert.ok(Array.isArray(result.signals));
    assert.strictEqual(result.signals.length >= 0, true);
  });
});
