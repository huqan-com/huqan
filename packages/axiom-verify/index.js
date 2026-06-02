'use strict';

const { ATP_OBJECT_TYPES, validateATPObject, validateATPFixture, runATPConformance, normalizeATPValidationError } = require('../../lib/atp-conformance');
const { buildTrustReceipt, queryProvenance, queryAuditTrail, queryCandidateClaims, queryTrustGraph } = require('../../lib/provenance-query');

function createVerifier(options = {}) {
  return {
    packageName: 'axiom-verify',
    packageVersion: '0.1.0',
    options: { ...options },
    ATP_OBJECT_TYPES,
    validateATPObject: (type, object, validateOptions = {}) => validateATPObject(type, object, { ...options, ...validateOptions }),
    validateATPFixture: (type, filePath, validateOptions = {}) => validateATPFixture(type, filePath, { ...options, ...validateOptions }),
    runATPConformance: (fixtures, validateOptions = {}) => runATPConformance(fixtures, { ...options, ...validateOptions }),
    buildTrustReceipt: (input, runtimeOptions = {}) => buildTrustReceipt(input, { ...options, ...runtimeOptions }),
    queryProvenance: (graph, filters = {}) => queryProvenance(graph, filters),
    queryAuditTrail: (graph, filters = {}) => queryAuditTrail(graph, filters),
    queryCandidateClaims: (graph, filters = {}) => queryCandidateClaims(graph, filters),
    queryTrustGraph: (graph, filters = {}) => queryTrustGraph(graph, filters),
    normalizeATPValidationError,
  };
}

module.exports = {
  packageName: 'axiom-verify',
  packageVersion: '0.1.0',
  status: 'skeleton',
  ATP_OBJECT_TYPES,
  validateATPObject,
  validateATPFixture,
  runATPConformance,
  normalizeATPValidationError,
  buildTrustReceipt,
  queryProvenance,
  queryAuditTrail,
  queryCandidateClaims,
  queryTrustGraph,
  createVerifier,
};
