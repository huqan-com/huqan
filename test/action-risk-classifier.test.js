'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classify,
  ACTION_TYPES,
  RISK_LEVELS,
  DECISIONS,
  POLICY_VERSION,
} = require('../lib/action-risk-classifier');

// ─── Core Tests ───────────────────────────────────────────────────────────────

describe('action-risk-classifier — core', () => {

  it('read_only action is low risk and allowed', () => {
    const result = classify('read_only');
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.READ_ONLY);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.LOW);
    assert.strictEqual(result.decision, DECISIONS.ALLOW);
    assert.strictEqual(result.blocked, false);
    assert.strictEqual(result.requiredReview, false);
  });

  it('file_write action requires review', () => {
    const result = classify('file_write');
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.FILE_WRITE);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.MEDIUM);
    assert.strictEqual(result.decision, DECISIONS.REVIEW);
    assert.strictEqual(result.requiredReview, true);
    assert.strictEqual(result.blocked, false);
  });

  it('tool_execution requires review and does not execute', () => {
    const result = classify('tool_execution');
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.TOOL_EXECUTION);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.HIGH);
    assert.strictEqual(result.decision, DECISIONS.REVIEW);
    assert.strictEqual(result.requiredReview, true);
    assert.ok(!('executed' in result));
    assert.ok(!('executionResult' in result));
  });

  it('deployment is critical and requires human review', () => {
    const result = classify('deployment');
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.DEPLOYMENT);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.CRITICAL);
    assert.strictEqual(result.decision, DECISIONS.HUMAN_REVIEW);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.requiredReview, true);
    assert.ok(result.reasons.some(r => r.includes('human review')));
  });

  it('auto_merge is critical and blocked', () => {
    const result = classify('auto_merge');
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.AUTO_MERGE);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.CRITICAL);
    assert.strictEqual(result.decision, DECISIONS.BLOCK);
    assert.strictEqual(result.blocked, true);
    assert.ok(result.reasons.some(r => r.includes('permanently blocked')));
  });

  it('destructive action is critical and blocked', () => {
    const result = classify('destructive');
    assert.ok(result.ok);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.CRITICAL);
    assert.strictEqual(result.decision, DECISIONS.BLOCK);
    assert.strictEqual(result.blocked, true);
  });

});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('action-risk-classifier — edge cases', () => {

  it('null action does not throw and returns unknown', () => {
    assert.doesNotThrow(() => classify(null));
    const result = classify(null);
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.UNKNOWN);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.HIGH);
  });

  it('undefined action does not throw and returns unknown', () => {
    assert.doesNotThrow(() => classify(undefined));
    const result = classify(undefined);
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.UNKNOWN);
  });

  it('empty object becomes unknown', () => {
    assert.doesNotThrow(() => classify({}));
    const result = classify({});
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.UNKNOWN);
  });

  it('unknown action type is not silently allowed', () => {
    const result = classify('do_something_weird');
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.UNKNOWN);
    assert.notStrictEqual(result.decision, DECISIONS.ALLOW);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.HIGH);
    assert.ok(result.reasons.some(r => r.includes('never silently allowed')));
  });

  it('malformed fields normalize safely', () => {
    assert.doesNotThrow(() => classify(42));
    assert.doesNotThrow(() => classify([]));
    assert.doesNotThrow(() => classify(true));
    assert.doesNotThrow(() => classify({ actionType: 123 }));
    assert.doesNotThrow(() => classify('read_only', null));
    assert.doesNotThrow(() => classify('read_only', 'string-opts'));
    const r = classify({ actionType: 123 });
    assert.strictEqual(r.actionType, ACTION_TYPES.UNKNOWN);
  });

  it('object action with valid actionType is classified correctly', () => {
    const result = classify({ actionType: 'memory_write', reason: 'test run' });
    assert.ok(result.ok);
    assert.strictEqual(result.actionType, ACTION_TYPES.MEMORY_WRITE);
    assert.strictEqual(result.riskLevel, RISK_LEVELS.HIGH);
    assert.strictEqual(result.decision, DECISIONS.REVIEW);
  });

  it('object action with meta is passed through', () => {
    const result = classify({ actionType: 'file_write', meta: { path: '/tmp/test.txt' } });
    assert.strictEqual(result.meta.path, '/tmp/test.txt');
  });

  it('opts.reason is included in reasons array', () => {
    const result = classify('network_access', { reason: 'fetching external data' });
    assert.ok(result.reasons.some(r => r.includes('fetching external data')));
  });

  it('policyVersion is present in all results', () => {
    Object.values(ACTION_TYPES).forEach(t => {
      const r = classify(t);
      assert.strictEqual(r.policyVersion, POLICY_VERSION);
    });
  });

  it('local_analysis is low risk and allowed', () => {
    const result = classify('local_analysis');
    assert.strictEqual(result.riskLevel, RISK_LEVELS.LOW);
    assert.strictEqual(result.decision, DECISIONS.ALLOW);
    assert.strictEqual(result.blocked, false);
  });

  it('test_execution is medium risk and allowed', () => {
    const result = classify('test_execution');
    assert.strictEqual(result.riskLevel, RISK_LEVELS.MEDIUM);
    assert.strictEqual(result.decision, DECISIONS.ALLOW);
    assert.strictEqual(result.blocked, false);
  });

  it('memory_write is high risk and requires review', () => {
    const result = classify('memory_write');
    assert.strictEqual(result.riskLevel, RISK_LEVELS.HIGH);
    assert.strictEqual(result.decision, DECISIONS.REVIEW);
    assert.strictEqual(result.blocked, false);
    assert.strictEqual(result.requiredReview, true);
  });

  it('network_access is high risk and requires review', () => {
    const result = classify('network_access');
    assert.strictEqual(result.riskLevel, RISK_LEVELS.HIGH);
    assert.strictEqual(result.decision, DECISIONS.REVIEW);
    assert.strictEqual(result.requiredReview, true);
  });

  it('case-insensitive normalization works', () => {
    assert.strictEqual(classify('READ_ONLY').actionType, ACTION_TYPES.READ_ONLY);
    assert.strictEqual(classify('File_Write').actionType, ACTION_TYPES.FILE_WRITE);
  });

  it('hyphen-separated action type normalizes correctly', () => {
    const result = classify('file-write');
    assert.strictEqual(result.actionType, ACTION_TYPES.FILE_WRITE);
  });

});
