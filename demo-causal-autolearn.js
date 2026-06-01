const { Graph } = require('./graph');
const { CausalSimulator } = require('./causalSimulator');
const { buildCausalSummary } = require('./finalizer');

/**
 * Demo: autoLearn true olursa ne bozulur?
 * 
 * Bu demo, AXIOM'un kendi mimari kararını yargılamasını gösterir.
 * Causal reasoning engine kullanarak "autoLearn default true" kararının
 * olası sonuçlarını simüle eder.
 */

function setupAutoLearnGraph() {
  const graph = new Graph({ noLoad: true });

  // Node'ları ekle
  graph.addNode('autoLearn_default_true', 'autoLearn default true');
  graph.addNode('unsupported_llm_output', 'unsupported LLM output');
  graph.addNode('graph_reliability', 'graph reliability');
  graph.addNode('shield_claim', 'Shield claim');
  graph.addNode('axiom_promise', 'AXIOM promise');

  // Causal relation'ları ekle
  graph.addEdge('autoLearn_default_true', 'unsupported_llm_output', 'CAUSES', {
    strength: 0.9,
    confidence: 0.85,
    evidence: ['shield-policy', 'unsupported-label-rule'],
    sourceType: 'design_decision'
  });

  graph.addEdge('unsupported_llm_output', 'graph_reliability', 'CAUSES', {
    strength: 0.8,
    confidence: 0.75,
    evidence: ['observation', 'data-quality-metrics'],
    sourceType: 'observation'
  });

  graph.addEdge('graph_reliability', 'shield_claim', 'PREVENTS', {
    strength: 0.85,
    confidence: 0.8,
    evidence: ['shield-architecture', 'trust-model'],
    sourceType: 'design_decision'
  });

  graph.addEdge('shield_claim', 'axiom_promise', 'ENABLES', {
    strength: 0.9,
    confidence: 0.85,
    evidence: ['product-vision', 'brand-promise'],
    sourceType: 'design_decision'
  });

  return graph;
}

function runDemo() {
  console.log('=== AXIOM v0.7 Causal Reasoning Demo ===\n');
  console.log('Soru: autoLearn default true olursa ne bozulur?\n');

  const graph = setupAutoLearnGraph();
  const simulator = new CausalSimulator(graph);

  // Simülasyon çalıştır
  const simulation = simulator.simulateChange({
    action: 'autoLearn default true yap',
    nodeId: 'autoLearn_default_true',
    changeType: 'modify',
    maxDepth: 10
  });

  console.log('--- Ham Simülasyon Sonucu ---');
  console.log(JSON.stringify(simulation, null, 2));
  console.log('\n');

  // Finalizer ile özetle
  const summary = buildCausalSummary(simulation);

  console.log('--- Causal Summary ---');
  console.log(`Action: ${summary.action}`);
  console.log(`Node: ${summary.nodeId}`);
  console.log(`Change Type: ${summary.changeType}`);
  console.log(`Confidence: ${(summary.confidence * 100).toFixed(1)}%`);
  console.log(`Causal Chains: ${summary.causalChains}`);
  console.log(`\nOutcomes: ${summary.outcomes.length}`);
  summary.outcomes.forEach((outcome, i) => {
    console.log(`  ${i + 1}. ${outcome.description} (confidence: ${(outcome.confidence * 100).toFixed(1)}%)`);
  });
  console.log(`\nRisks: ${summary.risks.length}`);
  summary.risks.forEach((risk, i) => {
    console.log(`  ${i + 1}. [${risk.severity.toUpperCase()}] ${risk.description}`);
  });
  console.log(`\nSummary: ${summary.summary}`);
  console.log(`\nRecommendation: ${summary.recommendation}`);
  console.log('\n=== Demo Sonu ===');

  return { graph, simulation, summary };
}

// Demo'yu çalıştır
if (require.main === module) {
  try {
    const result = runDemo();
    console.log('\n✅ Demo başarıyla tamamlandı.');
  } catch (error) {
    console.error('\n❌ Demo hatası:', error.message);
    process.exit(1);
  }
}

module.exports = { setupAutoLearnGraph, runDemo };
