const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const Kernel = require('./kernel');

describe('Plugin - Yönetici', () => {
  it('usePlugin: eklenti kaydeder', () => {
    const k = new Kernel({ noLoad: true });
    k.usePlugin({ name: 'test', beforeLearn(k2, data) { data.text = 'plugin test'; } });
    k.learn('kedi balık yer');
    assert.ok(k.graph.getNode('plugin'));
  });

  it('beforeLearn: metni değiştirebilir', () => {
    const k = new Kernel({ noLoad: true });
    k.usePlugin({
      name: 'translator',
      beforeLearn(k2, data) {
        if (data.text === 'cat eats fish') data.text = 'kedi balık yer';
      }
    });
    k.learn('cat eats fish');
    assert.ok(k.graph.getNode('kedi'));
    assert.strictEqual(k.graph.getNode('cat'), null);
  });

  it('afterLearn: öğrenme sonrası tetiklenir', () => {
    let triggered = false;
    const k = new Kernel({ noLoad: true });
    k.usePlugin({
      name: 'logger',
      afterLearn(k2, data) { triggered = true; assert.strictEqual(data.text, 'kedi balık yer'); }
    });
    k.learn('kedi balık yer');
    assert.strictEqual(triggered, true);
  });

  it('beforeAsk: soruyu değiştirebilir', () => {
    const k = new Kernel({ noLoad: true });
    k.learn('kedi balık yer');
    k.usePlugin({
      name: 'alias',
      beforeAsk(k2, data) { data.question = data.question.replace('cat', 'kedi'); }
    });
    const answer = k.ask('cat nedir');
    assert.ok(answer.includes('balık'));
  });

  it('afterAsk: cevabı loglar', () => {
    let log;
    const k = new Kernel({ noLoad: true });
    k.usePlugin({
      name: 'qaLog',
      afterAsk(k2, data) { log = data; }
    });
    k.learn('kedi balık yer');
    const answer = k.ask('kedi nedir');
    assert.strictEqual(log.question, 'kedi nedir');
    assert.strictEqual(log.answer, answer);
  });

  it('birden fazla plugin zincirleme çalışır', () => {
    let order = [];
    const k = new Kernel({ noLoad: true });
    k.usePlugin({ name: 'a', beforeLearn(k2, d) { order.push('a'); } });
    k.usePlugin({ name: 'b', beforeLearn(k2, d) { order.push('b'); } });
    k.learn('kedi balık yer');
    assert.deepStrictEqual(order, ['a', 'b']);
  });

  it('init: yükleme anında çağrılır', () => {
    let inited = false;
    const k = new Kernel({ noLoad: true });
    k.usePlugin({ name: 'initTest', init(k2) { inited = true; } });
    assert.strictEqual(inited, true);
  });

  it('load: plugins/ dizininden yükler', () => {
    const pDir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir);
    const pluginPath = path.join(pDir, 'test-plugin.js');
    try {
      fs.writeFileSync(pluginPath, `module.exports = { name: 'filePlugin', beforeLearn(k, d) { d.text = 'eklenti dosya'; } };`);
      const k = new Kernel({ noLoad: true });
      const loaded = k.plugins.load(pDir);
      assert.ok(loaded >= 1);
    } finally {
      try { fs.unlinkSync(pluginPath); } catch {}
    }
  });

  it('afterDream: hipotezleri loglar', () => {
    let hypotheses;
    const k = new Kernel({ noLoad: true });
    k.usePlugin({
      name: 'dreamLog',
      afterDream(k2, data) { hypotheses = data.hypotheses; }
    });
    k.learn('kedi balık yer');
    k.learn('kedi fare yer');
    k.learn('balık suda yaşar');
    const dream = new (require('./dream'))(k);
    dream.dream();
    assert.ok(Array.isArray(hypotheses));
  });

  it('beforeEmbedding: parametreleri değiştirebilir', () => {
    const k = new Kernel({ noLoad: true });
    k.usePlugin({
      name: 'dimOverride',
      beforeEmbedding(k2, opts) { opts.dimensions = 128; }
    });
    k.learn('kedi balık yer');
    k.learn('kedi fare yer');
    k.learn('balık suda yaşar');
    k.learn('fare peynir yer');
    const dream = new (require('./dream'))(k);
    dream.embedding({ dimensions: 64 });
    const node = k.graph.getNode('kedi');
    assert.strictEqual(node.embedding.length, 128);
  });

  it('beforeDream: rüya öncesi tetiklenir', () => {
    let flag = false;
    const k = new Kernel({ noLoad: true });
    k.usePlugin({ name: 'd', beforeDream() { flag = true; } });
    k.learn('kedi balık yer');
    const dream = new (require('./dream'))(k);
    dream.dream();
    assert.strictEqual(flag, true);
  });
});
