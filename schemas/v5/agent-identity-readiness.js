const {
  buildAgentIdentityCoverageReport
} = require('./agent-identity-coverage');

const SCHEMA_VERSION = 'v5-agent-identity-readiness/v0.1';
const STATUS = 'agent_identity_readiness_index';

const NEXT_GATES = Object.freeze([
  'V5-IMPL-1G Agent Identity closeout / readiness audit',
  'V5-IMPL-2A Shared Trust Package fixture/schema start'
]);

const NOT_COMPLETED = Object.freeze({
  runtimeEnforcement: false,
  connectorIdentityEnforcement: false,
  a2aIdentityExchange: false,
  marketplaceIdentityLayer: false,
  trustPackageWriterReader: false,
  agentActionPolicyEngine: false
});

function buildCompletedMap(coverage) {
  return {
    fixtures: coverage.chain.fixtures === true,
    schema: coverage.chain.schema === true,
    validator: coverage.chain.validator === true,
    conformance: coverage.chain.conformance === true,
    coverageManifest: coverage.chain.coverageManifest === true,
    readinessIndex: true
  };
}

function buildBoundaryMatrix(coverage) {
  return {
    completed: buildCompletedMap(coverage),
    notCompleted: {
      ...NOT_COMPLETED
    },
    nonEnforcement: {
      runtimeIdentity: coverage.runtimeEnforcement === false,
      connectorIdentity: coverage.connectorIdentityEnforcement === false,
      a2aIdentityExchange: coverage.a2aIdentityExchange === false,
      marketplaceIdentity: coverage.marketplaceIdentityLayer === false,
      trustPackageWriterReader: coverage.trustPackageWriterReader === false,
      agentActionPolicyEngine: coverage.agentActionPolicyEngine === false
    }
  };
}

function buildAgentIdentityReadinessIndex(options = {}) {
  const coverage = buildAgentIdentityCoverageReport(options);
  const boundaryMatrix = buildBoundaryMatrix(coverage);
  const completedValues = Object.values(boundaryMatrix.completed);
  const notCompletedValues = Object.values(boundaryMatrix.notCompleted);

  return {
    schemaVersion: SCHEMA_VERSION,
    status: STATUS,
    readyForRuntimeEnforcement: false,
    agentIdentityChainComplete: completedValues.every((value) => value === true),
    implementationBoundaryClean: notCompletedValues.every((value) => value === false),
    boundaryMatrix,
    nextGates: [...NEXT_GATES],
    coverage: {
      schemaVersion: coverage.schemaVersion,
      status: coverage.status,
      fixtureSummary: coverage.fixtureSummary,
      conformanceSummary: coverage.conformanceSummary,
      validationSurface: coverage.validationSurface
    },
    nonClaims: [...coverage.nonClaims]
  };
}

module.exports = {
  buildAgentIdentityReadinessIndex
};
