const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Graph } = require('./graph');
const { CausalSimulator } = require('./causalSimulator');

describe('Causal Simulator - v0.7', () => {
  it('CausalSimulator graph instance gerektirir', () => {
    assert.throws(() => {
      new CausalSimulator(null);
    }, /CausalSimulator requires a Graph instance/);

    assert.throws(() => {
      new CausalSimulator({});
    }, /CausalSimulator requires a Graph instance/);

    const graph = new Graph({ noLoad: true });
    const simulator = new CausalSimulator(graph);
    assert.ok(simulator);
  });

  it('simulateChange nodeId gerektirir', () => {
    const graph = new Graph({ noLoad: true });
    const simulator = new CausalSimulator(graph);

    assert.throws(() => {
      simulator.simulateChange({});
    }, /simulateChange requires nodeId/);
  });

  it('simulateChange olmayan node için hata döndürür', () => {
    const graph = new Graph({ noLoad: true });
    const simulator = new CausalSimulator(graph);

    const result = simulator.simulateChange({ nodeId: 'nonexistent' });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('not found'));
  });

  it('simulateChange basit causal chain simüle eder', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');
    graph.addNode('C', 'C');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8, confidence: 0.75 });
    graph.addEdge('B', 'C', 'CAUSES', { strength: 0.7, confidence: 0.65 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ 
      nodeId: 'A',
      action: 'Test change on A'
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.nodeId, 'A');
    assert.strictEqual(result.action, 'Test change on A');
    assert.ok(result.outcomes.length > 0);
    assert.ok(result.causalChains > 0);
    assert.ok(result.confidence > 0);
    assert.ok(result.summary);
  });

  it('simulateChange yüksek strength risk olarak işaretler', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.9, confidence: 0.85 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ nodeId: 'A' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.risks.length, 1);
    assert.strictEqual(result.risks[0].severity, 'critical');
    assert.ok(result.summary.includes('critical'));
  });

  it('simulateChange orta strength risk olarak işaretler', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.75, confidence: 0.7 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ nodeId: 'A' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.risks.length, 1);
    assert.strictEqual(result.risks[0].severity, 'high');
  });

  it('simulateChange düşük strength risk olarak işaretlemez', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.5, confidence: 0.5 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ nodeId: 'A' });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.risks.length, 0);
  });

  it('simulateChange maxDepth ile sınırlanır', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');
    graph.addNode('C', 'C');
    graph.addNode('D', 'D');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8 });
    graph.addEdge('B', 'C', 'CAUSES', { strength: 0.7 });
    graph.addEdge('C', 'D', 'CAUSES', { strength: 0.6 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ nodeId: 'A', maxDepth: 2 });

    assert.strictEqual(result.ok, true);
    // Max depth 2 olduğu için D'ye kadar olan zincirler tamamlanmamalı
    assert.ok(result.outcomes.length > 0);
  });

  it('simulateChange confidence ortalamasını hesaplar', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');
    graph.addNode('C', 'C');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8, confidence: 0.75 });
    graph.addEdge('B', 'C', 'CAUSES', { strength: 0.7, confidence: 0.65 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ nodeId: 'A' });

    assert.strictEqual(result.ok, true);
    // Ortalama confidence (0.75 + 0.65) / 2 = 0.70 civarı
    assert.ok(result.confidence > 0.6);
    assert.ok(result.confidence < 0.8);
  });

  it('getCausalRelations graph metodunu çağırır', () => {
    const graph = new Graph({ noLoad: true });
    const simulator = new CausalSimulator(graph);

    const relations = simulator.getCausalRelations();
    assert.strictEqual(Array.isArray(relations), true);
    assert.strictEqual(relations.length, 5);
  });

  it('isCausalRelation graph metodunu çağırır', () => {
    const graph = new Graph({ noLoad: true });
    const simulator = new CausalSimulator(graph);

    assert.strictEqual(simulator.isCausalRelation('CAUSES'), true);
    assert.strictEqual(simulator.isCausalRelation('is_a'), false);
  });

  it('simulateChange outcomes chain description içerir', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8, confidence: 0.75 });

    const simulator = new CausalSimulator(graph);
    const result = simulator.simulateChange({ nodeId: 'A' });

    assert.strictEqual(result.ok, true);
    assert.ok(result.outcomes.length > 0);
    assert.ok(result.outcomes[0].description);
    assert.ok(result.outcomes[0].description.includes('A'));
    assert.ok(result.outcomes[0].description.includes('B'));
  });
});
