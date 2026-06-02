const fs = require('fs');
const path = require('path');

const DEFAULT_POLICY_PATH = path.join(__dirname, '..', 'config', 'trust-policy.default.json');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function loadTrustPolicy(policyPath = DEFAULT_POLICY_PATH) {
  const resolvedPath = policyPath ? path.resolve(policyPath) : DEFAULT_POLICY_PATH;
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  return clone(JSON.parse(raw));
}

function getTrustPolicyVersion(policy) {
  return String(policy && policy.version ? policy.version : '0.8.0');
}

function getDefaultConfidence(sourceType, sourceSubType, policy) {
  const normalizedType = String(sourceType || '').trim().toLowerCase();
  const normalizedSubType = String(sourceSubType || '').trim().toLowerCase();
  const defaults = policy && policy.defaults ? policy.defaults : {};
  const fallback = policy && policy.fallback ? policy.fallback : {};

  if (
    normalizedType &&
    policy &&
    policy[normalizedType] &&
    normalizedSubType &&
    typeof policy[normalizedType][normalizedSubType] === 'number'
  ) {
    return policy[normalizedType][normalizedSubType];
  }

  if (normalizedType && typeof defaults[normalizedType] === 'number') {
    return defaults[normalizedType];
  }

  return typeof fallback.unknown === 'number' ? fallback.unknown : 0.5;
}

function applyTrustPolicyToProvenance(provenance, policy, opts = {}) {
  const next = clone(provenance) || {};
  const warnings = [];
  const sourceType = String(next.sourceType || opts.sourceType || 'system').trim().toLowerCase() || 'system';
  const sourceSubType = String(next.sourceSubType || opts.sourceSubType || '').trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(next, 'confidence') || typeof next.confidence !== 'number') {
    next.confidence = getDefaultConfidence(sourceType, sourceSubType, policy);
    warnings.push(`confidence auto-filled from trust policy for ${sourceType}${sourceSubType ? `/${sourceSubType}` : ''}`);
  }

  next.sourceType = sourceType;
  if (sourceSubType) next.sourceSubType = sourceSubType;
  else delete next.sourceSubType;
  next.trustPolicyVersion = getTrustPolicyVersion(policy);

  return { provenance: next, warnings };
}

module.exports = {
  DEFAULT_POLICY_PATH,
  loadTrustPolicy,
  getTrustPolicyVersion,
  getDefaultConfidence,
  applyTrustPolicyToProvenance,
};
