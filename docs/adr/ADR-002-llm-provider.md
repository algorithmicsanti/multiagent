# ADR-002: LLM Provider and Model Selection

**Status:** Accepted
**Date:** 2026-03-13

## Decision
Use Anthropic SDK with `claude-sonnet-4-6` for all agents in Sprint 1-2.

## Rationale
- Strong instruction-following for structured JSON output
- 200K context window sufficient for research tasks
- Single provider reduces operational complexity
- Haiku available as cost-optimized option for simpler tasks in Phase 2

## Consequences
- Single point of failure if Anthropic API is down
- Cost tracked per TaskRun (`tokensUsed`, `costUsd` fields)
- `ANTHROPIC_API_KEY` required in environment
