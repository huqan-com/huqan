# Changelog

## v0.6.0

Released 2026-06-01.

### Added
- Productization & Shield release promoted from `v0.6.0-rc.1`.
- Finalized v0.6 UI polish, Shield layer, ingest separation, demo smoke, and SDK wrappers.
- Release metadata aligned across package version, README, and release notes.

### Tests
- 348/348 passing.

## v0.5.0-agent-os-discovery

Released 2026-06-01.

### Added
- Workflow Agent OS runtime with deterministic `workflow-agent.js` plan/run core.
- `workflow-runtime.js` as the opt-in orchestration layer for agent + tools.
- Workflow tool adapters for:
  - `verifyClaim`
  - `findContradictions`
  - `rankEvidence`
  - `repoMemory`
  - `companyBrain`
  - `discoveryEngine`
  - `experimentPlanner`
  - `resultAnalyzer`
  - `replicationChecker`
  - `runCapability`
  - `getGraphStats`
- Discovery objective support in `workflow-agent.js` with discovery-specific tool order and step inputs.
- Workflow runtime opt-in via `AXIOM_AGENT_RUNTIME=workflow`.

### Changed
- `repoMemory` and `companyBrain` are treated as Agent OS tools, not standalone phases.
- README status now reflects shipped Workflow Agent OS and discovery skeleton support.

### Tests
- 331/331 passing.

