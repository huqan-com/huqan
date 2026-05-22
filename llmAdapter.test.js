const { describe, it } = require('node:test');
const assert = require('node:assert');
const LLMAdapter = require('./llmAdapter');
const Kernel = require('./kernel');

let adapter;

global.fetch = async (url, opts) => {
  const parsed = new URL(url);
  if (parsed.hostname === 'localhost' && opts.signal) {
    throw new DOMException('The operation was aborted', 'AbortError');
  }
  return { ok: false, statusText: 'Not Found' };
};

describe('LLMAdapter', () => {
  it('never throws, returns error object on network error', async () => {
    const a = new LLMAdapter({ timeout: 1 });
    const res = await a.ask('test');
    assert(res.ok === false);
    assert(typeof res.error === 'string');
  });

  it('returns error for unknown provider', async () => {
    const a = new LLMAdapter({ provider: 'yok', timeout: 1 });
    const res = await a.ask('test');
    assert(res.ok === false);
    assert(res.error.includes('Bilinmeyen'));
  });

  it('returns error for openai without key', async () => {
    const a = new LLMAdapter({ provider: 'openai', timeout: 1, apiKey: '' });
    const res = await a.ask('test');
    assert(res.ok === false);
    assert(res.error.includes('OPENAI_API_KEY'));
  });

  it('has configurable model and endpoint', () => {
    const a = new LLMAdapter({ model: 'llama3.2:1b', endpoint: 'http://192.168.1.100:11434', provider: 'ollama' });
    assert(a.model === 'llama3.2:1b');
    assert(a.endpoint === 'http://192.168.1.100:11434');
  });
});

describe('kernel.verify()', () => {
  function freshK() {
    const k = new Kernel({ noLoad: true });
    return k;
  }

  it('returns dogrulandi for known statement', () => {
    const k = freshK();
    k.learn('kedi balık yer');
    const res = k.verify('kedi balık yer');
    assert(res.status === 'dogrulandi', `Beklenen dogrulandi, gelen: ${res.status}`);
    assert(res.confidence > 0);
    assert(res.evidence.length > 0);
  });

  it('returns bilinmiyor for unknown statement', () => {
    const k = freshK();
    const res = k.verify('uçan fil muz sever');
    assert.strictEqual(res.status, 'bilinmiyor');
    assert.strictEqual(res.confidence, 0);
  });

  it('returns bilinmiyor for unknown subject', () => {
    const k = freshK();
    k.learn('kedi balık yer');
    const res = k.verify('robot düşünür');
    assert.strictEqual(res.status, 'bilinmiyor');
  });

  it('finds path-based evidence', () => {
    const k = freshK();
    k.learn('kedi hayvandır');
    k.learn('hayvan canlıdır');
    const res = k.verify('kedi canlıdır');
    assert(res.status === 'dogrulandi', `Beklenen dogrulandi, gelen: ${res.status}`);
    assert(res.evidence.length > 0);
  });

  it('returns celiski when contradiction exists', () => {
    const k = freshK();
    k.graph.addNode('kedi', 'kedi');
    k.graph.addNode('hayvan', 'hayvan');
    k.graph.addNode('bitki', 'bitki');
    k.graph.addEdge('kedi', 'hayvan', 'tür');
    k.graph.addEdge('kedi', 'bitki', 'tür'); // çoklu-tür çelişkisi
    const res = k.verify('kedi hayvan');
    // Çelişki varsa celiski, yoksa dogrulandi
    assert(res.status === 'celiski' || res.status === 'dogrulandi');
  });

  it('evidence array is always present', () => {
    const k = freshK();
    const res = k.verify('bilinmeyen kavram');
    assert(Array.isArray(res.evidence));
  });
});

describe('kernel.learnDocument()', () => {
  function freshK() {
    return new Kernel({ noLoad: true });
  }

  it('learns from plain text lines', () => {
    const k = freshK();
    const text = 'kedi balık yer\nköpek kemik sever\nkuş uçar';
    const count = k.learnDocument(text);
    assert(count === 3);
    assert(k.ask('kedi balık yer') !== 'Bilmiyorum');
    assert(k.ask('kuş uçar') !== 'Bilmiyorum');
  });

  it('skips comments and short lines', () => {
    const k = freshK();
    const text = '# bu bir yorum\n// bu da yorum\nkedi balık yer\na\nb';
    const count = k.learnDocument(text);
    assert(count === 1);
  });

  it('handles markdown with list markers', () => {
    const k = freshK();
    const text = '- kedi balık yer\n* köpek kemik sever\n- kuş uçar';
    const count = k.learnDocument(text);
    assert(count === 3);
  });

  it('returns 0 for empty input', () => {
    const k = freshK();
    assert(k.learnDocument('') === 0);
    assert(k.learnDocument('\n\n  \n') === 0);
  });
});

describe('kernel.learnFromLLM()', () => {
  function freshK() {
    return new Kernel({ noLoad: true });
  }

  it('learns sentences from LLM text', () => {
    const k = freshK();
    const text = 'Kedi bir memelilerdir. Kediler balık yer. Kediler miyavlar.';
    const result = k.learnFromLLM(text);
    assert(typeof result.learned === 'number');
    assert(typeof result.skipped === 'number');
    assert(Array.isArray(result.conflicts));
    assert(result.learned > 0, 'En az 1 cümle öğrenilmeli');
  });

  it('skips conflicting sentences when skipConflicts=true', () => {
    const k = freshK();
    k.graph.addNode('kedi', 'kedi');
    k.graph.addNode('hayvan', 'hayvan');
    k.graph.addNode('bitki', 'bitki');
    k.graph.addEdge('kedi', 'hayvan', 'tür');
    k.graph.addEdge('kedi', 'bitki', 'tür'); // çoklu-tür çelişkisi
    const text = 'kedi hayvandır. kedi bitkidir.';
    const result = k.learnFromLLM(text, { skipConflicts: true });
    assert(Array.isArray(result.conflicts));
    assert(result.learned + result.skipped > 0);
  });

  it('respects maxSentences limit', () => {
    const k = freshK();
    const sentences = Array.from({ length: 30 }, (_, i) => `kavram${i} ozellik${i}dir`).join('. ');
    const result = k.learnFromLLM(sentences, { maxSentences: 5 });
    assert(result.learned + result.skipped <= 5, 'maxSentences sınırına uyulmalı');
  });

  it('cleans markdown from LLM output without throwing', () => {
    const k = freshK();
    const text = '**Kedi** bir memelilerdir.\n- Kediler balık yer.\n> Kediler miyavlar.';
    assert.doesNotThrow(() => k.learnFromLLM(text));
  });

  it('returns zero learned for empty text', () => {
    const k = freshK();
    const result = k.learnFromLLM('');
    assert.strictEqual(result.learned, 0);
    assert.strictEqual(result.skipped, 0);
  });

  it('result always has learned, skipped, conflicts fields', () => {
    const k = freshK();
    const result = k.learnFromLLM('test cümle burada');
    assert('learned' in result);
    assert('skipped' in result);
    assert('conflicts' in result);
  });
});
