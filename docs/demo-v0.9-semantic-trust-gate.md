# AXIOM v0.9 Semantic Trust Gate Demo

This is a 60-second walkthrough for AXIOM v0.9.0.

## Goal

Show that AXIOM can judge claims instead of merely echoing text.

## Walkthrough

1. Teach AXIOM a few true facts.
   - TODO: use the existing learn path already present in the repo.
   - Example: `B737 has 2 engines`
   - Example: `EDDF is in Frankfurt`
   - Example: `TCAS detects traffic`

2. Verify a true claim.
   - Example: `B737 has 2 engines`
   - Expected: `dogrulandi`
   - Expected: evidence and semantic metadata stay stable

3. Verify a weak or unsafe claim.
   - Example: `B737 has 4 engines`
   - Expected: not verified as truth
   - Expected: the weak partial match stays downgraded

4. Verify a contradiction.
   - Example: `EDDF is in Paris`
   - Expected: `celiski` or a non-verified downgraded result

5. Show the reasoning trace.
   - Example: a compound claim that splits into subclaims
   - Expected: the trace shows supported and contradicted subclaims separately

6. Confirm the safety rule.
   - Weak partial overlap must not become verified truth.
   - Adversarial wording must stay in risk metadata, not in the core verified status.

## Notes

- Use the existing CLI, REST, or MCP entry points already present in the repo.
- Do not invent new commands here.
- If a concrete command is unclear, keep this as a conceptual demo with TODO placeholders.
