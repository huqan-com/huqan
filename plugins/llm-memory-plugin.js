const LLMAdapter = require('../llmAdapter');

let adapter;

module.exports = {
  name: 'llm-memory',

  init(kernel) {
    adapter = new LLMAdapter();
  },

  afterAsk(kernel, data) {
    if (data.answer === 'Bilmiyorum') {
      adapter.ask(data.question).then(res => {
        if (res.ok) {
          const result = kernel.learnFromLLM(res.data.text, { skipConflicts: true, maxSentences: 5 });
          if (result.learned > 0) {
            kernel.graph.save();
          }
        }
      }).catch(() => {});
    }
  },

  afterLearn(kernel, data) {
    const stats = kernel.graph.getStats();
    console.log(`[llm-memory] Öğrenildi: ${data.text} (${stats.nodes} düğüm, ${stats.edges} kenar)`);
  },
};
