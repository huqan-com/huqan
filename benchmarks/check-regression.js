const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function evaluateRegression(baseline, current, opts = {}) {
  const metrics = opts.metrics || ['learn', 'ask', 'verify', 'reason', 'compare', 'dream'];
  const allowedMultiplier = opts.allowedMultiplier ?? 1.75;
  const failures = [];

  for (const [fixtureName, baseFixture] of Object.entries(baseline.fixtures || {})) {
    const curFixture = (current.results || []).find(item => item.label === fixtureName);
    if (!curFixture) {
      failures.push(`Missing benchmark fixture: ${fixtureName}`);
      continue;
    }

    if (curFixture.nodes < baseFixture.nodes) {
      failures.push(`${fixtureName}.nodes regressed: ${curFixture.nodes} < ${baseFixture.nodes}`);
    }
    if (curFixture.edges < baseFixture.edges) {
      failures.push(`${fixtureName}.edges regressed: ${curFixture.edges} < ${baseFixture.edges}`);
    }

    for (const metric of metrics) {
      const curValue = curFixture?.[metric]?.avgMs;
      const baseValue = baseFixture?.[metric];
      if (!isFiniteNumber(curValue) || !isFiniteNumber(baseValue)) {
        failures.push(`${fixtureName}.${metric} is not numeric`);
        continue;
      }
      const limit = baseValue * allowedMultiplier;
      if (curValue > limit) {
        failures.push(
          `${fixtureName}.${metric}: ${curValue.toFixed(3)}ms > ${limit.toFixed(3)}ms (baseline ${baseValue.toFixed(3)}ms)`
        );
      }
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    allowedMultiplier,
  };
}

function printSummary(result, baseline, current) {
  const lines = [];
  lines.push('# Benchmark Regression');
  lines.push('');
  lines.push(`- Allowed multiplier: ${result.allowedMultiplier}x`);
  lines.push(`- Baseline version: ${baseline.version || 'unknown'}`);
  lines.push(`- Current iterations: ${current.iterations || 'unknown'}`);
  lines.push('');

  if (result.ok) {
    lines.push('Status: PASS');
  } else {
    lines.push('Status: FAIL');
    lines.push('');
    for (const failure of result.failures) {
      lines.push(`- ${failure}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

if (require.main === module) {
  const baselinePath = process.argv[2] || path.join(__dirname, 'results.json');
  const currentPath = process.argv[3] || path.join(__dirname, 'current-results.json');
  const allowedMultiplierArg = process.argv.find(arg => arg.startsWith('--multiplier='));
  const allowedMultiplier = allowedMultiplierArg ? Number(allowedMultiplierArg.split('=')[1]) : 1.75;

  const baseline = readJson(baselinePath);
  const current = readJson(currentPath);
  const result = evaluateRegression(baseline, current, { allowedMultiplier });
  const summary = printSummary(result, baseline, current);
  process.stdout.write(summary);

  if (!result.ok) process.exit(1);
}

module.exports = {
  evaluateRegression,
  printSummary,
};
