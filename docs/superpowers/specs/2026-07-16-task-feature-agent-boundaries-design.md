# Task, Feature, and Agent Boundaries

## Goal

Keep long-running context organized without creating excessive Codex tasks or
subagents. Use a clear hierarchy in which a user-visible task owns one
top-level objective, while optional subagents handle coherent features inside
that task.

## Work Hierarchy

### Task: User-Visible Codex Thread

A task is an independent top-level objective with its own deliverable and
completion criteria. When a new request is materially separate from the active
objective, the agent should propose moving it to a new task before beginning
implementation.

The agent must receive user confirmation before creating the new task. If the
user declines, the work remains in the current task.

### Feature: Optional Subagent Scope

A feature is a coherent child deliverable within the current task. A feature
may be assigned to a subagent when it can be implemented and verified largely
independently, especially when multiple features can proceed in parallel with
little overlap in files or dependencies.

Subagent creation is optional, not automatic. The main agent should avoid
creating a subagent when the feature is small, tightly sequential, or likely to
conflict with work in the same files. A single feature should not be split
across multiple subagents unless its internal parts are independently
substantial and genuinely parallel.

### Subtask: No Additional Agent

Exploration, focused edits, tests, verification, and other steps within a
feature are subtasks. The main agent or the feature's assigned subagent handles
these directly without creating another agent or user-visible task.

## Decision Flow

1. Determine whether the request changes the active top-level objective.
2. If it is a separate objective, propose a new task and wait for confirmation.
3. If it belongs to the current objective, keep it in the same task.
4. Identify coherent features and delegate only those that benefit from
   independent or parallel execution.
5. Keep feature-internal subtasks with the agent that owns the feature.
6. Keep integration, conflict resolution, and final verification with the main
   task.

## Handoff Requirements

When the user approves a new task, provide a concise operational brief that
contains only the objective, confirmed decisions, assumptions, current status,
relevant files and symbols, constraints, completed verification, risks or
blockers, and remaining work. The new task must reverify uncertain or
high-risk claims against the workspace.

## Non-Goals

- Do not create a new task for every request or follow-up.
- Do not create a subagent for every feature by default.
- Do not create agents for small implementation steps or verification commands.
- Do not move debugging, review, testing, or fixes related to the active
  objective into separate tasks solely to reduce context size.

## Acceptance Criteria

- Independent top-level objectives are separated only after user confirmation.
- Related work remains in one user-visible task.
- Subagents are used at coherent feature boundaries when delegation has a clear
  independence or parallelism benefit.
- Small subtasks do not produce additional tasks or agents.
- The main task remains responsible for integration and final verification.
