'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const PluginManager = require('../plugin.js');

function makeTmpPluginDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'huqan-plugin-test-'));

  fs.writeFileSync(path.join(dir, 'valid-plugin.js'), `
module.exports = {
  name: 'valid-plugin',
  version: '1.0.0',
};
`);

  // Should be ignored — lowercase
  fs.writeFileSync(path.join(dir, 'sample.test.js'), `
const { test } = require('node:test');
test('SHOULD NOT RUN during plugin load', () => {
  throw new Error('test file was loaded as plugin');
});
module.exports = { name: 'sample-test-plugin' };
`);

  // Should be ignored — lowercase
  fs.writeFileSync(path.join(dir, 'sample.spec.js'), `
const { test } = require('node:test');
test('SHOULD NOT RUN during plugin load', () => {
  throw new Error('spec file was loaded as plugin');
});
module.exports = { name: 'sample-spec-plugin' };
`);

  // Should be ignored — uppercase (Windows case-insensitive filesystem risk)
  fs.writeFileSync(path.join(dir, 'SAMPLE.TEST.js'), `
module.exports = { name: 'upper-test-plugin' };
`);

  // Should be ignored — uppercase
  fs.writeFileSync(path.join(dir, 'SAMPLE.SPEC.js'), `
module.exports = { name: 'upper-spec-plugin' };
`);

  // Should be ignored — mixed case
  fs.writeFileSync(path.join(dir, 'sample.Test.js'), `
module.exports = { name: 'mixed-test-plugin' };
`);

  // Should be ignored — mixed case
  fs.writeFileSync(path.join(dir, 'sample.Spec.js'), `
module.exports = { name: 'mixed-spec-plugin' };
`);

  return dir;
}

test('plugin loader ignores .test.js files', () => {
  const dir = makeTmpPluginDir();
  try {
    const pm = new PluginManager({ hasCapability: () => false });
    const loaded = [];
    const origRegister = pm.register.bind(pm);
    pm.register = (plugin) => { loaded.push(plugin.name); origRegister(plugin); };
    pm.load(dir);
    assert.ok(!loaded.includes('sample-test-plugin'), '.test.js must not be loaded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('plugin loader ignores .spec.js files', () => {
  const dir = makeTmpPluginDir();
  try {
    const pm = new PluginManager({ hasCapability: () => false });
    const loaded = [];
    const origRegister = pm.register.bind(pm);
    pm.register = (plugin) => { loaded.push(plugin.name); origRegister(plugin); };
    pm.load(dir);
    assert.ok(!loaded.includes('sample-spec-plugin'), '.spec.js must not be loaded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('plugin loader ignores uppercase .TEST.js and .SPEC.js files', () => {
  const dir = makeTmpPluginDir();
  try {
    const pm = new PluginManager({ hasCapability: () => false });
    const loaded = [];
    const origRegister = pm.register.bind(pm);
    pm.register = (plugin) => { loaded.push(plugin.name); origRegister(plugin); };
    pm.load(dir);
    assert.ok(!loaded.includes('upper-test-plugin'), 'SAMPLE.TEST.js must not be loaded');
    assert.ok(!loaded.includes('upper-spec-plugin'), 'SAMPLE.SPEC.js must not be loaded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('plugin loader ignores mixed-case .Test.js and .Spec.js files', () => {
  const dir = makeTmpPluginDir();
  try {
    const pm = new PluginManager({ hasCapability: () => false });
    const loaded = [];
    const origRegister = pm.register.bind(pm);
    pm.register = (plugin) => { loaded.push(plugin.name); origRegister(plugin); };
    pm.load(dir);
    assert.ok(!loaded.includes('mixed-test-plugin'), 'sample.Test.js must not be loaded');
    assert.ok(!loaded.includes('mixed-spec-plugin'), 'sample.Spec.js must not be loaded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('plugin loader still loads valid .js plugins', () => {
  const dir = makeTmpPluginDir();
  try {
    const pm = new PluginManager({ hasCapability: () => false });
    const loaded = [];
    const origRegister = pm.register.bind(pm);
    pm.register = (plugin) => { loaded.push(plugin.name); origRegister(plugin); };
    pm.load(dir);
    assert.ok(loaded.includes('valid-plugin'), 'valid plugin must be loaded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('plugin loader does not emit TAP output when test/spec files are present', (t) => {
  const dir = makeTmpPluginDir();
  const tapLines = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    if (str.startsWith('TAP') || str.startsWith('# Subtest') || str.startsWith('ok ')) {
      tapLines.push(str.trim());
    }
    return origWrite(chunk, ...args);
  };
  try {
    const pm = new PluginManager({ hasCapability: () => false });
    pm.load(dir);
  } finally {
    process.stdout.write = origWrite;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.strictEqual(tapLines.length, 0, `TAP output must not leak: ${tapLines.join(', ')}`);
});
