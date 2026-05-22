const Graph = require('./graph');
const Dream = require('./dream');
const fs = require('fs');
const path = require('path');
const PluginManager = require('./plugin');

let RustGraph;
try { RustGraph = require('./rustGraph'); } catch {}
const RUST_BIN = path.join(__dirname, 'axiom-core', 'target', 'x86_64-pc-windows-gnu', 'release', 'axiom-core.exe');
const hasRust = fs.existsSync(RUST_BIN) && typeof RustGraph !== 'undefined';

// --- Türkçe NLP yardımcıları ---

// Turkish i/ı normalization for stable node ids.
const NORMALIZE_MAP = {
  'ı': 'i', 'İ': 'i', 'I': 'i',
};

// Türkçe çoğul ekleri — normalize etmek için
const PLURAL_SUFFIXES = ['lar', 'ler'];

// Türkçe bağlaçlar ve stop word'ler — öğrenmede görmezden gel
const STOP_WORDS = new Set([
  've', 'veya', 'ile', 'de', 'da', 'ki', 'bu', 'şu', 'o', 'bir',
  'için', 'gibi', 'kadar', 'daha', 'en', 'çok', 'az', 'her', 'hiç',
  'ne', 'nasıl', 'neden', 'niçin', 'nerede', 'kim', 'hangi',
]);

/**
 * Türkçe kelimeyi normalize et:
 * - küçük harf
 * - çoğul ekini kaldır (basit kural)
 */
function normalizeTurkish(word) {
  let w = word.toLowerCase().trim();
  // Normalize dotted-i variants without decomposing other Turkish letters.
  w = w.replace(/i\u0307/g, 'i').replace(/\u0307/g, '');
  w = w.split('').map(c => NORMALIZE_MAP[c] || c).join('');
  // Çoğul eki kaldır (kedi → kedi, kediler → kedi)
  for (const suf of PLURAL_SUFFIXES) {
    if (w.endsWith(suf) && w.length > suf.length + 2) {
      w = w.slice(0, w.length - suf.length);
      break;
    }
  }
  return w;
}

/**
 * Türkçe cümleyi özne + yüklem olarak parse et.
 * Desteklenen formatlar:
 *   "kedi hayvandır"          → özne: kedi, yüklem: hayvandır
 *   "kediler balık yer"       → özne: kedi (normalize), yüklem: balık yer
 *   "kedi bir memelilerdir"   → "bir" atlanır
 *   "kedi ve köpek hayvandır" → iki özne
 */
function parseSentence(text) {
  const raw = text.toLowerCase().trim();
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  // "bir" gibi belirsiz artikelleri atla
  const filtered = words.filter(w => w !== 'bir' && w !== 'de' && w !== 'da');
  if (filtered.length < 2) return null;

  // "X ve Y Zdir" → iki özne
  const veIdx = filtered.indexOf('ve');
  if (veIdx === 1 && filtered.length >= 4) {
    const subjectA = normalizeTurkish(filtered[0]);
    const subjectB = normalizeTurkish(filtered[2]);
    const predicate = filtered.slice(3).join(' ');
    return [
      { subject: subjectA, predicate },
      { subject: subjectB, predicate },
    ];
  }

  const subject = normalizeTurkish(filtered[0]);
  const predicate = filtered.slice(1).join(' ');
  return [{ subject, predicate }];
}

class Kernel {
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.noLoad=false] - true ise memory.json yüklenmez (test için)
   * @param {string}  [opts.memoryPath]   - özel hafıza dosyası yolu
   */
  constructor(opts = {}) {
    this.graph = new Graph(opts.memoryPath ? { memoryPath: opts.memoryPath } : {});
    if (!opts.noLoad) this.graph.load();
    this._rust = hasRust ? new RustGraph() : null;
    this.plugins = new PluginManager(this);
    const pDir = path.join(__dirname, 'plugins');
    if (fs.existsSync(pDir)) this.plugins.load(pDir);
  }

  usePlugin(plugin) {
    this.plugins.register(plugin);
  }

  learn(text) {
    const ev = this.plugins.emit('beforeLearn', { text });
    text = ev.text;

    const parsed = parseSentence(text);
    if (!parsed) return;

    for (const { subject, predicate } of parsed) {
      if (!subject || STOP_WORDS.has(subject)) continue;

      this.graph.addNode(subject, subject);

      const rel = this._parsePredicate(predicate);
      if (rel) {
        const { object, relation } = rel;
        if (!STOP_WORDS.has(object)) {
          this.graph.addNode(object, object);
          this.graph.addEdge(subject, object, relation);
          this.graph.addTag(subject, object, 0.3);
          this._crossLink(subject, object, relation);
        }
      }
    }

    this.plugins.emit('afterLearn', { text });

    // Rust katmanına da öğret — hata sessizce yutulur, JS zaten öğrendi
    if (this._rust) {
      this._rust.learn(text).catch(() => {});
    }
  }

  _parsePredicate(predicate) {
    // "bir" gibi belirsiz artikelleri temizle
    predicate = predicate.replace(/^bir\s+/, '').trim();

    // -dır/-dir/-dur/-dür/-tır/-tir/-tur/-tür → tür ilişkisi
    const tirSuffix = /(dır|dir|dur|dür|tır|tir|tur|tür)$/i;
    if (tirSuffix.test(predicate)) {
      const stem = normalizeTurkish(predicate.replace(tirSuffix, ''));
      return { object: stem, relation: 'tür' };
    }

    // -dır/-dir ekli çok kelimeli yüklem: "doğru düşünme yöntemidir"
    const tirMulti = /^(.+?)(dır|dir|dur|dür|tır|tir|tur|tür)$/i;
    const mMatch = predicate.match(tirMulti);
    if (mMatch && mMatch[1].includes(' ')) {
      return { object: mMatch[1].trim(), relation: 'tür' };
    }

    // Fiil ekleri → yapabilir ilişkisi
    const verbSuffix = /(ar|er|ır|ir|ur|ür|yor|acak|ecek|mak|mek)$/i;
    if (verbSuffix.test(predicate)) {
      return { object: predicate, relation: 'yapabilir' };
    }

    // -r ile biten kısa fiiller
    if (/r$/i.test(predicate) && predicate.length > 2) {
      return { object: predicate, relation: 'yapabilir' };
    }

    // Çok kelimeli yüklem → özellik
    return { object: predicate, relation: 'özellik' };
  }

  _crossLink(subject, object, relation) {
    const subjNode = this.graph.getNode(subject);
    const objNode = this.graph.getNode(object);
    if (!subjNode || !objNode) return;

    for (const tag of Object.keys(subjNode.vector)) {
      if (tag !== object && this.graph.getNode(tag) && objNode.vector[tag]) {
        const existing = this.graph.getEdge(subject, object, 'benzer');
        if (!existing) {
          this.graph.addEdge(subject, object, 'benzer');
        }
      }
    }
  }

  ask(question) {
    const ev = this.plugins.emit('beforeAsk', { question });
    question = ev.question;

    // Soru kelimelerini temizle: "kedi nedir" → "kedi"
    const cleaned = question
      .toLowerCase()
      .trim()
      .replace(/\b(nedir|kimdir|nasıl|nerede|nereden|nereye|niçin|niye|kaç|hangi)\b/gi, '')
      .trim();

    const parts = cleaned.split(/\s+/).filter(Boolean);
    const subject = normalizeTurkish(parts[0] || '');

    const node = this.graph.getNode(subject);
    let answer;
    if (!node) { answer = 'Bilmiyorum'; } else {
      const edges = this.graph.getEdges(subject);
      if (edges.length === 0) { answer = 'Bilmiyorum'; } else {
        const sorted = [...edges].sort((a, b) => b.weight - a.weight);
        const results = [];

        for (const edge of sorted) {
          if (edge.relation === 'tür') {
            if (!results.includes(edge.to)) results.push(edge.to);
            const transitive = this._walkTransitive(edge.to, [], 2);
            for (const t of transitive) {
              if (!results.includes(t)) results.push(t);
            }
          } else if (edge.relation === 'yapabilir') {
            if (!results.includes(edge.to)) results.push(edge.to);
          } else if (!results.includes(edge.to)) {
            results.push(edge.to);
          }
        }

        answer = results.length === 0 ? 'Bilmiyorum' : `${subject} ${results.join(', ')}`;
      }
    }
    this.plugins.emit('afterAsk', { question, answer });
    return answer;
  }

  _walkTransitive(nodeId, visited, depth) {
    if (depth <= 0 || visited.includes(nodeId)) return [];
    visited.push(nodeId);
    const edges = this.graph.getEdges(nodeId);
    const results = [];
    for (const e of edges) {
      if (e.relation === 'tür' && !visited.includes(e.to)) {
        results.push(e.to);
        results.push(...this._walkTransitive(e.to, visited, depth - 1));
      }
    }
    return results;
  }

  contextSimilarity(a, b, context) {
    const ctxWeight = {};
    const ctxNode = this.graph.getNode(context);
    if (ctxNode) {
      for (const [dim, w] of Object.entries(ctxNode.vector)) {
        ctxWeight[dim] = w;
      }
    }

    const aNode = this.graph.getNode(a);
    const bNode = this.graph.getNode(b);
    if (!aNode || !bNode) return 0;

    const dims = new Set([
      ...Object.keys(aNode.vector),
      ...Object.keys(bNode.vector),
      ...Object.keys(ctxWeight),
    ]);

    let dot = 0, magA = 0, magB = 0;
    for (const d of dims) {
      const cw = ctxWeight[d] || 1;
      const va = (aNode.vector[d] || 0) * cw;
      const vb = (bNode.vector[d] || 0) * cw;
      dot += va * vb;
      magA += va * va;
      magB += vb * vb;
    }

    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag === 0 ? 0 : dot / mag;
  }

  entropy() {
    const allNodes = Object.values(this.graph._nodes);
    if (allNodes.length === 0) return 0;
    let totalWeight = 0;
    const weights = [];
    for (const node of allNodes) {
      const edges = this.graph.getEdges(node.id);
      for (const e of edges) {
        weights.push(e.weight);
        totalWeight += e.weight;
      }
    }
    if (totalWeight === 0) return 0;
    let s = 0;
    for (const w of weights) {
      const p = w / totalWeight;
      s -= p * Math.log(p);
    }
    return s;
  }

  detectGaps() {
    const allNodes = Object.values(this.graph._nodes);
    const gaps = [];
    for (const node of allNodes) {
      const edges = this.graph.getEdges(node.id);
      if (edges.length === 0) {
        gaps.push(node.id);
      }
    }
    return gaps;
  }

  reason(subject) {
    const normalized = normalizeTurkish(subject);
    const node = this.graph.getNode(normalized);
    if (!node) return 'Bilmiyorum';

    const ileri = this._forwardChain(normalized, [], new Set(), 4);
    const geri = this._backwardChain(normalized, [], new Set(), 4);
    const cycle = this._detectCycle(normalized, new Set(), []);

    let out = normalized + ':';
    if (ileri.length > 0) out += '\n  neden olur: ' + ileri.map(e => e.to + ' [' + e.relation + ']').join(', ');
    if (geri.length > 0) out += '\n  nedeni: ' + geri.map(e => e.from + ' [' + e.relation + ']').join(', ');
    if (cycle) {
      out += '\n  ⚠ döngü tespit edildi: ' + cycle.join(' → ');
      const nedenOnce = this._resolveCycleOrder(cycle);
      if (nedenOnce) out += '\n  → ilk neden: ' + nedenOnce;
    }
    return out || 'Bilmiyorum';
  }

  compare(a, b) {
    const na = this.graph.getNode(normalizeTurkish(a));
    const nb = this.graph.getNode(normalizeTurkish(b));
    if (!na || !nb) return 'Bilmiyorum';

    const aN = na.id;
    const bN = nb.id;
    const aEdges = this.graph.getEdges(aN);
    const bEdges = this.graph.getEdges(bN);
    const aSet = new Set(aEdges.map(e => e.to + '|' + e.relation));
    const bSet = new Set(bEdges.map(e => e.to + '|' + e.relation));

    const ortak = aEdges.filter(e => bSet.has(e.to + '|' + e.relation));
    const aFark = aEdges.filter(e => !bSet.has(e.to + '|' + e.relation));
    const bFark = bEdges.filter(e => !aSet.has(e.to + '|' + e.relation));

    const foundPath = this._findPath(aN, bN, new Set(), [], 5);

    let out = '📊 ' + aN + ' vs ' + bN + ':';
    if (ortak.length > 0) out += '\n  ortak: ' + ortak.map(e => e.to + ' [' + e.relation + ']').join(', ');
    if (aFark.length > 0) out += '\n  sadece ' + aN + ': ' + aFark.map(e => e.to + ' [' + e.relation + ']').join(', ');
    if (bFark.length > 0) out += '\n  sadece ' + bN + ': ' + bFark.map(e => e.to + ' [' + e.relation + ']').join(', ');
    if (foundPath) out += '\n  bağlantı: ' + foundPath.join(' → ');

    return out;
  }

  _forwardChain(id, chain, visited, depth) {
    if (depth <= 0 || visited.has(id)) return chain;
    visited.add(id);
    const edges = this.graph.getEdges(id);
    for (const e of edges) {
      if (!visited.has(e.to) && !chain.some(c => c.to === e.to)) {
        chain.push(e);
        this._forwardChain(e.to, chain, visited, depth - 1);
      }
    }
    return chain;
  }

  _backwardChain(id, chain, visited, depth) {
    if (depth <= 0 || visited.has(id)) return chain;
    visited.add(id);
    const inEdges = this.graph.getInEdges(id);
    for (const e of inEdges) {
      if (!visited.has(e.from) && !chain.some(c => c.from === e.from)) {
        chain.push(e);
        this._backwardChain(e.from, chain, visited, depth - 1);
      }
    }
    return chain;
  }

  _detectCycle(start, visited, pathArr) {
    if (visited.has(start)) {
      const idx = pathArr.indexOf(start);
      if (idx >= 0) return pathArr.slice(idx).concat(start);
      return null;
    }
    visited.add(start);
    pathArr.push(start);
    const edges = this.graph.getEdges(start);
    for (const e of edges) {
      const result = this._detectCycle(e.to, visited, [...pathArr]);
      if (result) return result;
    }
    const inEdges = this.graph.getInEdges(start);
    for (const e of inEdges) {
      if (!visited.has(e.from)) {
        const result = this._detectCycle(e.from, visited, [...pathArr]);
        if (result) return result;
      }
    }
    return null;
  }

  _resolveCycleOrder(cycle) {
    const giren = new Set();
    const cikan = new Set();
    for (let i = 0; i < cycle.length - 1; i++) {
      const edges = this.graph.getEdges(cycle[i]);
      for (const e of edges) {
        if (e.to === cycle[i + 1] && e.relation === 'tür') {
          cikan.add(cycle[i]);
          giren.add(cycle[i + 1]);
        }
      }
    }
    for (const n of cycle) {
      if (cikan.has(n) && !giren.has(n)) return n + ' (temel tür)';
    }
    return null;
  }

  _findPath(from, to, visited, pathArr, depth) {
    if (depth <= 0 || visited.has(from)) return null;
    visited.add(from);
    pathArr.push(from);
    if (from === to) return [...pathArr];
    const edges = this.graph.getEdges(from);
    for (const e of edges) {
      const result = this._findPath(e.to, to, visited, [...pathArr], depth - 1);
      if (result) return result;
    }
    const inEdges = this.graph.getInEdges(from);
    for (const e of inEdges) {
      const result = this._findPath(e.from, to, visited, [...pathArr], depth - 1);
      if (result) return result;
    }
    return null;
  }

  // --- Background auto-think ---
  startAutoThink(intervalMs = 10000) {
    if (this._thinkTimer) return;
    this._dreamer = new Dream(this);
    this._thinkTimer = setInterval(() => {
      try {
        this._autoThinkTick();
      } catch (e) {
        console.error('\n[autoThink hata]', e.message);
      }
    }, intervalMs);
    this._autoThinkLog('AutoThink başladı (her ' + (intervalMs / 1000) + 's)');
  }

  stopAutoThink() {
    if (this._thinkTimer) {
      clearInterval(this._thinkTimer);
      this._thinkTimer = null;
    }
    this._autoThinkLog('AutoThink durduruldu');
  }

  _autoThinkTick() {
    const hips = this._dreamer.dream();
    if (hips.length === 0) return;

    let eklenen = 0;
    for (const h of hips.slice(0, 5)) {
      if (h.confidence > 0.35) {
        const existing = this.graph.getEdge(h.from, h.to);
        if (!existing && this.graph.getNode(h.from) && this.graph.getNode(h.to)) {
          const rel = h.type === 'zincir' ? 'benzer' : (h.type === 'benzerlik' ? 'benzer' : 'hipotez');
          this.graph.addEdge(h.from, h.to, rel);
          eklenen++;
        }
      }
    }

    if (eklenen > 0) {
      this._autoThinkLog('AutoThink: ' + eklenen + ' yeni bağlantı keşfetti');
    }

    const cons = this.detectContradictions();
    for (const c of cons) {
      if (c.type === 'döngü') {
        this._autoThinkLog('AutoThink: döngü tespit -> ' + c.node + ' ↔ ' + c.targets.join(', '));
      }
    }
  }

  _autoThinkLog(msg) {
    console.log('\n[🧠 ' + new Date().toLocaleTimeString() + '] ' + msg);
  }

  /**
   * Bir ifadeyi bilgi grafiğiyle doğrula.
   * "kedi balık yer" → özne=kedi, nesne=balık yer → kenar var mı?
   */
  verify(statement) {
    const parts = statement.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return { status: 'bilinmiyor', confidence: 0, evidence: [] };

    const subject = normalizeTurkish(parts[0]);
    const subjectNode = this.graph.getNode(subject);

    // Özne grafikte yok → bilinmiyor
    if (!subjectNode) return { status: 'bilinmiyor', confidence: 0, evidence: [] };

    const edges = this.graph.getEdges(subject);

    // Direkt kenar eşleşmesi: "kedi balık yer" → kedi→balık yer kenarı var mı?
    const predicate = parts.slice(1).join(' ');
    const directEdge = edges.find(e => {
      const edgeStr = e.to + (e.relation !== 'özellik' ? '' : '');
      return predicate.includes(e.to) || e.to === predicate;
    });
    if (directEdge) {
      return {
        status: 'dogrulandi',
        confidence: Math.min(0.95, directEdge.weight + 0.4),
        evidence: [`${subject} --[${directEdge.relation}]--> ${directEdge.to}`],
      };
    }

    // Çelişki kontrolü: aynı özne için zıt ifade var mı?
    const cons = this.detectContradictions();
    const subjCons = cons.filter(c => c.node === subject);
    if (subjCons.length > 0) {
      return {
        status: 'celiski',
        confidence: 0.7,
        evidence: subjCons.map(c => c.node + ' → ' + c.targets.join(', ')),
      };
    }

    // Yol tabanlı kanıt: özne → ... → son kelime (ek temizlenerek)
    const rawTarget = parts[parts.length - 1];
    // -dır/-dir/-dur/-dür ekini temizle
    const cleanTarget = rawTarget.replace(/(dır|dir|dur|dür|tır|tir|tur|tür)$/i, '');
    const target = normalizeTurkish(cleanTarget || rawTarget);
    if (target !== subject) {
      const foundPath = this._findPath(subject, target, new Set(), [], 4);
      if (foundPath) {
        return {
          status: 'dogrulandi',
          confidence: 0.5,
          evidence: [foundPath.join(' → ')],
        };
      }
    }

    // Kısmi eşleşme: ifadedeki herhangi bir kelime kenar olarak var mı?
    for (const word of parts.slice(1)) {
      const w = normalizeTurkish(word);
      const match = edges.find(e => e.to === w || e.to.includes(w));
      if (match) {
        return {
          status: 'dogrulandi',
          confidence: 0.35,
          evidence: [`${subject} --[${match.relation}]--> ${match.to}`],
        };
      }
    }

    return { status: 'bilinmiyor', confidence: 0, evidence: [] };
  }

  learnDocument(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !l.startsWith('#') && !l.startsWith('//'));
    let count = 0;
    for (const line of lines) {
      const cleaned = line.replace(/^[\s-–—*•]+/, '').trim();
      const words = cleaned.split(/\s+/);
      if (words.length >= 2) {
        this.learn(cleaned);
        count++;
      }
    }
    return count;
  }

  /**
   * LLM yanıtından bilgi öğren.
   * Çelişkili cümleleri atlar, yeni bilgileri grafiğe ekler.
   *
   * @param {string} text - LLM'den gelen ham metin
   * @param {object} [opts]
   * @param {boolean} [opts.skipConflicts=true]  - çelişkili cümleleri atla
   * @param {number}  [opts.minWords=2]           - minimum kelime sayısı
   * @param {number}  [opts.maxSentences=20]      - max cümle sayısı
   * @returns {{ learned: number, skipped: number, conflicts: string[] }}
   */
  learnFromLLM(text, opts = {}) {
    const skipConflicts = opts.skipConflicts !== false;
    const minWords     = opts.minWords     || 2;
    const maxSentences = opts.maxSentences || 20;

    // Metni cümlelere böl: nokta, ünlem, soru işareti veya satır sonu
    const sentences = text
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    let learned = 0, skipped = 0;
    const conflicts = [];

    for (const sentence of sentences.slice(0, maxSentences)) {
      // Markdown işaretlerini temizle
      const cleaned = sentence
        .replace(/^[\s#*\-–—•>]+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .trim();

      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length < minWords) { skipped++; continue; }

      // Çelişki kontrolü
      if (skipConflicts) {
        const check = this.verify(cleaned);
        if (check.status === 'celiski') {
          conflicts.push(cleaned);
          skipped++;
          continue;
        }
      }

      this.learn(cleaned);
      learned++;
    }

    return { learned, skipped, conflicts };
  }

  detectContradictions() {
    const allNodes = Object.values(this.graph._nodes);
    const contradictions = [];

    for (const node of allNodes) {
      const edges = this.graph.getEdges(node.id);
      const typeEdges = edges.filter(e => e.relation === 'tür');
      if (typeEdges.length > 1) {
        contradictions.push({
          type: 'çoklu-tür',
          node: node.id,
          targets: typeEdges.map(e => e.to),
          confidence: Math.min(0.6, typeEdges.length * 0.15),
        });
      }
    }

    for (const node of allNodes) {
      const nodeEdges = this.graph.getEdges(node.id);
      for (const edge of nodeEdges) {
        if (edge.relation !== 'tür') continue;
        const backEdge = this.graph.getEdge(edge.to, node.id, 'tür');
        if (backEdge) {
          if (!contradictions.some(c => c.type === 'döngü' && c.node === node.id)) {
            contradictions.push({
              type: 'döngü',
              node: node.id,
              targets: [edge.to],
              confidence: 0.7,
            });
          }
        }
      }
    }

    return contradictions;
  }
}

module.exports = Kernel;
