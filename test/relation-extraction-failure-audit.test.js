const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const Kernel = require('../kernel');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-rel0-audit-'));

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeKernel(name) {
  const kernel = new Kernel({
    noLoad: true,
    useSQLite: false,
    loadPlugins: false,
    memoryPath: path.join(tempDir, `${name}.json`),
  });
  kernel._autoMaintain = () => {};
  kernel.maintenanceEvery = Number.MAX_SAFE_INTEGER;
  kernel._learnCount = 0;
  return kernel;
}

function auditStatement(text) {
  const kernel = makeKernel(text.replace(/\W+/g, '-').toLowerCase());
  const learn = kernel.learn(text, { workspaceId: 'default' });
  const facts = kernel.extractFacts(text, kernel.graph.getNodes('default'));
  const subject = facts[0]?.subject || '';
  const predicate = facts[0]?.predicate || '';
  const edge = subject ? kernel.graph.getEdges(subject, 'default')[0] : null;

  return {
    text,
    learn,
    extractedSubject: subject,
    extractedPredicate: predicate,
    graphEdgeRelation: edge?.relation || null,
    graphEdgeObject: edge?.to || null,
    edge,
    kernel,
  };
}

function classifyFinding(result, expectedRelation, options = {}) {
  const relation = result.graphEdgeRelation;
  const object = result.graphEdgeObject || '';
  const expectedObjectHints = options.expectedObjectHints || [];
  const cleanRelation = relation === expectedRelation;
  const cleanObject = expectedObjectHints.length === 0
    ? true
    : expectedObjectHints.some((hint) => object.includes(hint));
  const extraTokensBeyondHint = expectedObjectHints.some((hint) => {
    const normalizedHint = String(hint).trim();
    return normalizedHint && object !== normalizedHint;
  });

  if (options.neutral) {
    return relation === 'tür' || relation === 'özellik'
      ? 'neutral_correctly_not_causal'
      : 'false_causal_relation';
  }

  if (cleanRelation && cleanObject) return 'clean_relation_extracted';
  if (cleanRelation && !cleanObject) return 'object_swallowed_into_predicate';
  if (!cleanRelation && relation === 'tür') return 'relation_drift';
  if (!cleanRelation && cleanObject && extraTokensBeyondHint) return 'object_swallowed_into_predicate';
  if (!cleanRelation && expectedObjectHints.some((hint) => object.includes(hint))) return 'relation_drift';
  if (!cleanRelation && relation && object) return 'object_swallowed_into_predicate';
  if (!relation) return 'unsupported_pattern';
  return 'relation_drift';
}

test('relation extraction audit captures current raw-text causal extraction gaps', () => {
  const cases = [
    {
      text: 'Sigara kanser yapar',
      expectedRelation: 'CAUSES',
      expectedObjectHints: ['kanser'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Sigara kansere neden olur',
      expectedRelation: 'CAUSES',
      expectedObjectHints: ['kanser'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Smoking causes cancer',
      expectedRelation: 'CAUSES',
      expectedObjectHints: ['cancer'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Stress causes insomnia',
      expectedRelation: 'CAUSES',
      expectedObjectHints: ['insomnia'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Yuksek sicaklik basinci artirir',
      expectedRelation: 'CAUSES',
      expectedObjectHints: ['basinc'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Asilama hastaligi onler',
      expectedRelation: 'PREVENTS',
      expectedObjectHints: ['hastalik'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Asilama hastaligi engeller',
      expectedRelation: 'PREVENTS',
      expectedObjectHints: ['hastalik'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Vaccination prevents disease',
      expectedRelation: 'PREVENTS',
      expectedObjectHints: ['disease'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Firewall blocks unauthorized access',
      expectedRelation: 'PREVENTS',
      expectedObjectHints: ['unauthorized access'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Deployment testlerin gecmesine baglidir',
      expectedRelation: 'DEPENDS_ON',
      expectedObjectHints: ['test'],
      expectedClassification: 'relation_drift',
    },
    {
      text: 'Deployment requires passing tests',
      expectedRelation: 'DEPENDS_ON',
      expectedObjectHints: ['passing tests'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Build depends on dependencies',
      expectedRelation: 'DEPENDS_ON',
      expectedObjectHints: ['dependencies'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'API anahtari erisimi mumkun kilar',
      expectedRelation: 'ENABLES',
      expectedObjectHints: ['erisim'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Authentication enables secure access',
      expectedRelation: 'ENABLES',
      expectedObjectHints: ['secure access'],
      expectedClassification: 'object_swallowed_into_predicate',
    },
    {
      text: 'Aspirin beyaz tablettir',
      expectedRelation: null,
      expectedObjectHints: ['beyaz tablet'],
      expectedClassification: 'neutral_correctly_not_causal',
      neutral: true,
    },
    {
      text: 'B737 bir ucaktir',
      expectedRelation: null,
      expectedObjectHints: ['ucak'],
      expectedClassification: 'neutral_correctly_not_causal',
      neutral: true,
    },
    {
      text: 'React Native bir frameworktur',
      expectedRelation: null,
      expectedObjectHints: ['framework'],
      expectedClassification: 'neutral_correctly_not_causal',
      neutral: true,
    },
  ];

  const findings = cases.map((entry) => {
    const result = auditStatement(entry.text);
    const classification = classifyFinding(result, entry.expectedRelation, entry);

    return {
      statement: entry.text,
      extractedSubject: result.extractedSubject,
      extractedRelation: result.extractedPredicate,
      graphEdgeRelation: result.graphEdgeRelation,
      graphEdgeObject: result.graphEdgeObject,
      classification,
      expectedClassification: entry.expectedClassification,
    };
  });

  for (const finding of findings) {
    assert.strictEqual(
      finding.classification,
      finding.expectedClassification,
      `unexpected relation extraction classification for: ${finding.statement}`
    );
  }

  const cleanCausalExtractions = findings.filter((finding) => finding.classification === 'clean_relation_extracted');
  assert.strictEqual(cleanCausalExtractions.length, 0, 'raw-text audit should show no clean causal relation extraction for the tested patterns');

  const preventsAudit = auditStatement('Asilama hastaligi onler');
  const contradictionVerify = preventsAudit.kernel.verify('Asilama hastaliga neden olur', { workspaceId: 'default' });
  assert.strictEqual(preventsAudit.graphEdgeRelation, 'yapabilir');
  assert.strictEqual(preventsAudit.graphEdgeObject, 'hastaligi onler');
  assert.strictEqual(contradictionVerify.data.status, 'celiski');
  assert.ok(
    contradictionVerify.meta?.semanticTrust?.warnings?.includes('CAUSE_PREVENT_OPPOSITION'),
    'contradiction currently depends on semantic opposition fallback rather than a clean PREVENTS graph edge'
  );

  const summary = {
    causes: findings.filter((finding) => finding.statement.includes('causes') || finding.statement.includes('neden olur') || finding.statement.includes('yapar') || finding.statement.includes('artirir')),
    prevents: findings.filter((finding) => finding.statement.includes('onler') || finding.statement.includes('engeller') || finding.statement.includes('prevents') || finding.statement.includes('blocks')),
    dependsOn: findings.filter((finding) => finding.statement.includes('baglidir') || finding.statement.includes('requires') || finding.statement.includes('depends')),
    enables: findings.filter((finding) => finding.statement.includes('mumkun kilar') || finding.statement.includes('enables')),
    neutral: findings.filter((finding) => finding.expectedClassification === 'neutral_correctly_not_causal'),
  };

  assert.ok(summary.causes.every((finding) => finding.classification !== 'clean_relation_extracted'));
  assert.ok(summary.prevents.every((finding) => finding.classification !== 'clean_relation_extracted'));
  assert.ok(summary.dependsOn.every((finding) => finding.classification !== 'clean_relation_extracted'));
  assert.ok(summary.enables.every((finding) => finding.classification !== 'clean_relation_extracted'));
  assert.ok(summary.neutral.every((finding) => finding.classification === 'neutral_correctly_not_causal'));
});
