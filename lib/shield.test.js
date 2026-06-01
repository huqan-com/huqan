const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyLlmSor, evaluateLlmSor, normalizeCheck } = require('./shield');

function makeKernel(overrides = {}) {
  let saveCalls = 0;
  const learnCalls = [];
  const kernel = {
    verify(text) {
      if (typeof overrides.verify === 'function') return overrides.verify(text);
      return { data: { status: 'bilinmiyor', confidence: 0 } };
    },
    learnFromLLM(text, opts = {}) {
      learnCalls.push({ text, opts });
      if (typeof overrides.learnFromLLM === 'function') return overrides.learnFromLLM(text, opts);
      return { learned: 1, skipped: 0, conflicts: [] };
    },
    graph: {
      save() {
        saveCalls += 1;
      },
    },
  };
  return { kernel, learnCalls, getSaveCalls: () => saveCalls };
}

test('normalizeCheck reads envelope data', () => {
  const normalized = normalizeCheck({ data: { status: 'dogrulandi', confidence: 0.8 } });
  assert.strictEqual(normalized.status, 'dogrulandi');
  assert.strictEqual(normalized.confidence, 0.8);
});

test('classifyLlmSor returns graph-backed, llm-assisted, unsupported, contradicted', () => {
  assert.strictEqual(
    classifyLlmSor({ data: { status: 'dogrulandi', confidence: 0.9 } }, { data: { status: 'dogrulandi', confidence: 0.7 } }),
    'graph-backed',
  );
  assert.strictEqual(
    classifyLlmSor({ data: { status: 'dogrulandi', confidence: 0.9 } }, { data: { status: 'bilinmiyor', confidence: 0 } }),
    'llm-assisted',
  );
  assert.strictEqual(
    classifyLlmSor({ data: { status: 'bilinmiyor', confidence: 0 } }, { data: { status: 'bilinmiyor', confidence: 0 } }),
    'unsupported',
  );
  assert.strictEqual(
    classifyLlmSor({ data: { status: 'celiski', confidence: 0.9 } }, { data: { status: 'dogrulandi', confidence: 0.7 } }),
    'contradicted',
  );
});

test('evaluateLlmSor keeps autoLearn off by default', () => {
  const { kernel, learnCalls, getSaveCalls } = makeKernel({
    verify(text) {
      if (text.includes('question')) return { data: { status: 'dogrulandi', confidence: 0.9 } };
      return { data: { status: 'dogrulandi', confidence: 0.8 } };
    },
  });

  const result = evaluateLlmSor({
    kernel,
    question: 'question',
    llmText: 'answer',
    axiomCheck: { data: { status: 'dogrulandi', confidence: 0.9 } },
    llmCheck: { data: { status: 'dogrulandi', confidence: 0.8 } },
  });

  assert.strictEqual(result.label, 'graph-backed');
  assert.strictEqual(result.shield.autoLearn, false);
  assert.strictEqual(result.shield.shouldLearn, false);
  assert.strictEqual(result.learnResult, null);
  assert.strictEqual(learnCalls.length, 0);
  assert.strictEqual(getSaveCalls(), 0);
});

test('evaluateLlmSor learns only when explicitly enabled and never for unsupported or contradicted', () => {
  const graphBacked = makeKernel({
    verify(text) {
      if (text.includes('question')) return { data: { status: 'dogrulandi', confidence: 0.95 } };
      return { data: { status: 'dogrulandi', confidence: 0.75 } };
    },
  });

  const learned = evaluateLlmSor({
    kernel: graphBacked.kernel,
    question: 'question',
    llmText: 'answer',
    axiomCheck: { data: { status: 'dogrulandi', confidence: 0.95 } },
    llmCheck: { data: { status: 'dogrulandi', confidence: 0.75 } },
    autoLearn: true,
  });
  assert.strictEqual(learned.shield.shouldLearn, true);
  assert.strictEqual(learned.learnResult.learned, 1);
  assert.strictEqual(graphBacked.learnCalls[0].opts.source, 'graph');
  assert.strictEqual(graphBacked.getSaveCalls(), 1);

  const unsupported = makeKernel();
  const unsupportedResult = evaluateLlmSor({
    kernel: unsupported.kernel,
    question: 'question',
    llmText: 'answer',
    axiomCheck: { data: { status: 'bilinmiyor', confidence: 0 } },
    llmCheck: { data: { status: 'bilinmiyor', confidence: 0 } },
    autoLearn: true,
  });
  assert.strictEqual(unsupportedResult.label, 'unsupported');
  assert.strictEqual(unsupportedResult.shield.shouldLearn, false);
  assert.strictEqual(unsupportedResult.learnResult, null);
  assert.strictEqual(unsupported.learnCalls.length, 0);

  const contradicted = makeKernel();
  const contradictedResult = evaluateLlmSor({
    kernel: contradicted.kernel,
    question: 'question',
    llmText: 'answer',
    axiomCheck: { data: { status: 'celiski', confidence: 0.9 } },
    llmCheck: { data: { status: 'dogrulandi', confidence: 0.8 } },
    autoLearn: true,
  });
  assert.strictEqual(contradictedResult.label, 'contradicted');
  assert.strictEqual(contradictedResult.shield.shouldLearn, false);
  assert.strictEqual(contradictedResult.learnResult, null);
  assert.strictEqual(contradicted.learnCalls.length, 0);
});
