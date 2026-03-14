# ADR-003: Mission Planning — One-Shot vs Dynamic Replanning

**Status:** Accepted
**Date:** 2026-03-13

## Decision
One-shot planning for Sprint 2. The orchestrator generates the full task list in a single LLM call at mission start.

## Rationale
- Simpler state machine
- Easier to audit and debug
- Sufficient for the first use case (research → propose changes)
- Dynamic replanning deferred to Phase 2

## Consequences
- Plan cannot adapt to mid-mission discoveries
- Failed tasks cause mission failure (not automatic replanning)
- Phase 2 can add a `REPLANNING` status and retry planner
