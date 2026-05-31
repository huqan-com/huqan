const WEIGHTS = Object.freeze({
  user_opinion: 0.25,
  user_experience: 0.4,
  chat_memory: 0.45,
  blog: 0.5,
  docs: 0.6,
  benchmark: 0.7,
  experiment: 0.8,
  peer_reviewed: 0.9,
  replicated: 1.0,
});

function rankEvidence(type) {
  return WEIGHTS[type] ?? 0.25;
}

function adjustedConfidence(base, type) {
  const numericBase = Number(base);
  const safeBase = Number.isFinite(numericBase) ? numericBase : 0;
  const weighted = safeBase * rankEvidence(type);
  if (weighted < 0) return 0;
  if (weighted > 1) return 1;
  return weighted;
}

module.exports = {
  WEIGHTS,
  rankEvidence,
  adjustedConfidence,
};
