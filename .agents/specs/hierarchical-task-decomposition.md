# Hierarchical Task Decomposition

## Context

Swarm CLI currently handles one task per worktree. Large features (e.g., "implement OAuth") require manual decomposition by the user. Research in `.agents/research/hierarchical-task-decomposition.md` explored DAG execution engines, structured LLM output for decomposition, and merge cascade strategies.

## Goal

A user can run `swarm decompose "Implement OAuth login" --max-tasks 5` and the CLI produces a validated DAG of sub-tasks, allocates worktrees, dispatches agents, and aggregates results back into the main branch.

## User-visible behavior

- `swarm decompose <prompt> [--max-tasks N] [--dry-run]` prints a task graph.
- `swarm decompose <prompt> --execute` creates worktrees, launches agents, and waits for completion.
- `swarm merge --cascade agent/oauth-*` merges agent branches in topological order.
- Failed tasks block their dependents; the orchestrator reports which tasks succeeded and which failed.

## Scope

**In scope:**
- LLM-based decomposition with JSON schema output.
- DAG validation (cycle detection) and topological sorting.
- Worktree allocation per sub-task.
- Parallel execution of independent tasks.
- Merge cascade command.

**Non-goals:**
- Automatic retry with modified prompts.
- Cross-repo decomposition.
- Persistent workflow state across CLI restarts (checkpointing).

## Requirements

1. **Decomposition output** — The LLM must return a JSON array of tasks with `id`, `description`, and `dependencies`.
2. **DAG validation** — The orchestrator must reject cyclic dependencies with a clear error message.
3. **Parallel execution** — Independent tasks run concurrently; dependent tasks wait for predecessors.
4. **Worktree naming** — Sub-task worktrees use `agent/{parent-slug}-{subtask-id}`.
5. **Merge cascade** — `swarm merge --cascade <pattern>` merges matching branches in topological order, aborting on the first conflict.

## Constraints

- Must use existing `Workspace` primitives (`worktree_create`, `branch_exists`).
- Must not add Python or heavy workflow-engine dependencies.
- Must respect the existing config system (`swarm.config.json`).

## Design decisions

### Decision: Custom DAG executor in TypeScript

**Chosen:** Implement a minimal `execute_dag()` in `TaskManagement`.

**Considered and rejected:**
- LangGraph — Python-only, heavy dependencies.
- Temporal — requires server infrastructure.
- Makefile — insufficient for dynamic worktree allocation and agent lifecycle management.

### Decision: Merge cascade over patch quilt

**Chosen:** Use native git merge in topological order.

**Considered and rejected:**
- Patch quilt — loses commit history, harder to review.
- Shared worktree — violates isolation, introduces locking complexity.

## Acceptance criteria

- [ ] `swarm decompose "Add dark mode" --dry-run` prints a valid DAG with no cycles.
- [ ] `swarm decompose "Add dark mode" --execute --max-tasks 3` creates exactly 3 worktrees.
- [ ] Two independent tasks in a DAG run in parallel (verify via timestamps in state).
- [ ] A dependent task only starts after its dependency reports `done` in state.
- [ ] `swarm merge --cascade agent/dark-*` merges all branches or stops on first conflict.
- [ ] `pnpm deps:validate` passes.

## Implementation notes

- Add `src/modules/Commands/useCases/decompose.ts` for the command.
- Add `src/modules/TaskManagement/useCases/dag.ts` with `validate_dag()`, `topological_sort()`, and `execute_dag()`.
- The LLM call can reuse the existing config's `defaultAgent` or call a generic OpenAI/Anthropic API. For now, stub the decomposition with a manual JSON input or a local heuristic to avoid API keys.
- `execute_dag` should poll `read_state` for task completion. A future improvement could use the IPC shim for push notifications.

## Test plan

1. Unit test: `validate_dag()` rejects a cycle `[A→B, B→C, C→A]`.
2. Unit test: `topological_sort()` returns `[A, B, C]` for `[C→B, B→A]`.
3. Integration test: Mock `worktree_create` and `launch_agent`; verify `execute_dag` calls them in the correct order.
4. Manual: Run `swarm decompose` with a real prompt and inspect the printed graph.

## Open questions

- [ ] **[CRITICAL]** Which LLM API should decomposition use? The CLI currently has no API client. Should we add one or require the user to paste JSON?
- [ ] **[MINOR]** Should the orchestrator kill running dependents if a dependency fails (fail-fast) or let them finish (fail-late)?

## Tradeoffs and risks

- LLM decomposition quality is unpredictable. A `--dry-run` gate is essential.
- Merge conflicts are likely for large features. The cascade merge must abort cleanly and tell the user which branches conflicted.
- Token cost for decomposition is small but non-zero. Users without API keys cannot use `--execute` unless we provide a local fallback (e.g., manual task list input).
