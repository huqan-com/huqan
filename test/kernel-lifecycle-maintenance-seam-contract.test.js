const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const Graph = require('../graph');
const Kernel = require('../kernel');

function isolatedKernelOptions(root, extra = {}) {
  return {
    loadPlugins: false,
    useSQLite: false,
    memoryStoreUseSQLite: false,
    memoryPath: path.join(root, 'memory.json'),
    dbPath: path.join(root, 'memory.db'),
    memoryStorePath: path.join(root, 'memory-store.json'),
    memoryStoreDbPath: path.join(root, 'memory-store.db'),
    ...extra,
  };
}

function closeKernel(kernel) {
  kernel?.graph?.close?.();
  kernel?.memory?.close?.();
}

test('Kernel constructor performs exactly one default graph load', { concurrency: false }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huqan-kernel-load-'));
  const originalLoad = Graph.prototype.load;
  let loadCalls = 0;
  let kernel;
  Graph.prototype.load = function loadSpy() {
    loadCalls += 1;
    return originalLoad.call(this);
  };
  try {
    kernel = new Kernel(isolatedKernelOptions(root));
    assert.equal(loadCalls, 1);
    assert.ok(kernel.graph);
    assert.ok(kernel.memory);
    assert.ok(kernel.plugins);
  } finally {
    Graph.prototype.load = originalLoad;
    closeKernel(kernel);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Kernel noLoad constructor skips graph load without skipping initialization', { concurrency: false }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'huqan-kernel-no-load-'));
  const originalLoad = Graph.prototype.load;
  let loadCalls = 0;
  let kernel;
  Graph.prototype.load = function loadSpy() {
    loadCalls += 1;
    return originalLoad.call(this);
  };
  try {
    kernel = new Kernel(isolatedKernelOptions(root, { noLoad: true }));
    assert.equal(loadCalls, 0);
    assert.ok(kernel.graph);
    assert.ok(kernel.memory);
    assert.ok(kernel.plugins);
  } finally {
    Graph.prototype.load = originalLoad;
    closeKernel(kernel);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
