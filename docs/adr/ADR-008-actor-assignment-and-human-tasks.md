# ADR-008: Actor Registry, Human Tasks, and Central Delegation

**Status:** Accepted  
**Date:** 2026-04-04

## Context

The system already supported agent-oriented task execution, but it did not have a formal model for:

- assigning a task directly to a named human
- persisting role/context per human or agent
- allowing the central orchestrator to choose the best human or agent for a task
- waiting for a manual human result inside the same mission state machine

This made the runtime good for automatic worker execution, but weak for hybrid human + agent collaboration.

## Decision

Introduce a first-class **Actor Registry** and extend `Task` assignment semantics.

### New concepts

- `Actor`
  - human, agent, or system actor
  - has `role`, `context`, `supportedAgentTypes`, and delegation flags
- `Task.assignmentMode`
  - `DIRECT`
  - `ORCHESTRATOR`
- `Task.requestedActorId`
  - who was requested by the user/planner
- `Task.resolvedActorId`
  - who will actually execute the task
- `Task.actorSnapshot`
  - assignment context snapshot stored at task level for auditability

### Human task behavior

- if a resolved actor is human, the task is not enqueued to BullMQ
- instead it transitions to `WAITING_RESULT`
- the dashboard can submit a manual result for that task
- the result is persisted in `TaskRun`, `Artifact`, and `EventLog`

### Central delegation behavior

- if a task is created with `assignmentMode=ORCHESTRATOR`, the central orchestrator selects the best eligible actor
- selection uses actor role/context/support data
- LLM selection is used when available, with heuristic fallback

## Rationale

- preserves the existing durable mission/task runtime
- adds hybrid collaboration without inventing a separate human workflow system
- keeps humans and agents visible in the same dashboard and event history
- allows future evolution toward richer actor editing, permissions, and availability

## Consequences

- the data model is now more expressive but also more coupled to actor metadata
- task lifecycle now includes manual completion paths
- `TaskStatus.WAITING_RESULT` is now used at task level, not only mission level
- dashboard and API must treat actor snapshots and assignment reasons as first-class data
- default actors are bootstrapped automatically; future work can add UI for editing their role/context
