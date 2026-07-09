const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fixtureRoot = path.join(__dirname, 'fixtures', 'v5', 'signing');

const validFixtures = [
  'valid-minimal-signing-input.json',
  'valid-with-key-metadata.json',
  'valid-with-payload-digest.json'
];

const invalidFixtures = [
  'invalid-malformed-signature.json',
  'invalid-missing-signing-input.json',
  'invalid-signature-claim-without-data.json',
  'invalid-transport-claim.json',
  'invalid-trust-claim.json',
  'invalid-unsupported-algorithm.json',
  'invalid-verification-claim.json'
];

const expectedReasonCategories = {
  'valid-minimal-signing-input.json': 'valid_signing_shape',
  'valid-with-key-metadata.json': 'valid_signing_key_metadata',
  'valid-with-payload-digest.json': 'valid_signing_payload_metadata',
  'invalid-malformed-signature.json': 'malformed_signature_metadata',
  'invalid-missing-signing-input.json': 'missing_signing_input',
  'invalid-signature-claim-without-data.json': 'signature_claim_without_data',
  'invalid-transport-claim.json': 'transport_claim',
  'invalid-trust-claim.json': 'trust_claim',
  'invalid-unsupported-algorithm.json': 'unsupported_signing_algorithm',
  'invalid-verification-claim.json': 'verification_claim'
};

const expectedValidNonClaims = {
  'valid-minimal-signing-input.json': [
    'does_not_prove_signature_creation',
    'does_not_prove_verification',
    'does_not_prove_trust',
    'does_not_prove_authorization',
    'does_not_prove_transport'
  ],
  'valid-with-key-metadata.json': [
    'does_not_prove_key_management',
    'does_not_prove_signature_creation',
    'does_not_prove_verification',
    'does_not_prove_trust',
    'does_not_prove_authorization'
  ],
  'valid-with-payload-digest.json': [
    'does_not_prove_digest_computation',
    'does_not_prove_signature_creation',
    'does_not_prove_verification',
    'does_not_prove_trust',
    'does_not_prove_transport'
  ]
};

const allFixtures = [...validFixtures, ...invalidFixtures];
const structuralPlaceholderFixtures = new Set([
  ...validFixtures,
  'invalid-transport-claim.json',
  'invalid-trust-claim.json',
  'invalid-unsupported-algorithm.json',
  'invalid-verification-claim.json'
]);
const forbiddenEnvironmentContent = /BEGIN PRIVATE KEY|credential|password|https?:\/\/|Date\.now|Math\.random|new Date|C:\\|\/Users\/|\/home\//i;

function listFixtureFiles() {
  return fs
    .readdirSync(fixtureRoot)
    .filter((entry) => entry.endsWith('.json'))
    .sort();
}

function readFixture(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8'));
}

function readFixtureText(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8');
}

test('V5 signing fixture corpus exposes exactly 10 deterministic JSON fixtures', () => {
  assert.deepEqual(listFixtureFiles(), [...allFixtures].sort());
  assert.equal(validFixtures.length, 3);
  assert.equal(invalidFixtures.length, 7);
});

test('V5 signing fixtures preserve stable expected status and reason metadata', () => {
  for (const relativePath of allFixtures) {
    const fixture = readFixture(relativePath);

    assert.equal(typeof fixture.fixtureType, 'string', `${relativePath} should define fixtureType`);
    assert.equal(typeof fixture.caseId, 'string', `${relativePath} should define caseId`);
    assert.equal(typeof fixture.expected, 'object', `${relativePath} should define expected`);
    assert.equal(typeof fixture.expected.status, 'string', `${relativePath} should define expected.status`);
    assert.equal(fixture.expected.reasonCategory, expectedReasonCategories[relativePath]);
    assert.equal(Array.isArray(fixture.nonClaims), true, `${relativePath} should define nonClaims`);
    assert.equal(fixture.nonClaims.length > 0, true, `${relativePath} nonClaims should not be empty`);
    assert.equal(forbiddenEnvironmentContent.test(readFixtureText(relativePath)), false, `${relativePath} must stay environment-independent`);
  }
});

test('V5 signing valid fixtures remain structural and do not claim cryptographic capability', () => {
  for (const relativePath of validFixtures) {
    const fixture = readFixture(relativePath);

    assert.equal(fixture.fixtureType, 'valid_signing_candidate');
    assert.equal(fixture.expected.status, 'structural_only');
    assert.equal(typeof fixture.signingInput, 'object');
    assert.equal(fixture.signingInput.algorithm, 'test-structural-v1');
    assert.equal(fixture.signingInput.signature, 'STRUCTURAL_PLACEHOLDER_NOT_CRYPTOGRAPHIC');
    assert.deepEqual(fixture.nonClaims, expectedValidNonClaims[relativePath]);
    assert.equal(Object.hasOwn(fixture.signingInput, 'privateKey'), false);
    assert.equal(Object.hasOwn(fixture.signingInput, 'publicKey'), false);
  }
});

test('V5 signing invalid fixtures remain fail-closed by expected category', () => {
  const invalidStatuses = new Set(['malformed', 'missing_required_field', 'unsupported_algorithm', 'unsupported_claim']);

  for (const relativePath of invalidFixtures) {
    const fixture = readFixture(relativePath);

    assert.equal(fixture.fixtureType, 'invalid_signing_candidate');
    assert.equal(invalidStatuses.has(fixture.expected.status), true, `${relativePath} must use fail-closed status`);
    assert.notEqual(fixture.expected.status, 'structural_only');
  }
});

test('V5 signing fixtures keep verification, trust, and exchange claims blocked', () => {
  const verification = readFixture('invalid-verification-claim.json');
  const trust = readFixture('invalid-trust-claim.json');
  const transport = readFixture('invalid-transport-claim.json');

  assert.equal(verification.claims.verificationRuntime, true);
  assert.equal(verification.expected.reasonCategory, 'verification_claim');
  assert.equal(trust.signingInput.trustStatus, 'trusted');
  assert.equal(trust.expected.reasonCategory, 'trust_claim');
  assert.equal(transport.claims.transportEnabled, true);
  assert.equal(transport.expected.reasonCategory, 'transport_claim');
});

test('V5 signing fixtures contain no real key material or signing runtime dependency', () => {
  for (const relativePath of allFixtures) {
    const fixtureText = readFixtureText(relativePath);

    assert.equal(
      fixtureText.includes('STRUCTURAL_PLACEHOLDER_NOT_CRYPTOGRAPHIC'),
      structuralPlaceholderFixtures.has(relativePath),
      `${relativePath} placeholder presence should match its fixture category`
    );
    assert.equal(fixtureText.includes('BEGIN PRIVATE KEY'), false);
    assert.equal(fixtureText.includes('-----BEGIN'), false);
    assert.equal(fixtureText.includes('runtimeWriter'), false);
    assert.equal(fixtureText.includes('runtimeReader'), false);
  }
});
