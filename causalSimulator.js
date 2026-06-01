const { Graph, CAUSAL_RELATIONS } = require('./graph');

/**
 * Causal Simulator for v0.7
 * Simulates "what-if" scenarios using causal chains
 */
class CausalSimulator {
  constructor(graph) {
    if (!graph || !(graph instanceof Graph)) {
      throw new Error('CausalSimulator requires a Graph instance');
    }
    this.graph = graph;
  }

  /**
   * Simulate a change and return causal consequences
   * @param {object} opts
   * @param {string} opts.action - Action description
   * @param {string} opts.nodeId - Node to simulate change on
   * @param {string} opts.changeType - Type of change (add, remove, modify)
   * @param {object} opts.newState - New state if modify
   * @param {number} opts.maxDepth - Maximum causal chain depth (default: 10)
   * @returns {object} Simulation result
   */
  simulateChange(opts = {}) {
    const { action, nodeId, changeType, newState, maxDepth = 10 } = opts;
    
    if (!nodeId) {
      throw new Error('simulateChange requires nodeId');
    }

    const node = this.graph._nodes[nodeId];
    if (!node) {
      return {
        ok: false,
        error: `Node '${nodeId}' not found in graph`,
        outcomes: [],
        risks: [],
        confidence: 0,
        causalChains: []
      };
    }

    // Get causal chains from this node
    const causalTraversal = this.graph.getCausalChain(nodeId, maxDepth);
    const causalChains = Array.isArray(causalTraversal)
      ? causalTraversal
      : (causalTraversal && Array.isArray(causalTraversal.chain) ? causalTraversal.chain : []);
    
    // Analyze outcomes and risks
    const outcomes = [];
    const risks = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const chain of causalChains) {
      if (chain.length === 0) continue;
      
      const lastEdge = chain[chain.length - 1];
      const strength = lastEdge.strength || 0.5;
      const confidence = lastEdge.confidence || 0.5;
      
      totalConfidence += confidence;
      confidenceCount++;

      outcomes.push({
        chain: chain.map(e => ({
          from: e.from,
          to: e.to,
          relation: e.relation,
          strength: e.strength,
          confidence: e.confidence
        })),
        impact: strength,
        confidence: confidence,
        description: this._describeChain(chain)
      });

      // High-strength causal relations are risks
      if (strength >= 0.7) {
        risks.push({
          chain: chain.map(e => e.to),
          severity: strength >= 0.9 ? 'critical' : 'high',
          description: `${lastEdge.relation}: ${lastEdge.from} → ${lastEdge.to} (strength: ${strength})`
        });
      }
    }

    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return {
      ok: true,
      action: action || `Simulate change on ${nodeId}`,
      nodeId,
      changeType: changeType || 'unknown',
      outcomes,
      risks,
      confidence: avgConfidence,
      causalChains: causalChains.length,
      traversal: causalTraversal,
      summary: this._generateSummary(outcomes, risks, avgConfidence)
    };
  }

  /**
   * Describe a causal chain in natural language
   * @private
   */
  _describeChain(chain) {
    if (chain.length === 0) return 'No causal chain';
    
    const parts = chain.map(e => {
      const relation = e.relation.toLowerCase().replace('_', ' ');
      return `${e.from} ${relation} ${e.to}`;
    });
    
    return parts.join(' → ');
  }

  /**
   * Generate a summary of the simulation
   * @private
   */
  _generateSummary(outcomes, risks, confidence) {
    const riskCount = risks.length;
    const outcomeCount = outcomes.length;
    
    let summary = `Simulation found ${outcomeCount} causal outcome(s)`;
    if (riskCount > 0) {
      summary += ` with ${riskCount} high-risk consequence(s)`;
    }
    summary += `. Overall confidence: ${(confidence * 100).toFixed(1)}%`;
    
    if (riskCount > 0) {
      const criticalRisks = risks.filter(r => r.severity === 'critical');
      if (criticalRisks.length > 0) {
        summary += `. CRITICAL: ${criticalRisks.length} critical risk(s) detected.`;
      }
    }
    
    return summary;
  }

  /**
   * Get all causal relations in the graph
   */
  getCausalRelations() {
    return this.graph.getCausalRelations();
  }

  /**
   * Check if a relation is causal
   */
  isCausalRelation(relation) {
    return this.graph.isCausalRelation(relation);
  }
}

module.exports = { CausalSimulator };
