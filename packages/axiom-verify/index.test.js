const assert = require('node:assert/strict');
const test = require('node:test');

const axiomVerify = require('./index');

test('axiom-verify package skeleton exposes verification helpers', () => {
  assert.equal(axiomVerify.packageName, 'axiom-verify');
  assert.equal(axiomVerify.packageVersion, '0.1.0');
  assert.equal(axiomVerify.status, 'skeleton');
  assert.equal(typeof axiomVerify.ATP_OBJECT_TYPES, 'object');
  assert.ok(axiomVerify.ATP_OBJECT_TYPES.provenanceRecord);
  assert.equal(typeof axiomVerify.createVerifier, 'function');
  assert.equal(typeof axiomVerify.validateATPObject, 'function');
  assert.equal(typeof axiomVerify.runATPConformance, 'function');
});
