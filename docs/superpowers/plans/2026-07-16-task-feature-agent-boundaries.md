# Task, Feature, and Agent Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repository's current task-boundary guidance with the approved task, feature, and subtask hierarchy.

**Architecture:** Keep all agent coordination rules in the existing `Task and Context Boundaries` section of `AGENTS.md`. A user-visible Codex task owns one top-level objective, optional subagents own coherent features inside that task, and small subtasks remain with their current agent.

**Tech Stack:** Markdown repository guidance

## Global Constraints

- Ask for user confirmation before creating a new user-visible Codex task.
- Keep related implementation, debugging, review, testing, and fixes in the active task.
- Use subagents only at coherent feature boundaries when independent or parallel execution provides a clear benefit.
- Do not create additional agents for feature-internal subtasks.
- Keep integration, conflict resolution, and final verification with the main task.
- Preserve all unrelated repository guidance and user changes.

---

### Task 1: Update Task and Agent Boundaries

**Files:**
- Modify: `AGENTS.md`
- Reference: `docs/superpowers/specs/2026-07-16-task-feature-agent-boundaries-design.md`

**Interfaces:**
- Consumes: The approved hierarchy and decision flow in the design document.
- Produces: Repository-wide operating instructions for task creation, feature delegation, subtasks, and handoffs.

- [ ] **Step 1: Replace the existing task and subagent boundary bullets**

Replace the first two bullets under `## Task and Context Boundaries` with:

```markdown
- Treat each user-visible Codex task as one independent top-level objective with its own deliverable and completion criteria. Keep related implementation, debugging, review, testing, fixes, and verification in that task.
- When a request is materially separate from the active top-level objective, propose moving it to a new user-visible Codex task before implementation. Create and hand off to the new task only after the user confirms; otherwise continue in the current task.
- Treat a coherent feature as the largest normal subagent boundary within the current task. Use a subagent only when the feature is substantial and benefits from independent or parallel execution, especially when file and dependency overlap is low.
- Subagent creation is optional, not automatic. Do not split one feature across multiple subagents unless its internal parts are independently substantial and genuinely parallel. Keep small, sequential, or conflict-prone features with the main agent.
- Treat exploration, focused edits, tests, verification, and similar feature-internal work as subtasks. The agent that owns the feature handles these directly without creating another agent or user-visible task.
- The main task owns coordination, integration, conflict resolution, and final verification.
```

- [ ] **Step 2: Review the full guidance for consistency**

Run:

```bash
sed -n '1,220p' AGENTS.md
```

Expected: The `Task and Context Boundaries` section defines the task → feature → subtask hierarchy without contradicting the surrounding search, handoff, implementation, or verification rules.

- [ ] **Step 3: Check Markdown whitespace and inspect the exact change**

Run:

```bash
git diff --check -- AGENTS.md docs/superpowers/specs/2026-07-16-task-feature-agent-boundaries-design.md docs/superpowers/plans/2026-07-16-task-feature-agent-boundaries.md
git diff --no-index /dev/null AGENTS.md
```

Expected: `git diff --check` reports no whitespace errors. Because `AGENTS.md` is currently untracked, `git diff --no-index` exits with status 1 while displaying the complete file as an addition; inspect the `Task and Context Boundaries` section in that output.

- [ ] **Step 4: Confirm repository status without staging or committing**

Run:

```bash
git status --short
```

Expected: `AGENTS.md`, the approved design document, and this plan remain untracked unless the user separately requests staging or committing. No unrelated files are changed.
