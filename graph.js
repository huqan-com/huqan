const fs = require('fs');
const path = require('path');

// SQLite opsiyonel — yoksa JSON fallback
let Database;
try { Database = require('better-sqlite3'); } catch (_) { Database = null; }

class Graph {
  /**
   * @param {object|string} [opts]
   * @param {string}  [opts.memoryPath]      - JSON hafıza dosyası (varsayılan: memory.json)
   * @param {string}  [opts.dbPath]          - SQLite dosyası (varsayılan: memory.db, null = devre dışı)
   * @param {boolean} [opts.useSQLite]       - SQLite kullan (varsayılan: true, eğer better-sqlite3 varsa)
   * @param {number}  [opts.decayLambda]
   * @param {number}  [opts.pruneThreshold]
   */
  constructor(opts) {
    if (typeof opts === 'string') opts = { memoryPath: opts };
    opts = opts || {};
    this.memoryPath = opts.memoryPath || 'memory.json';
    this._embeddingPath = this.memoryPath.replace(/\.json$/, '.embeddings.json');
    this._decayLambda = opts.decayLambda || 0.05;
    this._pruneThreshold = opts.pruneThreshold || 0.01;
    this._nodes = {};
    this._edges = [];
    this._outIndex = new Map();
    this._inIndex = new Map();

    // SQLite kurulumu
    const wantSQLite = opts.useSQLite !== false && Database !== null;
    this._db = null;
    if (wantSQLite) {
      const dbPath = opts.dbPath || this.memoryPath.replace(/\.json$/, '.db');
      try {
        this._db = new Database(dbPath);
        this._initDB();
      } catch (e) {
        console.error('[Graph] SQLite başlatılamadı, JSON fallback:', e.message);
        this._db = null;
      }
    }
  }

  // ─── SQLite şema ──────────────────────────────────────────────────────────

  _initDB() {
    this._db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0.5,
        created INTEGER NOT NULL,
        last_accessed INTEGER NOT NULL,
        vector TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0.5,
        confidence REAL NOT NULL DEFAULT 0.5,
        source TEXT NOT NULL DEFAULT 'manual',
        evidence TEXT NOT NULL DEFAULT '[]',
        created INTEGER NOT NULL,
        UNIQUE(from_id, to_id, relation)
      );
      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to   ON edges(to_id);
    `);

    const edgeColumns = this._db.prepare('PRAGMA table_info(edges)').all().map(c => c.name);
    if (!edgeColumns.includes('confidence')) this._db.exec('ALTER TABLE edges ADD COLUMN confidence REAL NOT NULL DEFAULT 0.5');
    if (!edgeColumns.includes('source')) this._db.exec("ALTER TABLE edges ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
    if (!edgeColumns.includes('evidence')) this._db.exec("ALTER TABLE edges ADD COLUMN evidence TEXT NOT NULL DEFAULT '[]'");

    // Prepared statements
    this._stmts = {
      upsertNode: this._db.prepare(`
        INSERT INTO nodes (id, label, weight, created, last_accessed, vector)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          weight = MIN(1.0, weight + 0.1),
          last_accessed = excluded.last_accessed
      `),
      getNode: this._db.prepare('SELECT * FROM nodes WHERE id = ?'),
      deleteNode: this._db.prepare('DELETE FROM nodes WHERE id = ?'),
      deleteEdgesOf: this._db.prepare('DELETE FROM edges WHERE from_id = ? OR to_id = ?'),
      touchNode: this._db.prepare('UPDATE nodes SET last_accessed = ? WHERE id = ?'),
      upsertEdge: this._db.prepare(`
        INSERT INTO edges (from_id, to_id, relation, weight, confidence, source, evidence, created)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(from_id, to_id, relation) DO UPDATE SET
          weight = excluded.weight,
          confidence = excluded.confidence,
          source = excluded.source,
          evidence = excluded.evidence
      `),
      getEdge: this._db.prepare('SELECT * FROM edges WHERE from_id = ? AND to_id = ? AND relation = ?'),
      getEdges: this._db.prepare('SELECT * FROM edges WHERE from_id = ?'),
      getInEdges: this._db.prepare('SELECT * FROM edges WHERE to_id = ?'),
      pruneEdges: this._db.prepare('DELETE FROM edges WHERE weight < ?'),
      countNodes: this._db.prepare('SELECT COUNT(*) as c FROM nodes'),
      countEdges: this._db.prepare('SELECT COUNT(*) as c FROM edges'),
      allNodes: this._db.prepare('SELECT * FROM nodes'),
      allEdges: this._db.prepare('SELECT * FROM edges'),
      updateEdgeWeight: this._db.prepare('UPDATE edges SET weight = ?, confidence = ?, source = ?, evidence = ? WHERE from_id = ? AND to_id = ? AND relation = ?'),
      updateNodeVector: this._db.prepare('UPDATE nodes SET vector = ? WHERE id = ?'),
    };
  }

  // ─── Node işlemleri ───────────────────────────────────────────────────────

  addNode(id, label) {
    const now = Date.now();
    if (this._db) {
      // SQLite path
      const existing = this._stmts.getNode.get(id);
      const vector = existing ? existing.vector : '{}';
      this._stmts.upsertNode.run(id, label, 0.5, now, now, vector);
      // In-memory sync
      if (this._nodes[id]) {
        this._nodes[id].label = label;
        this._nodes[id].weight = Math.min(1, this._nodes[id].weight + 0.1);
        this._nodes[id].lastAccessed = now;
      } else {
        this._nodes[id] = { id, label, tags: [], vector: {}, weight: 0.5, created: now, lastAccessed: now };
      }
    } else {
      if (this._nodes[id]) {
        this._nodes[id].label = label;
        this._nodes[id].weight = Math.min(1, this._nodes[id].weight + 0.1);
        this._nodes[id].lastAccessed = now;
      } else {
        this._nodes[id] = { id, label, tags: [], vector: {}, weight: 0.5, created: now, lastAccessed: now };
      }
    }
    return this._nodes[id];
  }

  getNode(id) {
    if (!this._nodes[id]) return null;
    this._nodes[id].lastAccessed = Date.now();
    if (this._db) {
      this._stmts.touchNode.run(Date.now(), id);
    }
    return this._nodes[id];
  }

  removeNode(id) {
    if (!this._nodes[id]) return false;
    delete this._nodes[id];
    this._edges = this._edges.filter(e => e.from !== id && e.to !== id);
    this._rebuildIndex();
    if (this._db) {
      this._stmts.deleteEdgesOf.run(id, id);
      this._stmts.deleteNode.run(id);
    }
    return true;
  }

  getWeight(id) {
    if (!this._nodes[id]) return 0;
    const node = this._nodes[id];
    const elapsed = (Date.now() - node.lastAccessed) / 1000;
    const decayed = node.weight * Math.exp(-this._decayLambda * elapsed);
    return Math.max(0, Math.min(1, decayed));
  }

  addTag(nodeId, dim, weight) {
    if (!this._nodes[nodeId]) return;
    const v = this._nodes[nodeId].vector;
    v[dim] = (v[dim] || 0) + weight;
    // SQLite'a vector güncelle (lazy — save() sırasında toplu yazılır)
  }

  // ─── Edge işlemleri ───────────────────────────────────────────────────────

  addEdge(fromId, toId, relation, opts = {}) {
    if (!this._nodes[fromId] || !this._nodes[toId]) return null;
    const existing = this.getEdge(fromId, toId, relation);
    const nextEvidence = Array.isArray(opts.evidence) ? opts.evidence : [];
    if (existing) {
      existing.weight = Math.min(1, opts.weight ?? existing.weight + 0.1);
      existing.confidence = Math.max(existing.confidence ?? existing.weight, opts.confidence ?? existing.confidence ?? existing.weight);
      if (opts.source) existing.source = opts.source;
      existing.evidence = [...new Set([...(existing.evidence || []), ...nextEvidence])];
      if (this._db) {
        this._stmts.updateEdgeWeight.run(
          existing.weight,
          existing.confidence,
          existing.source || 'manual',
          JSON.stringify(existing.evidence || []),
          fromId,
          toId,
          relation
        );
      }
      return existing;
    }
    const edge = {
      from: fromId,
      to: toId,
      relation,
      weight: opts.weight ?? 0.5,
      confidence: opts.confidence ?? opts.weight ?? 0.5,
      source: opts.source || 'manual',
      evidence: nextEvidence,
      created: Date.now(),
    };
    this._edges.push(edge);
    this._indexEdge(edge);
    if (this._db) {
      this._stmts.upsertEdge.run(
        fromId,
        toId,
        relation,
        edge.weight,
        edge.confidence,
        edge.source,
        JSON.stringify(edge.evidence || []),
        edge.created
      );
    }
    return edge;
  }

  getEdge(fromId, toId, relation) {
    const out = this._outIndex.get(fromId);
    if (!out) return null;
    for (const e of out) {
      if (e.to === toId && e.relation === relation) return e;
    }
    return null;
  }

  getEdgesBetween(fromId, toId) {
    const out = this._outIndex.get(fromId) || [];
    return out.filter(e => e.to === toId);
  }

  hasAnyEdge(fromId, toId) {
    return this.getEdgesBetween(fromId, toId).length > 0;
  }

  getEdges(nodeId) {
    return this._outIndex.get(nodeId) || [];
  }

  getInEdges(nodeId) {
    return this._inIndex.get(nodeId) || [];
  }

  query(label) {
    return Object.values(this._nodes).filter(n => n.label === label);
  }

  nodeCount() { return Object.keys(this._nodes).length; }
  edgeCount() { return this._edges.length; }

  cosineSimilarity(aId, bId) {
    const a = this._nodes[aId];
    const b = this._nodes[bId];
    if (!a || !b) return 0;
    const dims = new Set([...Object.keys(a.vector), ...Object.keys(b.vector)]);
    let dot = 0, magA = 0, magB = 0;
    for (const d of dims) {
      const va = a.vector[d] || 0;
      const vb = b.vector[d] || 0;
      dot += va * vb; magA += va * va; magB += vb * vb;
    }
    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag === 0 ? 0 : dot / mag;
  }

  prune(threshold) {
    if (threshold === undefined) threshold = this._pruneThreshold;
    const before = this._edges.length;
    this._edges = this._edges.filter(e => e.weight >= threshold);
    this._rebuildIndex();
    const pruned = before - this._edges.length;
    if (this._db && pruned > 0) {
      this._stmts.pruneEdges.run(threshold);
    }
    return pruned;
  }

  optimize() {
    const now = Date.now();
    let pruned = this.prune();
    const nodeIds = Object.keys(this._nodes);
    let removedNodes = 0;
    for (const id of nodeIds) {
      const node = this._nodes[id];
      const elapsed = (now - node.lastAccessed) / 1000;
      const decayed = node.weight * Math.exp(-this._decayLambda * elapsed);
      const outEdges = this.getEdges(id);
      const inEdges = this.getInEdges(id);
      if (decayed < 0.01 && outEdges.length === 0 && inEdges.length === 0) {
        delete this._nodes[id];
        if (this._db) this._stmts.deleteNode.run(id);
        removedNodes++;
      }
    }
    return { pruned, removedNodes };
  }

  getStats() {
    return {
      nodes: this.nodeCount(),
      edges: this.edgeCount(),
      decayLambda: this._decayLambda,
      backend: this._db ? 'sqlite' : 'json',
    };
  }

  // ─── Kalıcılık ────────────────────────────────────────────────────────────

  _stripEmbeddings() {
    const embeddings = {};
    for (const [id, node] of Object.entries(this._nodes)) {
      if (node.embedding) {
        embeddings[id] = Array.from(node.embedding);
        delete node.embedding;
      }
    }
    return embeddings;
  }

  _restoreEmbeddings(embeddings) {
    for (const [id, vec] of Object.entries(embeddings)) {
      if (this._nodes[id]) {
        this._nodes[id].embedding = new Float64Array(vec);
      }
    }
  }

  save() {
    this.prune();
    const embeddings = this._stripEmbeddings();

    if (this._db) {
      // SQLite: toplu yazma (transaction)
      const saveAll = this._db.transaction(() => {
        for (const node of Object.values(this._nodes)) {
          this._db.prepare(`
            INSERT INTO nodes (id, label, weight, created, last_accessed, vector)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              label = excluded.label,
              weight = excluded.weight,
              last_accessed = excluded.last_accessed,
              vector = excluded.vector
          `).run(
            node.id, node.label, node.weight,
            node.created, node.lastAccessed,
            JSON.stringify(node.vector || {})
          );
        }
        for (const edge of this._edges) {
          this._db.prepare(`
            INSERT INTO edges (from_id, to_id, relation, weight, confidence, source, evidence, created)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(from_id, to_id, relation) DO UPDATE SET
              weight = excluded.weight,
              confidence = excluded.confidence,
              source = excluded.source,
              evidence = excluded.evidence
          `).run(
            edge.from,
            edge.to,
            edge.relation,
            edge.weight,
            edge.confidence ?? edge.weight ?? 0.5,
            edge.source || 'manual',
            JSON.stringify(edge.evidence || []),
            edge.created
          );
        }
      });
      saveAll();
    }

    // JSON de yaz (Rust katmanı ve fallback için)
    const data = { nodes: this._nodes, edges: this._edges };
    fs.writeFileSync(this.memoryPath, JSON.stringify(data));

    // Embedding'leri geri koy
    this._restoreEmbeddings(embeddings);

    // Embedding'leri ayrı dosyaya yaz
    if (Object.keys(embeddings).length > 0) {
      fs.writeFileSync(this._embeddingPath, JSON.stringify(embeddings));
    }
  }

  load() {
    if (this._db) {
      // SQLite'tan yükle
      try {
        const nodes = this._stmts.allNodes.all();
        const edges = this._stmts.allEdges.all();

        if (nodes.length > 0) {
          this._nodes = {};
          for (const row of nodes) {
            this._nodes[row.id] = {
              id: row.id,
              label: row.label,
              weight: row.weight,
              created: row.created,
              lastAccessed: row.last_accessed,
              tags: [],
              vector: JSON.parse(row.vector || '{}'),
            };
          }
          this._edges = edges.map(row => ({
            from: row.from_id,
            to: row.to_id,
            relation: row.relation,
            weight: row.weight,
            confidence: row.confidence ?? row.weight ?? 0.5,
            source: row.source || 'manual',
            evidence: JSON.parse(row.evidence || '[]'),
            created: row.created,
          }));
          this._rebuildIndex();

          // Embedding'leri yükle
          if (fs.existsSync(this._embeddingPath)) {
            try {
              const emb = JSON.parse(fs.readFileSync(this._embeddingPath, 'utf-8'));
              this._restoreEmbeddings(emb);
            } catch (_) {}
          }
          return; // SQLite'tan başarıyla yüklendi
        }
      } catch (e) {
        console.error('[Graph] SQLite yükleme hatası, JSON fallback:', e.message);
      }
    }

    // JSON fallback
    if (!fs.existsSync(this.memoryPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.memoryPath, 'utf-8'));
      this._nodes = data.nodes || {};
      this._edges = (data.edges || []).map(edge => ({
        ...edge,
        confidence: edge.confidence ?? edge.weight ?? 0.5,
        source: edge.source || 'manual',
        evidence: Array.isArray(edge.evidence) ? edge.evidence : [],
      }));
      this._rebuildIndex();

      if (fs.existsSync(this._embeddingPath)) {
        try {
          const emb = JSON.parse(fs.readFileSync(this._embeddingPath, 'utf-8'));
          this._restoreEmbeddings(emb);
        } catch (_) {}
      }

      // JSON'dan yüklendiyse SQLite'a migrate et
      if (this._db && Object.keys(this._nodes).length > 0) {
        this.save(); // SQLite'a yaz
      }
    } catch (e) {
      console.error('Load error:', e.message);
    }
  }

  // ─── Index yönetimi ───────────────────────────────────────────────────────

  _indexEdge(edge) {
    if (!this._outIndex.has(edge.from)) this._outIndex.set(edge.from, []);
    this._outIndex.get(edge.from).push(edge);
    if (!this._inIndex.has(edge.to)) this._inIndex.set(edge.to, []);
    this._inIndex.get(edge.to).push(edge);
  }

  _rebuildIndex() {
    this._outIndex.clear();
    this._inIndex.clear();
    for (const e of this._edges) this._indexEdge(e);
  }

  // ─── Temizlik ─────────────────────────────────────────────────────────────

  close() {
    if (this._db) {
      try { this._db.close(); } catch (_) {}
      this._db = null;
    }
  }
}

module.exports = Graph;
