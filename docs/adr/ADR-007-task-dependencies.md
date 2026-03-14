# ADR-007: Task Dependency Model

**Status:** Accepted
**Date:** 2026-03-13

## Decision
Flat `dependsOn[]` array of task IDs. No DAG library in Sprint 1.

## Rationale
- First use case is sequential: RESEARCH → FRONTEND/BACKEND
- Simple array is sufficient and easy to inspect
- Dispatcher resolves dependencies by checking COMPLETED status of all depIds
- True DAG with cycles detection deferred to Phase 2

## Consequences
- No cycle detection (trusted LLM output)
- Works for sequential and simple fan-out patterns
- Phase 2 can add topological sort for complex dependency graphs
