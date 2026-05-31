function normalizeInput(input) {
  if (typeof input === 'string') return input.trim();
  if (input && typeof input.text === 'string') return input.text.trim();
  if (input && typeof input.idea === 'string') return input.idea.trim();
  return '';
}

function splitSentences(text) {
  return String(text || '')
    .split(/[.!?\n]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function dedupe(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function withSource(items, source) {
  return dedupe(items).map(text => ({ text, source }));
}

function createIdeaMriPlugin() {
  return {
    name: 'idea-mri',
    version: '0.1.0',
    requires: [],
    optional: ['llm', 'graph', 'evidenceRanking'],
    capabilities: [
      {
        name: 'ideaMri',
        command: 'mri',
        description: 'Breaks an idea into claims, assumptions, risks, and evidence gaps.',
      },
    ],

    async run(kernel, input, opts = {}) {
      const text = normalizeInput(input);
      const sentences = splitSentences(text);
      const facts = typeof kernel.extractFacts === 'function' ? kernel.extractFacts(text, kernel.graph?._nodes) || [] : [];
      const baseSource = facts.length > 0 ? 'graph' : 'parsed';
      const mainClaim = sentences[0] || text || '';
      const claims = withSource(sentences.length ? sentences : facts.map(fact => `${fact.subject} ${fact.predicate}`), baseSource);
      const assumptions = withSource(facts.map(fact => `${fact.subject} ile ilgili iddia icin dayanak gerekli: ${fact.predicate}`), baseSource);
      const risks = withSource([
        claims.length <= 1 ? 'Tek iddiaya dayaniyor; alternatif senaryo eksik.' : '',
        text.length < 40 ? 'Fikir kisa; baglam ve sinirlar net degil.' : '',
        assumptions.length > 0 ? 'Varsayimlar acik kanit ile baglanmamis.' : '',
      ], baseSource);
      const missingEvidence = withSource([
        facts.length === 0 ? 'Sembolik olarak cikarilabilen net bir olgu bulunamadi.' : '',
        'Basari metri gi ve red kriteri yazilmamis.',
        'Kaynak veya deney referansi eksik.',
      ], baseSource);
      const strengths = withSource([
        facts.length > 0 ? 'Fikir sembolik olgulara ayrilabiliyor.' : '',
        claims.length > 1 ? 'Birden fazla alt iddia iceriyor.' : 'Tek odakli bir iddia sunuyor.',
      ], baseSource);

      return {
        ok: true,
        plugin: 'idea-mri',
        capability: opts.capability?.name || 'ideaMri',
        data: {
          mode: 'structured-analysis',
          mainClaim,
          claims,
          assumptions,
          risks,
          missingEvidence,
          evidenceGaps: missingEvidence,
          strengths,
        },
      };
    },
  };
}

module.exports = createIdeaMriPlugin();
module.exports.create = createIdeaMriPlugin;
