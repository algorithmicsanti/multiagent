# ADR-001: Orchestrator Trigger — Polling vs Pub/Sub

**Status:** Accepted
**Date:** 2026-03-13

## Context
The orchestrator needs to detect new missions and transition them through states.

## Decision
Use polling every 10 seconds for Sprint 1.

## Rationale
- Simple to implement and debug
- No additional infrastructure (no pub/sub broker)
- Acceptable latency for business missions (not real-time)
- Easily upgradeable to pub/sub in Phase 2

## Consequences
- Maximum 10s latency between mission creation and first tick
- Slightly higher DB read load (mitigated by indexed queries)
- `ORCHESTRATOR_POLL_INTERVAL_MS` env var allows tuning
