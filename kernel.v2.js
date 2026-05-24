const Kernel = require('./kernel');

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

function parseSimpleTurkishStatement(statement) {
  const words = normalizeText(statement).split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const subject = words[0];
  const predicate = words.slice(1).join(' ');
  return { subject, predicate };
}

class KernelV2 {
  constructor(opts = {}) {
    this.kernel = opts.kernel instanceof Kernel ? opts.kernel : new Kernel(opts);
  }

  _ok(type, data = null, evidence = [], meta = {}) {
    if (typeof this.kernel._ok === 'function') {
      return this.kernel._ok(type, data, evidence, meta);
    }
    return {
      ok: true,
      type,
      data,
      evidence: Array.isArray(evidence) ? evidence : [],
      error: null,
      meta,
    };
  }

  _fail(type, code, message, meta = {}) {
    if (typeof this.kernel._fail === 'function') {
      return this.kernel._fail(type, code, message, meta);
    }
    return {
      ok: false,
      type,
      data: null,
      evidence: [],
      error: { code, message },
      meta,
    };
  }

  _edgeKey(edge) {
    return `${edge.from}|${edge.relation}|${edge.to}`;
  }

  _markTemporalMetadata(source, learnedAt, beforeEdgeMap) {
    const ts = learnedAt || nowIso();
    for (const edge of this.kernel.graph._edges) {
      const key = this._edgeKey(edge);
      const existed = beforeEdgeMap.has(key);

      if (!existed && !edge.createdAt) edge.createdAt = ts;
      edge.updatedAt = ts;
      if (source) edge.source = source;

      if (!Array.isArray(edge.evidence)) edge.evidence = [];
      if (source && !edge.evidence.includes(`source:${source}`)) {
        edge.evidence.push(`source:${source}`);
      }
    }
  }

  learn(text, opts = {}) {
    const source = opts.source || 'user';
    const learnedAt = opts.learnedAt || nowIso();
    const beforeEdgeMap = new Set(this.kernel.graph._edges.map(e => this._edgeKey(e)));
    const result = this.kernel.learn(text);
    this._markTemporalMetadata(source, learnedAt, beforeEdgeMap);
    return this._ok('learn', result.data, result.evidence, {
      ...result.meta,
      source,
      learnedAt,
    });
  }

  ask(question, opts = {}) {
    const result = this.kernel.ask(question, opts);
    return this._ok('ask', result.data, result.evidence, {
      ...result.meta,
      mode: 'v2',
    });
  }

  _inferTypeChain(subject, target) {
    const edges = this.kernel.graph.getEdges(subject).filter(e => e.relation === 'tür');
    for (const e1 of edges) {
      const level2 = this.kernel.graph.getEdges(e1.to).filter(e => e.relation === 'tür');
      for (const e2 of level2) {
        if (e2.to === target) {
          return [e1, e2];
        }
      }
    }
    return null;
  }

  verify(statement, opts = {}) {
    const base = this.kernel.verify(statement, opts);
    if (base.data.status !== 'bilinmiyor') return base;

    const parsed = parseSimpleTurkishStatement(statement);
    if (!parsed) return base;

    const chain = this._inferTypeChain(parsed.subject, parsed.predicate.replace(/dır|dir|dur|dür|tir|tır|tur|tür$/i, '').trim());
    if (!chain) return base;

    const evidence = chain.map(e => ({
      kind: 'path',
      text: `${e.from} --[${e.relation}]--> ${e.to}`,
      confidence: Math.max(0.4, Math.min(0.9, e.weight || 0.5)),
      nodes: [e.from, e.to],
      edges: [{ from: e.from, to: e.to, relation: e.relation }],
    }));

    return this._ok('verify', {
      status: 'dogrulandi',
      confidence: 0.6,
      inferred: true,
    }, evidence, {
      ...base.meta,
      inferredBy: 'type-chain',
    });
  }

  reason(subject, opts = {}) {
    const result = this.kernel.reason(subject, opts);
    return this._ok('reason', result.data, result.evidence, {
      ...result.meta,
      mode: 'v2',
    });
  }

  compare(left, right, opts = {}) {
    const result = this.kernel.compare(left, right, opts);
    return this._ok('compare', result.data, result.evidence, {
      ...result.meta,
      mode: 'v2',
    });
  }

  dream(opts = {}) {
    const result = this.kernel.dream(opts);
    return this._ok('dream', result.data, result.evidence, {
      ...result.meta,
      mode: 'v2',
    });
  }

  getStats() {
    return this.kernel.graph.getStats();
  }
}

module.exports = KernelV2;
