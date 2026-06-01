const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Graph, CAUSAL_RELATIONS, STANDARD_RELATIONS } = require('./graph');

describe('Causal Relations - v0.7', () => {
  it('CAUSAL_RELATIONS sabitleri tanımlı', () => {
    assert.strictEqual(Array.isArray(CAUSAL_RELATIONS), true);
    assert.strictEqual(CAUSAL_RELATIONS.length, 5);
    assert.ok(CAUSAL_RELATIONS.includes('CAUSES'));
    assert.ok(CAUSAL_RELATIONS.includes('PREVENTS'));
    assert.ok(CAUSAL_RELATIONS.includes('ENABLES'));
    assert.ok(CAUSAL_RELATIONS.includes('DEPENDS_ON'));
    assert.ok(CAUSAL_RELATIONS.includes('LEADS_TO'));
  });

  it('STANDARD_RELATIONS causal relations içerir', () => {
    assert.ok(STANDARD_RELATIONS.includes('is_a'));
    assert.ok(STANDARD_RELATIONS.includes('has_property'));
    assert.ok(STANDARD_RELATIONS.includes('related_to'));
    CAUSAL_RELATIONS.forEach(rel => {
      assert.ok(STANDARD_RELATIONS.includes(rel));
    });
  });

  it('isCausalRelation doğru tanımları tespit eder', () => {
    const graph = new Graph({ noLoad: true });
    assert.strictEqual(graph.isCausalRelation('CAUSES'), true);
    assert.strictEqual(graph.isCausalRelation('PREVENTS'), true);
    assert.strictEqual(graph.isCausalRelation('ENABLES'), true);
    assert.strictEqual(graph.isCausalRelation('DEPENDS_ON'), true);
    assert.strictEqual(graph.isCausalRelation('LEADS_TO'), true);
    assert.strictEqual(graph.isCausalRelation('is_a'), false);
    assert.strictEqual(graph.isCausalRelation('has_property'), false);
  });

  it('getCausalRelations tüm causal relations döndürür', () => {
    const graph = new Graph({ noLoad: true });
    const relations = graph.getCausalRelations();
    assert.strictEqual(Array.isArray(relations), true);
    assert.strictEqual(relations.length, 5);
    // CAUSAL_RELATIONS Object.freeze olduğu için sort yapamayız, manuel kontrol
    CAUSAL_RELATIONS.forEach(rel => {
      assert.ok(relations.includes(rel));
    });
  });

  it('causal relation strength field zorunludur', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('node1', 'Node 1');
    graph.addNode('node2', 'Node 2');

    // Strength olmadan hata vermelidir
    assert.throws(() => {
      graph.addEdge('node1', 'node2', 'CAUSES', { weight: 0.8 });
    }, /Causal relation 'CAUSES' requires strength field/);

    // Strength ile çalışmalıdır
    const edge = graph.addEdge('node1', 'node2', 'CAUSES', { 
      strength: 0.8,
      weight: 0.7,
      confidence: 0.75
    });
    assert.ok(edge);
    assert.strictEqual(edge.strength, 0.8);
  });

  it('causal relation strength 0-1 arası olmalıdır', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('node1', 'Node 1');
    graph.addNode('node2', 'Node 2');

    assert.throws(() => {
      graph.addEdge('node1', 'node2', 'CAUSES', { strength: -0.5 });
    }, /Causal relation 'CAUSES' requires strength between 0 and 1/);

    assert.throws(() => {
      graph.addEdge('node1', 'node2', 'CAUSES', { strength: 1.5 });
    }, /Causal relation 'CAUSES' requires strength between 0 and 1/);
  });

  it('standart relation için strength zorunlu değildir', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('node1', 'Node 1');
    graph.addNode('node2', 'Node 2');

    const edge = graph.addEdge('node1', 'node2', 'is_a', { weight: 0.8 });
    assert.ok(edge);
    assert.strictEqual(edge.strength, undefined);
  });

  it('getCausalEdges sadece causal relations filtreler', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('node1', 'Node 1');
    graph.addNode('node2', 'Node 2');
    graph.addNode('node3', 'Node 3');

    graph.addEdge('node1', 'node2', 'CAUSES', { strength: 0.8 });
    graph.addEdge('node1', 'node3', 'is_a', { weight: 0.7 });
    graph.addEdge('node2', 'node3', 'PREVENTS', { strength: 0.6 });

    const causalEdges = graph.getCausalEdges('node1');
    assert.strictEqual(causalEdges.length, 1);
    assert.strictEqual(causalEdges[0].relation, 'CAUSES');
  });

  it('getCausalChain basit causal zinciri çıkarır', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');
    graph.addNode('C', 'C');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8, confidence: 0.75 });
    graph.addEdge('B', 'C', 'CAUSES', { strength: 0.7, confidence: 0.65 });

    const chain = graph.getCausalChain('A');
    assert.strictEqual(chain.length, 2);
    
    // İlk zincir: A -> B
    assert.strictEqual(chain[0].length, 1);
    assert.strictEqual(chain[0][0].from, 'A');
    assert.strictEqual(chain[0][0].to, 'B');
    assert.strictEqual(chain[0][0].relation, 'CAUSES');
    assert.strictEqual(chain[0][0].strength, 0.8);
    
    // İkinci zincir: A -> B -> C
    assert.strictEqual(chain[1].length, 2);
    assert.strictEqual(chain[1][0].from, 'A');
    assert.strictEqual(chain[1][0].to, 'B');
    assert.strictEqual(chain[1][1].from, 'B');
    assert.strictEqual(chain[1][1].to, 'C');
  });

  it('getCausalChain maxDepth ile sınırlanır', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');
    graph.addNode('C', 'C');
    graph.addNode('D', 'D');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8 });
    graph.addEdge('B', 'C', 'CAUSES', { strength: 0.7 });
    graph.addEdge('C', 'D', 'CAUSES', { strength: 0.6 });

    const chain = graph.getCausalChain('A', 2);
    // Max depth 2 olduğu için A->B->C kadar gider, D'ye ulaşamaz
    assert.ok(chain.length > 0);
    // En uzun zincir 2 adımdan uzun olmamalı
    for (const path of chain) {
      assert.ok(path.length <= 2);
    }
  });

  it('getCausalChain causal loop tespiti yapar', () => {
    const graph = new Graph({ noLoad: true });
    graph.addNode('A', 'A');
    graph.addNode('B', 'B');
    graph.addNode('C', 'C');

    graph.addEdge('A', 'B', 'CAUSES', { strength: 0.8 });
    graph.addEdge('B', 'C', 'CAUSES', { strength: 0.7 });
    graph.addEdge('C', 'A', 'CAUSES', { strength: 0.6 }); // Loop

    const chain = graph.getCausalChain('A');
    // Loop tespiti için visited set kullanılır, sonsuz döngü olmamalı
    assert.ok(chain.length > 0);
    assert.ok(chain.length < 10); // Sonsuz döngü değil
  });
});
