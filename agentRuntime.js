const Agent = require('./agent');
const AgentV3 = require('./agent.v3');
const AxiomStorage = require('./storage');

function resolveAgentVersion(opts = {}) {
  return String(opts.version || process.env.AXIOM_AGENT_VERSION || 'v2').toLowerCase();
}

/**
 * Creates the requested agent runtime and wires optional persistent storage.
 *
 * @param {object} [opts]
 * @returns {Agent|AgentV3}
 */
function createAgent(opts = {}) {
  const version = resolveAgentVersion(opts);
  const storage = opts.storage || (() => {
    try {
      const storageOpts = { kernel: opts.kernel };
      if (Object.prototype.hasOwnProperty.call(opts, 'dbPath') && opts.dbPath) {
        storageOpts.dbPath = opts.dbPath;
      }
      return new AxiomStorage(storageOpts);
    } catch (_) {
      return null;
    }
  })();
  if (version === 'v3') {
    return new AgentV3({ ...opts, storage });
  }
  return new Agent({ ...opts, storage });
}

module.exports = {
  createAgent,
  resolveAgentVersion,
  Agent,
  AgentV3,
};
