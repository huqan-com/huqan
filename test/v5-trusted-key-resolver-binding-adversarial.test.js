'use strict';

// V5-VERIFICATION-25A6A — Resolver Record Snapshot Hardening
//
// Adversarial hardening for the trusted-key resolver validation/copy boundary.
// Root finding (discovered under V25A6): when `publicKeySpkiDer` is exposed as
// an accessor (getter), the resolver read the field once for validation and
// again for the copy, allowing a validation-time value to differ from the
// copy-time value (TOCTOU). A malicious getter returned a 44-byte buffer during
// validation and a 100-byte buffer during copy, yielding an `active` verdict
// carrying 100 bytes of attacker-controlled key material.
//
// This suite asserts the FIXED contract:
//   - security-relevant record fields are snapshotted from own DATA properties
//   - accessor descriptors are rejected fail-closed (getter never invoked)
//   - validation and copy operate on the same immutable snapshot
//   - active output is a fresh 44-byte Buffer, isolated from any backing store
//   - all pre-existing bounded behavior is preserved

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveTrustedKeyState } = require('../lib/v5/trusted-key-resolver');

const FIXED_TIME = '2026-02-01T12:00:00.000Z';
const PUBLIC_KEY_SPKI_DER_HEX =
  '302a300506032b65700321003d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c';

const MALFORMED = {
  keyState: 'malformed',
  reasonCategory: 'malformed_trusted_key_record'
};

function publicKey() {
  return Buffer.from(PUBLIC_KEY_SPKI_DER_HEX, 'hex');
}

function exact(result, expected) {
  assert.deepEqual(result, expected);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(expected).sort());
}

function assertMalformed(input) {
  let result;
  assert.doesNotThrow(() => {
    result = resolveTrustedKeyState(input);
  });
  exact(result, MALFORMED);
}

function assertActive(input, keyReference) {
  let result;
  assert.doesNotThrow(() => {
    result = resolveTrustedKeyState(input);
  });
  assert.equal(result.keyState, 'active');
  assert.equal(result.keyReference, keyReference);
  assert.ok(Buffer.isBuffer(result.publicKeySpkiDer), 'output is a Buffer');
  assert.equal(result.publicKeySpkiDer.length, 44, 'output is exactly 44 bytes');
  return result;
}

// Builds a valid resolver input where the record's publicKeySpkiDer is supplied
// by `defineKeyField` (so tests can install data vs accessor descriptors).
function inputWithKeyField(keyReference, defineKeyField, recordOverrides = {}) {
  const record = {
    keyReference,
    status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    ...recordOverrides
  };
  defineKeyField(record);
  return {
    keyReference,
    records: [record],
    evaluationTime: FIXED_TIME
  };
}

// ---------------------------------------------------------------------------
// A. TOCTOU getter regression — the core finding
// ---------------------------------------------------------------------------

test('A. getter-backed publicKeySpkiDer is rejected fail-closed and never invoked', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-toctou';
  const input = inputWithKeyField(ref, (record) => {
    Object.defineProperty(record, 'publicKeySpkiDer', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        // Validation-time value differs from copy-time value.
        return getterCalls === 1
          ? Buffer.alloc(44, 0x11)
          : Buffer.alloc(100, 0x22);
      }
    });
  });

  assertMalformed(input);
  assert.equal(getterCalls, 0, 'getter must never be invoked');
});

test('A. getter returning a valid 44-byte buffer is still rejected (accessor, not data)', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-getter-consistent';
  const input = inputWithKeyField(ref, (record) => {
    Object.defineProperty(record, 'publicKeySpkiDer', {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return publicKey();
      }
    });
  });

  assertMalformed(input);
  assert.equal(getterCalls, 0, 'a consistent getter is still an accessor and must be rejected');
});

// ---------------------------------------------------------------------------
// B. Setter / accessor variants
// ---------------------------------------------------------------------------

test('B. setter-only publicKeySpkiDer is rejected fail-closed', () => {
  const ref = 'test-key:a6a-setter-only';
  const input = inputWithKeyField(ref, (record) => {
    Object.defineProperty(record, 'publicKeySpkiDer', {
      enumerable: true,
      configurable: true,
      set() { /* no-op */ }
    });
  });
  // A setter-only accessor reads as undefined; must fail closed either as a
  // missing-key malformed record. It must never be treated as active.
  assertMalformed(input);
});

test('B. getter+setter publicKeySpkiDer is rejected without invoking the getter', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-getset';
  const input = inputWithKeyField(ref, (record) => {
    Object.defineProperty(record, 'publicKeySpkiDer', {
      enumerable: true,
      configurable: true,
      get() { getterCalls += 1; return publicKey(); },
      set() { /* no-op */ }
    });
  });
  assertMalformed(input);
  assert.equal(getterCalls, 0);
});

test('B. inherited getter on record prototype is rejected (own data property required)', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-inherited';
  const proto = {};
  Object.defineProperty(proto, 'publicKeySpkiDer', {
    enumerable: true,
    get() { getterCalls += 1; return publicKey(); }
  });
  // Record with a non-plain prototype must be rejected outright.
  const record = Object.create(proto);
  record.keyReference = ref;
  record.status = 'active';
  record.expiresAt = '2026-12-31T23:59:59.000Z';
  const input = { keyReference: ref, records: [record], evaluationTime: FIXED_TIME };
  assertMalformed(input);
  assert.equal(getterCalls, 0);
});

test('B. non-enumerable accessor is rejected fail-closed', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-nonenum';
  const input = inputWithKeyField(ref, (record) => {
    Object.defineProperty(record, 'publicKeySpkiDer', {
      enumerable: false,
      configurable: true,
      get() { getterCalls += 1; return publicKey(); }
    });
  });
  assertMalformed(input);
  assert.equal(getterCalls, 0);
});

test('B. accessor whose getter throws is contained (no raw exception leak)', () => {
  const ref = 'test-key:a6a-throwing';
  const input = inputWithKeyField(ref, (record) => {
    Object.defineProperty(record, 'publicKeySpkiDer', {
      enumerable: true,
      configurable: true,
      get() { throw new Error('boom from getter'); }
    });
  });
  assertMalformed(input);
});

// ---------------------------------------------------------------------------
// C. Offset-backed Uint8Array confinement (regression guard)
// ---------------------------------------------------------------------------

test('C. offset-backed 44-byte view resolves active with confined fresh copy', () => {
  const ref = 'test-key:a6a-offset-view';
  const keyBytes = publicKey(); // 44 canonical bytes

  const backing = new Uint8Array(100);
  backing.fill(0xAA);                    // prefix + suffix sentinel
  const view = new Uint8Array(backing.buffer, 28, 44);
  view.set(keyBytes);                    // view now holds the real key
  // Distinct suffix sentinel to catch over-copy past the view.
  backing.fill(0xBB, 28 + 44);

  const input = {
    keyReference: ref,
    records: [{
      keyReference: ref,
      status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: view
    }],
    evaluationTime: FIXED_TIME
  };

  const result = assertActive(input, ref);

  // Output bytes are exactly the view bytes — no prefix, no suffix leakage.
  assert.ok(result.publicKeySpkiDer.equals(keyBytes), 'output equals canonical key');
  assert.equal(result.publicKeySpkiDer.indexOf(0xAA), -1, 'no prefix sentinel in output');
  assert.equal(result.publicKeySpkiDer.indexOf(0xBB), -1, 'no suffix sentinel in output');

  // Freshness / isolation.
  const outCopy = Buffer.from(result.publicKeySpkiDer);

  backing.fill(0xCC);                     // mutate backing after resolution
  assert.ok(result.publicKeySpkiDer.equals(outCopy), 'backing mutation does not affect output');

  result.publicKeySpkiDer.fill(0xDD);     // mutate output
  assert.equal(backing.indexOf(0xDD), -1, 'output mutation does not affect backing/view');
});

test('C. offset-backed view resolves deterministically to identical bytes', () => {
  const ref = 'test-key:a6a-offset-determinism';
  const keyBytes = publicKey();
  const backing = new Uint8Array(80);
  const view = new Uint8Array(backing.buffer, 16, 44);
  view.set(keyBytes);
  const makeInput = () => ({
    keyReference: ref,
    records: [{
      keyReference: ref, status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: new Uint8Array(backing.buffer, 16, 44)
    }],
    evaluationTime: FIXED_TIME
  });
  const a = resolveTrustedKeyState(makeInput());
  const b = resolveTrustedKeyState(makeInput());
  assert.ok(a.publicKeySpkiDer.equals(b.publicKeySpkiDer));
  assert.ok(a.publicKeySpkiDer.equals(keyBytes));
});

// ---------------------------------------------------------------------------
// D. Existing behavior preservation
// ---------------------------------------------------------------------------

test('D. 44-byte Buffer own data property resolves active', () => {
  const ref = 'test-key:a6a-buffer';
  const input = inputWithKeyField(ref, (record) => {
    record.publicKeySpkiDer = publicKey();
  });
  const result = assertActive(input, ref);
  assert.ok(result.publicKeySpkiDer.equals(publicKey()));
});

test('D. 44-byte Uint8Array own data property resolves active', () => {
  const ref = 'test-key:a6a-u8';
  const input = inputWithKeyField(ref, (record) => {
    record.publicKeySpkiDer = new Uint8Array(publicKey());
  });
  assertActive(input, ref);
});

test('D. 43-byte and 45-byte keys are malformed', () => {
  for (const len of [43, 45]) {
    const ref = `test-key:a6a-len-${len}`;
    const input = inputWithKeyField(ref, (record) => {
      record.publicKeySpkiDer = Buffer.alloc(len, 0x01);
    });
    assertMalformed(input);
  }
});

test('D. active record missing key is malformed', () => {
  const ref = 'test-key:a6a-missing';
  const input = {
    keyReference: ref,
    records: [{ keyReference: ref, status: 'active', expiresAt: '2026-12-31T23:59:59.000Z' }],
    evaluationTime: FIXED_TIME
  };
  assertMalformed(input);
});

test('D. revoked / expired / unavailable precedence preserved and leak nothing', () => {
  const cases = [
    ['revoked', 'revoked_key'],
    ['unavailable', 'key_lookup_unavailable']
  ];
  for (const [status, reason] of cases) {
    const ref = `test-key:a6a-${status}`;
    const input = {
      keyReference: ref,
      records: [{
        keyReference: ref, status,
        expiresAt: '2026-12-31T23:59:59.000Z',
        publicKeySpkiDer: publicKey()
      }],
      evaluationTime: FIXED_TIME
    };
    const result = resolveTrustedKeyState(input);
    exact(result, { keyState: status, reasonCategory: reason });
    assert.equal('publicKeySpkiDer' in result, false, 'non-active output must not carry key material');
  }

  // Expired via metadata boundary.
  const ref = 'test-key:a6a-expired';
  const expired = {
    keyReference: ref,
    records: [{
      keyReference: ref, status: 'active',
      expiresAt: '2026-01-01T00:00:00.000Z',
      publicKeySpkiDer: publicKey()
    }],
    evaluationTime: FIXED_TIME
  };
  const result = resolveTrustedKeyState(expired);
  exact(result, { keyState: 'expired', reasonCategory: 'expired_key_metadata' });
});

test('D. duplicate matching records remain ambiguous -> malformed', () => {
  const ref = 'test-key:a6a-dup';
  const record = () => ({
    keyReference: ref, status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    publicKeySpkiDer: publicKey()
  });
  const input = { keyReference: ref, records: [record(), record()], evaluationTime: FIXED_TIME };
  assertMalformed(input);
});

test('D. repeat execution is deterministic', () => {
  const ref = 'test-key:a6a-determinism';
  const input = inputWithKeyField(ref, (record) => {
    record.publicKeySpkiDer = publicKey();
  });
  const a = resolveTrustedKeyState(input);
  const b = resolveTrustedKeyState(input);
  assert.deepEqual(a, b);
});

test('D. caller input record is not mutated during resolution', () => {
  const ref = 'test-key:a6a-nomutate';
  const key = publicKey();
  const record = {
    keyReference: ref, status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    publicKeySpkiDer: key
  };
  const input = { keyReference: ref, records: [record], evaluationTime: FIXED_TIME };
  resolveTrustedKeyState(input);
  assert.equal(record.publicKeySpkiDer, key, 'record key reference unchanged');
  assert.ok(record.publicKeySpkiDer.equals(publicKey()), 'record key bytes unchanged');
});

// ---------------------------------------------------------------------------
// E. Attack-class audit (read-only observation; no silent contract expansion)
// ---------------------------------------------------------------------------

test('E. transparent Proxy exposing only real data properties resolves safely', () => {
  // A no-op Proxy forwards descriptors verbatim to a plain target: every field
  // is a real own DATA property, no getter interception is possible. The
  // resolver treats it as the underlying plain record. The security contract it
  // must uphold is: no exception leak, and the emitted key is exactly the
  // target's 44 validated bytes (no TOCTOU surface). It does NOT promise to
  // reject transparent proxies — doing so would be new behavior outside A6A.
  const ref = 'test-key:a6a-proxy-transparent';
  const target = {
    keyReference: ref, status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    publicKeySpkiDer: publicKey()
  };
  const proxy = new Proxy(target, {});
  const input = { keyReference: ref, records: [proxy], evaluationTime: FIXED_TIME };
  const result = assertActive(input, ref);
  assert.ok(result.publicKeySpkiDer.equals(publicKey()));
});

test('E. Proxy whose get-trap forges the key is rejected fail-closed', () => {
  // A get-trap can return different values on successive reads — the exact
  // TOCTOU vector, now via Proxy instead of an accessor descriptor. Because the
  // snapshot reads via getOwnPropertyDescriptor (not the get trap) and the trap
  // is not a data descriptor, this must fail closed and the trap must never
  // fabricate an accepted key.
  let trapReads = 0;
  const ref = 'test-key:a6a-proxy-gettrap';
  const target = {
    keyReference: ref, status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    publicKeySpkiDer: publicKey()
  };
  const proxy = new Proxy(target, {
    getOwnPropertyDescriptor(obj, key) {
      if (key === 'publicKeySpkiDer') {
        // Present the field as an accessor so snapshotRecord rejects it.
        return {
          configurable: true,
          enumerable: true,
          get() { trapReads += 1; return Buffer.alloc(100, 0x22); }
        };
      }
      return Object.getOwnPropertyDescriptor(obj, key);
    }
  });
  const input = { keyReference: ref, records: [proxy], evaluationTime: FIXED_TIME };
  assertMalformed(input);
  assert.equal(trapReads, 0, 'forged accessor get-trap must never be invoked');
});

// ---------------------------------------------------------------------------
// F. Independent-review closure — root snapshots and exception containment
// ---------------------------------------------------------------------------

test('F. root keyReference accessor cannot relabel an active key binding', () => {
  let getterCalls = 0;
  const selected = 'test-key:a6a-root-selected';
  const relabelled = 'test-key:a6a-root-relabelled';
  const input = {
    records: [{
      keyReference: selected,
      status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: publicKey()
    }],
    evaluationTime: FIXED_TIME
  };
  Object.defineProperty(input, 'keyReference', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return getterCalls <= 2 ? selected : relabelled;
    }
  });

  assertMalformed(input);
  assert.equal(getterCalls, 0, 'root accessor must never be invoked');
});

test('F. root records accessor cannot swap the validated record set', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-root-records';
  const input = { keyReference: ref, evaluationTime: FIXED_TIME };
  Object.defineProperty(input, 'records', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return getterCalls === 1
        ? []
        : [{
            keyReference: ref,
            status: 'active',
            expiresAt: '2026-12-31T23:59:59.000Z',
            publicKeySpkiDer: publicKey()
          }];
    }
  });

  assertMalformed(input);
  assert.equal(getterCalls, 0, 'records accessor must never be invoked');
});

test('F. accessor-backed records array element is rejected without invocation', () => {
  let getterCalls = 0;
  const ref = 'test-key:a6a-record-element';
  const records = [];
  records.length = 1;
  Object.defineProperty(records, '0', {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls += 1;
      return {
        keyReference: ref,
        status: 'active',
        expiresAt: '2026-12-31T23:59:59.000Z',
        publicKeySpkiDer: publicKey()
      };
    }
  });

  assertMalformed({ keyReference: ref, records, evaluationTime: FIXED_TIME });
  assert.equal(getterCalls, 0, 'array element accessor must never be invoked');
});

test('F. throwing getPrototypeOf traps are contained for root and records', () => {
  const ref = 'test-key:a6a-prototype-trap';
  const record = new Proxy({
    keyReference: ref,
    status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    publicKeySpkiDer: publicKey()
  }, {
    getPrototypeOf() { throw new Error('record prototype trap'); }
  });
  assertMalformed({ keyReference: ref, records: [record], evaluationTime: FIXED_TIME });

  const root = new Proxy({
    keyReference: ref,
    records: [{
      keyReference: ref,
      status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: publicKey()
    }],
    evaluationTime: FIXED_TIME
  }, {
    getPrototypeOf() { throw new Error('root prototype trap'); }
  });
  assertMalformed(root);
});

test('F. revoked Proxy inputs and throwing key inspection fail closed', () => {
  const ref = 'test-key:a6a-revoked-proxy';
  const { proxy: revokedRoot, revoke: revokeRoot } = Proxy.revocable({}, {});
  revokeRoot();
  assertMalformed(revokedRoot);

  const throwingKey = new Proxy({}, {
    getPrototypeOf() { throw new Error('key prototype trap'); }
  });
  assertMalformed({
    keyReference: ref,
    records: [{
      keyReference: ref,
      status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: throwingKey
    }],
    evaluationTime: FIXED_TIME
  });
});

test('F. nested Proxy metadata exceptions are contained without invoking accessors', () => {
  const ref = 'test-key:a6a-nested-proxy';
  const inputFor = (keyReference) => ({
    keyReference: ref,
    records: [{
      keyReference,
      status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: publicKey()
    }],
    evaluationTime: FIXED_TIME
  });

  const { proxy: revokedValue, revoke } = Proxy.revocable({}, {});
  revoke();
  assertMalformed(inputFor(revokedValue));

  const throwingOwnKeys = new Proxy({}, {
    getPrototypeOf() { return Object.prototype; },
    ownKeys() { throw new Error('nested ownKeys trap'); }
  });
  assertMalformed(inputFor(throwingOwnKeys));

  const throwingDescriptor = new Proxy({}, {
    getPrototypeOf() { return Object.prototype; },
    ownKeys() { return ['value']; },
    getOwnPropertyDescriptor() { throw new Error('nested descriptor trap'); }
  });
  assertMalformed(inputFor(throwingDescriptor));

  let getterCalls = 0;
  const accessorValue = {};
  Object.defineProperty(accessorValue, 'secret', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'must-not-run';
    }
  });
  assertMalformed(inputFor(accessorValue));
  assert.equal(getterCalls, 0, 'nested accessors must never be invoked');
});

test('F. key bytes are copied at record-snapshot time before later record side effects', () => {
  const ref = 'test-key:a6a-deep-snapshot';
  const original = publicKey();
  const expected = Buffer.from(original);
  const poisonRef = 'test-key:a6a-nonmatching-poison';
  const poisonTarget = {
    keyReference: poisonRef,
    status: 'revoked',
    expiresAt: '2026-12-31T23:59:59.000Z'
  };
  let mutated = false;
  const poison = new Proxy(poisonTarget, {
    ownKeys(target) {
      if (!mutated) {
        original.fill(0xEE);
        mutated = true;
      }
      return Reflect.ownKeys(target);
    }
  });

  const result = assertActive({
    keyReference: ref,
    records: [{
      keyReference: ref,
      status: 'active',
      expiresAt: '2026-12-31T23:59:59.000Z',
      publicKeySpkiDer: original
    }, poison],
    evaluationTime: FIXED_TIME
  }, ref);

  assert.equal(mutated, true, 'later record triggered its side effect');
  assert.ok(result.publicKeySpkiDer.equals(expected), 'output uses bytes captured before later mutation');
  assert.equal(result.publicKeySpkiDer.equals(original), false, 'output is isolated from mutated caller bytes');
});

// ---------------------------------------------------------------------------
// G. A6 adversarial coverage - resource bounds and poisoning precedence
// ---------------------------------------------------------------------------

function activeRecord(keyReference, overrides = {}) {
  return {
    keyReference,
    status: 'active',
    expiresAt: '2026-12-31T23:59:59.000Z',
    publicKeySpkiDer: publicKey(),
    ...overrides
  };
}

function resolverInput(keyReference, records) {
  return { keyReference, records, evaluationTime: FIXED_TIME };
}

function assertNoKeyMaterial(result) {
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'publicKeySpkiDer'), false);
}

test('G. resource-bound records remain finite without inventing a max-records contract', () => {
  const ref = 'test-key:a6-resource';
  exact(resolveTrustedKeyState(resolverInput(ref, [])), {
    keyState: 'unknown',
    reasonCategory: 'unknown_key'
  });

  const single = assertActive(resolverInput(ref, [activeRecord(ref)]), ref);
  assert.ok(single.publicKeySpkiDer.equals(publicKey()));

  const largeDense = Array.from({ length: 512 }, (_, index) => ({
    keyReference: `test-key:a6-nonmatch-${index}`,
    status: 'unknown'
  }));
  const startedAt = process.hrtime.bigint();
  const largeResult = resolveTrustedKeyState(resolverInput(ref, largeDense));
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  exact(largeResult, { keyState: 'unknown', reasonCategory: 'unknown_key' });
  assert.ok(elapsedMs < 1500, `large dense input should stay bounded, got ${elapsedMs}ms`);

  const sparse = [];
  sparse.length = 2048;
  sparse[2047] = activeRecord(ref);
  assertMalformed(resolverInput(ref, sparse));

  const accessorBacked = [];
  accessorBacked.length = 2;
  accessorBacked[0] = activeRecord('test-key:a6-other');
  let indexGetterCalls = 0;
  Object.defineProperty(accessorBacked, '1', {
    enumerable: true,
    configurable: true,
    get() {
      indexGetterCalls += 1;
      return activeRecord(ref);
    }
  });
  assertMalformed(resolverInput(ref, accessorBacked));
  assert.equal(indexGetterCalls, 0, 'array index getter must not be invoked');
});

test('G. selected and nonselected poisoning precedence is explicit', () => {
  const ref = 'test-key:a6-poisoning';
  const selected = activeRecord(ref);
  const boundedMalformedState = {
    keyReference: 'test-key:a6-nonmatching-malformed-state',
    status: 'malformed',
    publicKeySpkiDer: publicKey()
  };

  assertActive(resolverInput(ref, [boundedMalformedState, selected]), ref);
  assertActive(resolverInput(ref, [selected, boundedMalformedState]), ref);

  for (const poison of [
    { ...activeRecord('test-key:a6-poison-unknown-field'), unexpected: true },
    (() => {
      const record = activeRecord('test-key:a6-poison-accessor');
      Object.defineProperty(record, 'publicKeySpkiDer', {
        enumerable: true,
        configurable: true,
        get() { return publicKey(); }
      });
      return record;
    })(),
    new Proxy(activeRecord('test-key:a6-poison-proxy'), {
      getPrototypeOf() { throw new Error('nonmatching prototype trap'); }
    })
  ]) {
    assertMalformed(resolverInput(ref, [poison, selected]));
    assertMalformed(resolverInput(ref, [selected, poison]));
  }

  assertMalformed(resolverInput(ref, [
    activeRecord(ref),
    { keyReference: ref, status: 'malformed', publicKeySpkiDer: publicKey() }
  ]));
  assertMalformed(resolverInput(ref, [
    activeRecord(ref),
    activeRecord(ref, { status: 'revoked' })
  ]));
});

// ---------------------------------------------------------------------------
// H. A6 adversarial coverage - typed arrays and descriptors
// ---------------------------------------------------------------------------

test('H. typed-array matrix enforces exact visible 44-byte fresh bytes', () => {
  const ref = 'test-key:a6-typed-array';
  const exactBuffer = Buffer.from(publicKey());
  assertActive(resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: exactBuffer })]), ref);

  const exactUint8 = new Uint8Array(publicKey());
  const uint8Result = assertActive(
    resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: exactUint8 })]),
    ref
  );
  assert.ok(uint8Result.publicKeySpkiDer.equals(publicKey()));
  assert.notEqual(uint8Result.publicKeySpkiDer, exactUint8);

  for (const key of [
    new Uint8Array(0),
    new Uint8Array(43),
    new Uint8Array(45),
    Buffer.alloc(43),
    Buffer.alloc(45)
  ]) {
    assertMalformed(resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: key })]));
  }

  const backing = new Uint8Array(80);
  backing.fill(0xaa);
  const offsetView = new Uint8Array(backing.buffer, 16, 44);
  offsetView.set(publicKey());
  backing.fill(0xbb, 60);
  const offsetResult = assertActive(
    resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: offsetView })]),
    ref
  );
  assert.ok(offsetResult.publicKeySpkiDer.equals(publicKey()));
  assert.equal(offsetResult.publicKeySpkiDer.includes(0xaa), false);
  assert.equal(offsetResult.publicKeySpkiDer.includes(0xbb), false);
  backing.fill(0xcc);
  assert.ok(offsetResult.publicKeySpkiDer.equals(publicKey()));

  class CustomUint8Array extends Uint8Array {}
  assertMalformed(resolverInput(ref, [
    activeRecord(ref, { publicKeySpkiDer: new CustomUint8Array(44) })
  ]));

  const { proxy, revoke } = Proxy.revocable(new Uint8Array(publicKey()), {});
  revoke();
  assertMalformed(resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: proxy })]));

  if (typeof SharedArrayBuffer === 'function') {
    const shared = new Uint8Array(new SharedArrayBuffer(44));
    shared.set(publicKey());
    const sharedResult = assertActive(
      resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: shared })]),
      ref
    );
    assert.ok(sharedResult.publicKeySpkiDer.equals(publicKey()));
    assert.notEqual(sharedResult.publicKeySpkiDer.buffer, shared.buffer);
  }
});

test('H. descriptor and prototype attacks fail closed without raw exceptions', () => {
  const ref = 'test-key:a6-descriptor';
  const nullProtoRecord = Object.assign(Object.create(null), activeRecord(ref));
  assertActive(resolverInput(ref, [nullProtoRecord]), ref);

  const customProto = Object.create({ inherited: true });
  Object.assign(customProto, activeRecord(ref));
  assertMalformed(resolverInput(ref, [customProto]));

  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const root = resolverInput(ref, [activeRecord(ref)]);
    Object.defineProperty(root, key, {
      enumerable: true,
      configurable: true,
      value: true
    });
    assertMalformed(root);
  }

  const symbolRoot = resolverInput(ref, [activeRecord(ref)]);
  symbolRoot[Symbol('poison')] = true;
  assertMalformed(symbolRoot);

  const nonEnumerableAllowed = activeRecord(ref);
  Object.defineProperty(nonEnumerableAllowed, 'publicKeySpkiDer', {
    enumerable: false,
    configurable: true,
    value: publicKey()
  });
  // Reflect.ownKeys sees non-enumerable own data fields, so this remains a
  // bounded accepted key rather than an accessor/prototype bypass.
  assertActive(resolverInput(ref, [nonEnumerableAllowed]), ref);

  const nonEnumerableForbidden = activeRecord(ref);
  Object.defineProperty(nonEnumerableForbidden, 'secret', {
    enumerable: false,
    configurable: true,
    value: 'synthetic'
  });
  assertMalformed(resolverInput(ref, [nonEnumerableForbidden]));

  assertMalformed(new Proxy(resolverInput(ref, [activeRecord(ref)]), {
    ownKeys() { throw new Error('root ownKeys trap'); }
  }));
  assertMalformed(resolverInput(ref, [
    new Proxy(activeRecord(ref), {
      ownKeys() { throw new Error('record ownKeys trap'); }
    })
  ]));
  assertActive(resolverInput(ref, new Proxy([activeRecord(ref)], {
    ownKeys() { throw new Error('records ownKeys trap'); }
  })), ref);
  assertMalformed(resolverInput(ref, new Proxy([activeRecord(ref)], {
    getOwnPropertyDescriptor() { throw new Error('records descriptor trap'); }
  })));

  const { proxy, revoke } = Proxy.revocable(activeRecord(ref), {});
  revoke();
  assertMalformed(resolverInput(ref, [proxy]));
});

// ---------------------------------------------------------------------------
// I. A6 adversarial coverage - determinism, lifecycle, recursion, output
// ---------------------------------------------------------------------------

test('I. repeated-call determinism has no hidden state or alias accumulation', () => {
  const ref = 'test-key:a6-repeat';
  const key = publicKey();
  const input = resolverInput(ref, [activeRecord(ref, { publicKeySpkiDer: key })]);
  const first = resolveTrustedKeyState(input);

  for (let index = 0; index < 100; index += 1) {
    const next = resolveTrustedKeyState(input);
    assert.deepEqual(next, first);
    assert.notEqual(next.publicKeySpkiDer, first.publicKeySpkiDer);
    assert.ok(next.publicKeySpkiDer.equals(publicKey()));
  }

  first.publicKeySpkiDer.fill(0xee);
  const afterOutputMutation = resolveTrustedKeyState(input);
  assert.ok(afterOutputMutation.publicKeySpkiDer.equals(publicKey()));

  key.fill(0xdd);
  const afterCallerMutation = resolveTrustedKeyState(input);
  assert.equal(afterCallerMutation.keyState, 'active');
  assert.ok(afterCallerMutation.publicKeySpkiDer.equals(Buffer.alloc(44, 0xdd)));
  assert.notEqual(afterCallerMutation.publicKeySpkiDer, key);
});

test('I. lifecycle precedence matrix stays fail-closed and bounded', () => {
  const ref = 'test-key:a6-lifecycle';
  const stateRecord = (status) => activeRecord(ref, {
    status,
    ...(status === 'expired' ? { expiresAt: '2026-01-01T00:00:00.000Z' } : {})
  });

  for (const records of [
    [stateRecord('active'), stateRecord('revoked')],
    [stateRecord('active'), stateRecord('expired')],
    [stateRecord('revoked'), stateRecord('expired')],
    [stateRecord('active'), stateRecord('active')],
    [stateRecord('revoked'), stateRecord('revoked')],
    [stateRecord('unavailable'), { ...stateRecord('malformed'), publicKeySpkiDer: publicKey() }]
  ]) {
    assertMalformed(resolverInput(ref, records));
  }

  assertMalformed(resolverInput(ref, [
    { ...activeRecord(ref), unknownField: true },
    activeRecord('test-key:a6-valid-nonmatching')
  ]));
  assertMalformed(resolverInput(ref, [
    activeRecord(ref),
    { ...activeRecord('test-key:a6-malformed-nonmatching'), unknownField: true }
  ]));
});

test('I. forbidden-content recursion rejects deep, cyclic, shared, and mixed-case poison', () => {
  const ref = 'test-key:a6-forbidden-recursion';
  const withMetadata = (metadata) => resolverInput(ref, [
    activeRecord(ref, { metadata })
  ]);

  assertMalformed(withMetadata({ level1: { level2: { privateKey: 'synthetic' } } }));
  assertMalformed(withMetadata({ level1: [{ level2: [{ networkEndpoint: 'https://example.invalid' }] }] }));
  assertMalformed(withMetadata({ Secret: 'synthetic' }));
  assertMalformed(withMetadata({ nested: { publicKeySpkiDer: publicKey() } }));

  const cyclicObject = {};
  cyclicObject.self = cyclicObject;
  assertMalformed(withMetadata(cyclicObject));

  const cyclicArray = [];
  cyclicArray.push(cyclicArray);
  assertMalformed(withMetadata({ nested: cyclicArray }));

  const sharedChild = { token: 'synthetic' };
  assertMalformed(withMetadata({ a: sharedChild, b: sharedChild }));
});

test('I. output confinement is exact for active and every non-active result', () => {
  const ref = 'test-key:a6-output';
  const active = resolveTrustedKeyState(resolverInput(ref, [activeRecord(ref)]));
  assert.deepEqual(Object.keys(active).sort(), ['keyReference', 'keyState', 'publicKeySpkiDer']);
  assert.equal(active.keyReference, ref);
  assert.ok(Buffer.isBuffer(active.publicKeySpkiDer));
  assert.equal(active.publicKeySpkiDer.length, 44);

  const nonActiveInputs = [
    resolverInput(ref, []),
    resolverInput(ref, [activeRecord(ref, { status: 'revoked' })]),
    resolverInput(ref, [activeRecord(ref, { status: 'unavailable' })]),
    resolverInput(ref, [activeRecord(ref, { status: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' })]),
    resolverInput(ref, [activeRecord(ref, { status: 'unknown' })]),
    resolverInput(ref, [{ ...activeRecord(ref), unknownField: true }])
  ];

  for (const input of nonActiveInputs) {
    const result = resolveTrustedKeyState(input);
    assert.notEqual(result.keyState, 'active');
    assert.deepEqual(Object.keys(result).sort(), ['keyState', 'reasonCategory']);
    assertNoKeyMaterial(result);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'keyReference'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'trusted'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'authorized'), false);
  }
});
