const { describe, it } = require('node:test');
const assert = require('node:assert');
const Kernel = require('./kernel');

// Test için temiz kernel — memory.json yüklemez
function freshKernel() {
  return new Kernel({ noLoad: true });
}

describe('Kernel - Öğrenme', () => {
  it('learn: basit cümleyi parse edip grafiğe ekler', () => {
    const k = freshKernel();
    k.learn('Köpek hayvandır');
    const n = k.graph.getNode('köpek');
    assert.ok(n);
    assert.strictEqual(n.label, 'köpek');
    const edges = k.graph.getEdges('köpek');
    assert.ok(edges.some(e => e.relation === 'tür' && e.to === 'hayvan'));
  });

  it('learn: aynı özne birden fazla yüklem alabilir', () => {
    const k = freshKernel();
    k.learn('Köpek hayvandır');
    k.learn('Köpek havlar');
    const edges = k.graph.getEdges('köpek');
    assert.ok(edges.some(e => e.relation === 'tür'));
    assert.ok(edges.some(e => e.relation === 'yapabilir' && e.to === 'havlar'));
  });

  it('learn: birden fazla kavram bağımsız eklenir', () => {
    const k = freshKernel();
    k.learn('Köpek hayvandır');
    k.learn('Kedi hayvandır');
    k.learn('Kedi miyavlar');
    assert.ok(k.graph.getNode('köpek'));
    assert.ok(k.graph.getNode('kedi'));
    assert.ok(k.graph.getNode('hayvan'));
  });

  it('learn: "bir" artikeli atlanır', () => {
    const k = freshKernel();
    k.learn('Kedi bir memelilerdir');
    const edges = k.graph.getEdges('kedi');
    assert.ok(edges.some(e => e.relation === 'tür'));
  });

  it('learn: çoğul özne normalize edilir', () => {
    const k = freshKernel();
    k.learn('kediler hayvandır');
    // "kediler" → "kedi" normalize edilmeli
    const node = k.graph.getNode('kedi');
    assert.ok(node, 'kedi düğümü oluşmalı');
  });
});

describe('Kernel - Çıkarım', () => {
  it('ask: doğrudan ilişkiyi bulur', () => {
    const k = freshKernel();
    k.learn('Köpek hayvandır');
    k.learn('Köpek havlar');
    const cevap = k.ask('Köpek nedir');
    assert.ok(cevap);
    assert.ok(cevap.includes('hayvan'));
  });

  it('ask: bilinmeyen kavram için "Bilmiyorum" döner', () => {
    const k = freshKernel();
    const cevap = k.ask('Uçan fil nedir');
    assert.strictEqual(cevap, 'Bilmiyorum');
  });

  it('ask: transitivite ile dolaylı ilişki bulur', () => {
    const k = freshKernel();
    k.learn('Köpek memelidir');
    k.learn('Memeli hayvandır');
    const cevap = k.ask('Köpek nedir');
    assert.ok(cevap.includes('hayvan'));
  });

  it('ask: soru kelimesi temizlenir', () => {
    const k = freshKernel();
    k.learn('Kedi hayvandır');
    const cevap = k.ask('kedi nedir');
    assert.ok(cevap !== 'Bilmiyorum');
    assert.ok(cevap.includes('hayvan'));
  });
});

describe('Kernel - Bağlam Duyarlı Benzerlik', () => {
  it('contextSimilarity: aynı bağlamdaki kavramlar yüksek skor', () => {
    const k = freshKernel();
    k.learn('Köpek havlar');
    k.learn('Kedi miyavlar');
    k.learn('Köpek hayvandır');
    k.learn('Kedi hayvandır');
    k.learn('Köpek memelidir');
    k.learn('Kedi memelidir');
    k.graph.addTag('köpek', 'hayvan', 0.9);
    k.graph.addTag('kedi', 'hayvan', 0.9);
    k.graph.addTag('köpek', 'memeli', 0.8);
    k.graph.addTag('kedi', 'memeli', 0.8);
    k.graph.addTag('köpek', 'evcil', 0.7);
    k.graph.addTag('kedi', 'evcil', 0.7);

    const simHayvan = k.contextSimilarity('köpek', 'kedi', 'hayvan');
    const simRastgele = k.contextSimilarity('köpek', 'masa', 'hayvan');
    assert.ok(simHayvan > simRastgele);
    assert.ok(simHayvan > 0.5);
  });
});

describe('Kernel - Entropi', () => {
  it('entropy: boş graf sıfır entropi', () => {
    const k = freshKernel();
    assert.strictEqual(k.entropy(), 0);
  });

  it('entropy: bağlantılı düğüm pozitif entropi', () => {
    const k = freshKernel();
    // Direkt graph API ile kenar ekle — learn() NLP parsing'e bağımlı değil
    k.graph.addNode('a', 'a');
    k.graph.addNode('b', 'b');
    k.graph.addNode('c', 'c');
    k.graph.addEdge('a', 'b', 'tür');
    k.graph.addEdge('a', 'c', 'yapabilir');
    k.graph.addEdge('b', 'c', 'özellik');
    const s = k.entropy();
    assert.ok(s > 0, `Entropi pozitif olmalı, gelen: ${s}`);
  });
});

describe('Kernel - Boşluk Tespiti', () => {
  it('detectGaps: bağlantısız düğümleri bulur', () => {
    const k = freshKernel();
    k.learn('Köpek hayvandır');
    k.graph.addNode('yalnız', 'tek başına');
    const gaps = k.detectGaps();
    assert.ok(gaps.length > 0);
    assert.ok(gaps.includes('yalnız'));
  });
});

describe('Kernel - Çelişki Tespiti', () => {
  it('detectContradictions: çoklu-tür çelişkisini bulur', () => {
    const k = freshKernel();
    k.graph.addNode('a', 'a');
    k.graph.addNode('b', 'b');
    k.graph.addNode('c', 'c');
    k.graph.addEdge('a', 'b', 'tür');
    k.graph.addEdge('a', 'c', 'tür');
    const cons = k.detectContradictions();
    const multiType = cons.find(c => c.type === 'çoklu-tür');
    assert.ok(multiType);
    assert.strictEqual(multiType.node, 'a');
  });

  it('detectContradictions: döngü çelişkisini bulur', () => {
    const k = freshKernel();
    k.graph.addNode('a', 'a');
    k.graph.addNode('b', 'b');
    k.graph.addEdge('a', 'b', 'tür');
    k.graph.addEdge('b', 'a', 'tür');
    const cons = k.detectContradictions();
    const cycle = cons.find(c => c.type === 'döngü');
    assert.ok(cycle);
  });

  it('detectContradictions: çelişkisiz graf boş dizi döndürür', () => {
    const k = freshKernel();
    k.learn('Köpek hayvandır');
    k.learn('Köpek havlar');
    const cons = k.detectContradictions();
    assert.ok(Array.isArray(cons));
    assert.strictEqual(cons.length, 0);
  });
});

describe('Kernel - Reason & Compare', () => {
  it('reason: ileri ve geri zincir döner', () => {
    const k = freshKernel();
    k.learn('Köpek memelidir');
    k.learn('Memeli hayvandır');
    const r = k.reason('köpek');
    assert.ok(r !== 'Bilmiyorum');
    assert.ok(r.includes('köpek'));
  });

  it('compare: ortak özellikleri bulur', () => {
    const k = freshKernel();
    k.learn('Köpek memelidir');
    k.learn('Kedi memelidir');
    const r = k.compare('köpek', 'kedi');
    assert.ok(r.includes('ortak'));
  });
});
