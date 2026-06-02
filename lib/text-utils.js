function normalizeText(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input) {
  return normalizeText(input)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean);
}

function hasMeaningfulOverlap(left, right, minOverlap = 2) {
  const a = new Set(tokenize(left));
  const b = new Set(tokenize(right));
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap >= minOverlap;
}

module.exports = {
  hasMeaningfulOverlap,
  normalizeText,
  tokenize,
};
