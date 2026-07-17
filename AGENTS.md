# Project Agent Guidance

## Priority and Project Context

- These instructions apply to the entire repository.
- These efficiency defaults yield to system and user instructions, safety, correctness, and repository state. Avoid duplicated work, never necessary reasoning or verification.
- This is a static browser photo-booth using HTML, CSS, and vanilla JavaScript ES modules. Follow existing module and `node:test` conventions; there is no compilation step.
- User photos, face landmarks, segmentation masks, and composed canvases must remain in the browser. Do not add uploads, remote processing, analytics, or telemetry without explicit user approval.

## Task and Context Boundaries

- Treat each user-visible Codex task as one independent top-level objective with its own deliverable and completion criteria. Keep related implementation, debugging, review, testing, fixes, and verification in that task.
- When a request is materially separate from the active top-level objective, propose moving it to a new user-visible Codex task before implementation. Create and hand off to the new task only after the user confirms; otherwise continue in the current task.
- Treat a coherent feature as the largest normal subagent boundary within the current task. Use a subagent only when the feature is substantial and benefits from independent or parallel execution, especially when file and dependency overlap is low.
- Subagent creation is optional, not automatic. Do not split one feature across multiple subagents unless its internal parts are independently substantial and genuinely parallel. Keep small, sequential, or conflict-prone features with the main agent.
- Treat exploration, focused edits, tests, verification, and similar feature-internal work as subtasks. The agent that owns the feature handles these directly without creating another agent or user-visible task.
- The main task owns coordination, integration, conflict resolution, and final verification.
- Search narrowly first with file names, symbols, call sites, errors, tests, and recent changes. Expand only when dependencies or impact require it.
- Do not repeat completed exploration or reread unchanged files without reason. Reinspect when files may have changed, evidence is stale, or context is missing.
- Treat handoffs as operational briefs, not substitutes for the workspace. Include only: objective, confirmed decisions, assumptions, status, relevant files and symbols, constraints, completed verification, risks or blockers, and remaining work. Reverify uncertain or high-risk claims.

## Implementation Rules

- Make the smallest coherent change that satisfies the request. Preserve unrelated user changes and avoid unrelated refactors.
- Follow existing naming, module boundaries, DOM patterns, and test style. Do not add production dependencies, services, or build tooling without explicit approval.
- Do not modify frame images or model binaries unless requested.
- Preserve camera permissions, image upload, Canvas composition, PNG download, responsive layouts, and safe fallback behavior when ML processing fails.
- Add focused tests for behavior changes, covering the happy path, relevant edges, failure fallback, and regression.

## Review and Verification

- Run `npm test` after JavaScript, CSS, HTML, model-path, or asset-contract changes. Documentation-only changes require at least `git diff --check` and targeted content review.
- For visual, camera, upload, composition, or download behavior, run `npm run dev` and perform relevant browser checks when possible.
- Perform one full-scope review per objective, then reverify changed areas and dependencies. Broaden checks for shared modules, compatibility, privacy, camera permissions, image processing, downloads, or potential data loss.
- Do not claim completion until relevant commands and observations are confirmed. Report anything not verified.

## Retries and Reporting

- Do not repeat the same failed approach without new evidence. If the same failure occurs twice under substantially the same hypothesis, stop and form a new evidence-based hypothesis.
- Report a blocker only when progress requires user input, authority, unavailable resources, or an external state change. Include evidence, attempted approaches, failure reasons, and remaining options.
- Final responses should lead with the outcome and concisely list changed files, verification results, unresolved risks, and required user decisions. Do not repeat the full work history.
