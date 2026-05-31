const test = require('node:test');
const assert = require('node:assert/strict');

const Kernel = require('./kernel');

test('defaults: capability map has expected defaults', () => {
  const k = new Kernel({ noLoad: true, loadPlugins: false });
  assert.equal(k.hasCapability('graph'), true);
  assert.equal(k.hasCapability('llm'), true);
  assert.equal(k.hasCapability('contradictionDetection'), true);
  assert.equal(k.hasCapability('temporal'), false);
  assert.equal(k.hasCapability('pluginCapabilities'), false);
  assert.equal(k.hasCapability('evidenceRanking'), false);
  assert.equal(k.hasCapability('agentApi'), false);
  assert.equal(k.hasCapability('companyMode'), false);
  assert.equal(k.hasCapability('discoveryLoop'), false);
});

test('hasCapability: unknown returns false', () => {
  const k = new Kernel({ noLoad: true, loadPlugins: false });
  assert.equal(k.hasCapability('nope'), false);
});

test('enableCapability: toggles known capability', () => {
  const k = new Kernel({ noLoad: true, loadPlugins: false });
  assert.equal(k.enableCapability('temporal'), true);
  assert.equal(k.hasCapability('temporal'), true);
});

test('enableCapability: throws for unknown capability', () => {
  const k = new Kernel({ noLoad: true, loadPlugins: false });
  assert.throws(() => k.enableCapability('unknown-capability'), /Unknown capability/);
});

test('enableCapability: emits capability:enabled event through plugin manager', () => {
  const k = new Kernel({ noLoad: true, loadPlugins: false });
  let received = null;
  k.plugins._handlers['capability:enabled'] = [
    {
      name: 'probe',
      'capability:enabled': (_kernel, payload) => {
        received = payload;
      },
    },
  ];

  k.enableCapability('pluginCapabilities');
  assert.deepEqual(received, { name: 'pluginCapabilities' });
});

test('requireCapability: throws when disabled and passes when enabled', () => {
  const k = new Kernel({ noLoad: true, loadPlugins: false });
  assert.throws(() => k.requireCapability('temporal'), /Required capability is not enabled: temporal/);
  k.enableCapability('temporal');
  assert.equal(k.requireCapability('temporal'), true);
});
