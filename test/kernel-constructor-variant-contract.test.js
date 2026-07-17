const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const PackageKernel = require('..');
const Kernel = require('../kernel');
const KernelV2 = require('../kernel.v2');
const CLI = require('../cli');
const { createKernelFromEnv } = require('../mcpServer');

const ENV_KEYS = Object.freeze([
  'AXIOM_KERNEL_VERSION',
  'AXIOM_MEMORY_PATH',
  'AXIOM_DB_PATH',
  'AXIOM_USE_SQLITE',
]);

function captureEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, {
    exists: Object.prototype.hasOwnProperty.call(process.env, key),
    value: process.env[key],
  }]));
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key].exists) process.env[key] = snapshot[key].value;
    else delete process.env[key];
  }
}

function assertEnvMatches(snapshot) {
  for (const key of ENV_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(process.env, key),
      snapshot[key].exists,
      `${key} presence must be restored`,
    );
    assert.equal(process.env[key], snapshot[key].value, `${key} value must be restored`);
  }
}

function applyEnv(overrides) {
  for (const key of ENV_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
}

function makeTempRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `huqan-kernel-variant-${label}-`));
}

function isolatedKernelOptions(root, overrides = {}) {
  return {
    noLoad: true,
    loadPlugins: false,
    useSQLite: false,
    memoryStoreUseSQLite: false,
    memoryPath: path.join(root, 'memory.json'),
    dbPath: path.join(root, 'memory.db'),
    memoryStorePath: path.join(root, 'memory-store.json'),
    memoryStoreDbPath: path.join(root, 'memory-store.db'),
    ...overrides,
  };
}

function closeKernel(instance) {
  if (instance?.graph && typeof instance.graph.close === 'function') instance.graph.close();
}

function createManagedCliKernel({ label, mode = 'options', options = {}, env = {} }) {
  const root = makeTempRoot(label);
  const envBefore = captureEnv();
  const cwdBefore = process.cwd();
  let instance;

  try {
    applyEnv(env);
    process.chdir(root);
    if (mode === 'no-args') instance = CLI.createKernel();
    else if (mode === 'empty-options') instance = CLI.createKernel({});
    else instance = CLI.createKernel(isolatedKernelOptions(root, options));
  } catch (error) {
    closeKernel(instance);
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  } finally {
    process.chdir(cwdBefore);
    restoreEnv(envBefore);
  }

  assertEnvMatches(envBefore);
  return {
    instance,
    dispose() {
      closeKernel(instance);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function createManagedMcpKernel({ label, version }) {
  const root = makeTempRoot(label);
  const envBefore = captureEnv();
  let instance;

  try {
    applyEnv({
      AXIOM_KERNEL_VERSION: version,
      AXIOM_MEMORY_PATH: path.join(root, 'memory.json'),
      AXIOM_DB_PATH: path.join(root, 'memory.db'),
      AXIOM_USE_SQLITE: 'false',
    });
    instance = createKernelFromEnv();
  } catch (error) {
    closeKernel(instance);
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  } finally {
    restoreEnv(envBefore);
  }

  assertEnvMatches(envBefore);
  return {
    instance,
    dispose() {
      closeKernel(instance);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test('constructor identity keeps package entry on Kernel v1', { concurrency: false }, () => {
  assert.equal(PackageKernel, Kernel);
  assert.notEqual(KernelV2, Kernel);
  assert.equal(typeof PackageKernel, 'function');
});

test('CLI defaults to Kernel v1 without a variant selector', { concurrency: false }, () => {
  const noArgs = createManagedCliKernel({
    label: 'cli-no-args',
    mode: 'no-args',
    env: { AXIOM_KERNEL_VERSION: undefined },
  });
  const emptyOptions = createManagedCliKernel({
    label: 'cli-empty-options',
    mode: 'empty-options',
    env: { AXIOM_KERNEL_VERSION: undefined },
  });

  try {
    assert.ok(noArgs.instance instanceof Kernel);
    assert.ok(!(noArgs.instance instanceof KernelV2));
    assert.ok(emptyOptions.instance instanceof Kernel);
    assert.ok(!(emptyOptions.instance instanceof KernelV2));
  } finally {
    noArgs.dispose();
    emptyOptions.dispose();
  }
});

test('CLI keeps non-v2 selectors on Kernel v1', { concurrency: false }, () => {
  const envSelected = createManagedCliKernel({
    label: 'cli-env-legacy',
    env: { AXIOM_KERNEL_VERSION: 'legacy' },
  });
  const optionSelected = createManagedCliKernel({
    label: 'cli-option-legacy',
    options: { version: 'legacy' },
    env: { AXIOM_KERNEL_VERSION: undefined },
  });

  try {
    assert.ok(envSelected.instance instanceof Kernel);
    assert.ok(optionSelected.instance instanceof Kernel);
  } finally {
    envSelected.dispose();
    optionSelected.dispose();
  }
});

test('CLI selects KernelV2 only through an explicit v2 selector', { concurrency: false }, () => {
  const optionSelected = createManagedCliKernel({
    label: 'cli-option-v2',
    options: { version: 'v2' },
    env: { AXIOM_KERNEL_VERSION: undefined },
  });
  const envSelected = createManagedCliKernel({
    label: 'cli-env-v2',
    env: { AXIOM_KERNEL_VERSION: 'v2' },
  });

  try {
    assert.ok(optionSelected.instance instanceof KernelV2);
    assert.ok(!(optionSelected.instance instanceof Kernel));
    assert.ok(envSelected.instance instanceof KernelV2);
    assert.ok(!(envSelected.instance instanceof Kernel));
    assert.equal(require('..'), Kernel);
  } finally {
    optionSelected.dispose();
    envSelected.dispose();
  }
});

test('CLI preserves option then environment then v1 selector precedence', { concurrency: false }, () => {
  const optionV2 = createManagedCliKernel({
    label: 'cli-precedence-option-v2',
    options: { version: 'v2' },
    env: { AXIOM_KERNEL_VERSION: 'legacy' },
  });
  const optionLegacy = createManagedCliKernel({
    label: 'cli-precedence-option-legacy',
    options: { version: 'legacy' },
    env: { AXIOM_KERNEL_VERSION: 'v2' },
  });
  const emptyOption = createManagedCliKernel({
    label: 'cli-precedence-empty-option',
    options: { version: '' },
    env: { AXIOM_KERNEL_VERSION: 'v2' },
  });

  try {
    assert.ok(optionV2.instance instanceof KernelV2);
    assert.ok(optionLegacy.instance instanceof Kernel);
    assert.ok(!(optionLegacy.instance instanceof KernelV2));
    assert.ok(emptyOption.instance instanceof KernelV2);
  } finally {
    optionV2.dispose();
    optionLegacy.dispose();
    emptyOption.dispose();
  }
});

test('MCP defaults absent, empty, and non-v2 selectors to Kernel v1', { concurrency: false }, () => {
  const absent = createManagedMcpKernel({ label: 'mcp-absent', version: undefined });
  const empty = createManagedMcpKernel({ label: 'mcp-empty', version: '' });
  const legacy = createManagedMcpKernel({ label: 'mcp-legacy', version: 'legacy' });

  try {
    for (const managed of [absent, empty, legacy]) {
      assert.ok(managed.instance instanceof Kernel);
      assert.ok(!(managed.instance instanceof KernelV2));
    }
  } finally {
    absent.dispose();
    empty.dispose();
    legacy.dispose();
  }
});

test('MCP selects KernelV2 only for exact v2 environment value', { concurrency: false }, () => {
  const managed = createManagedMcpKernel({ label: 'mcp-v2', version: 'v2' });

  try {
    assert.ok(managed.instance instanceof KernelV2);
    assert.ok(!(managed.instance instanceof Kernel));
    assert.equal(require('..'), Kernel);
  } finally {
    managed.dispose();
  }
});

test('environment isolation restores prior presence and values', { concurrency: false }, () => {
  const before = captureEnv();

  try {
    applyEnv({
      AXIOM_KERNEL_VERSION: 'v2',
      AXIOM_MEMORY_PATH: 'temporary-memory.json',
      AXIOM_DB_PATH: 'temporary-memory.db',
      AXIOM_USE_SQLITE: 'false',
    });
    assert.equal(process.env.AXIOM_KERNEL_VERSION, 'v2');
    assert.equal(process.env.AXIOM_MEMORY_PATH, 'temporary-memory.json');
    assert.equal(process.env.AXIOM_DB_PATH, 'temporary-memory.db');
    assert.equal(process.env.AXIOM_USE_SQLITE, 'false');
  } finally {
    restoreEnv(before);
  }

  assertEnvMatches(before);
});
