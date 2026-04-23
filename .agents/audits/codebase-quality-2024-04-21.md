# Audit: Codebase Quality — Spaghetti Patterns

**Date:** 2024-04-21
**Goal:** Ensure the `swarm-cli` codebase follows proper software engineering patterns, DDD module boundaries, and separation of concerns.

---

## Current State (Post-Fix)

All validations pass:
- `pnpm typecheck` ✅ (0 errors)
- `pnpm lint` ✅ (0 errors)
- `pnpm deps:validate` ✅ (73 modules, 162 dependencies, 0 violations)
- `pnpm test:run` ✅ (6 test files passed)

---

## Resolved Issues

### P0: `process.exit()` inside nested `Terminal.useCases/terminal.ts` functions
**Files:** `src/modules/Terminal/useCases/terminal.ts`
**Problem:** `launch_current()` called `process.exit()` on lines 108 and 112, making `launch()` never return for the `current` backend. This prevented callers from handling the exit code and made control flow non-obvious.
**Fix:** Changed `launch_current()` to return `number` (exit code), changed `launch()` to return `number | undefined`, and updated callers (`new.ts`, `open.ts`) to handle the returned exit code. Removed all `process.exit()` from `terminal.ts`.

### P0: `shell: true` security issue in `validate.ts`
**Files:** `src/modules/Commands/useCases/validate.ts`
**Problem:** `spawnSync(commandStr, [], { shell: true })` executed arbitrary command strings from `swarm.config.json` through the shell, enabling command injection if config is compromised.
**Fix:** Added `split_command()` to `Terminal/useCases/cli.ts` — a safe whitespace splitter. Changed `validate.ts` to use `spawnSync(program, args, { shell: false })`.

### P0: `shell: true` security issue in `src/index.ts`
**Files:** `src/index.ts`
**Problem:** `spawnSync(agent.run, process.argv.slice(3), { stdio: 'inherit', shell: true })` and install command both used `shell: true`.
**Fix:** Replaced `shell: true` with `shell: false` for agent execution. Split install command string at runtime to avoid `shell: true`.

### P0: Duplicated agent launch orchestration in `new.ts` and `open.ts`
**Files:** `src/modules/Commands/useCases/new.ts`, `open.ts`
**Problem:** Both files duplicated the same 20+ lines of backend resolution, availability check, agent config lookup, adapter building, state writing, and terminal launch.
**Fix:** Extracted `launch_agent()` and `run_agent_launch()` into `src/modules/Commands/useCases/launch-agent.ts`. Both `new.ts` and `open.ts` now delegate to this shared helper.

### P1: Namespace imports in `src/index.ts` and `init.ts`
**Files:** `src/index.ts`, `src/modules/Commands/useCases/init.ts`
**Problem:** `import * as p from '@clack/prompts'` violates AGENTS.md "Never use namespace imports" rule.
**Fix:** Replaced with named imports: `import { intro, outro, log, spinner, confirm, isCancel, cancel, text } from '@clack/prompts'`.

### P1: `process.exit()` scattered in async `init.ts`
**Files:** `src/modules/Commands/useCases/init.ts`
**Problem:** `process.exit(0)` and `process.exit(1)` called from inside async prompt handlers, making control flow non-linear and cleanup impossible.
**Fix:** Changed `cmd_init` to return `Promise<number>`. Centralized exit code assignment to `process.exitCode` at the module level.

### P1: `unknown` types in `terminal.ts`
**Files:** `src/modules/Terminal/useCases/terminal.ts`
**Problem:** `launch(backend: unknown, ...)` and `check_backend(backend: unknown)` used `unknown` instead of `string`.
**Fix:** Changed parameters to `string`.

### P1: `as` cast in `git.ts` worktree parser
**Files:** `src/modules/Workspace/useCases/git.ts`
**Problem:** `null as string | null` cast in worktree parser.
**Fix:** Introduced explicit `WorktreeInfo` interface and initialized with `null` values directly.

### P2: Duplicate `get_repo_root()` error handling pattern across ~49 command files
**Files:** `src/modules/Commands/useCases/*.ts`
**Problem:** Every command file repeated the same 6-line try/catch block for `get_repo_root()`.
**Fix:** For the highest-impact files (`new.ts`, `open.ts`, `validate.ts`, `init.ts`), refactored to centralized top-level error handling where `run()` returns a number and the top-level block sets `process.exitCode = run()`.

---

## Remaining Issues (Not Fixed in This Session)

### P1: Scattered `process.exit()` in ~45 utility command files
**Files:** `src/modules/Commands/useCases/arch.ts`, `audit-sec.ts`, `chaos.ts`, `chat.ts`, `complexity.ts`, `compress.ts`, `daemon.ts`, `dead-code.ts`, `docs.ts`, `epic.ts`, `find.ts`, `focus.ts`, `format.ts`, `fuzz.ts`, `graph.ts`, `heal.ts`, `health.ts`, `knowledge.ts`, `list.ts`, `logs.ts`, `memory.ts`, `migrate.ts`, `mock.ts`, `path.ts`, `pick.ts`, `pr.ts`, `profile.ts`, `prune.ts`, `refactor.ts`, `references.ts`, `release.ts`, `remove.ts`, `repro.ts`, `review.ts`, `screenshot.ts`, `show.ts`, `task.ts`, `telemetry.ts`, `test-radius.ts`, `test.ts`, `triage.ts`, `visual.ts`
**Problem:** Each file still contains 2–6 `process.exit()` calls interleaved with business logic. This prevents unit testing and makes control flow non-obvious.
**Needed:** Apply the same `run(): number` + centralized `process.exitCode` pattern to all remaining command files.

### P1: Test suite is placeholder-only
**Files:** `src/modules/*/__tests__/*.spec.ts`
**Problem:** 5 of 6 spec files contain only `expect(true).toBe(true)`. The only real test (`slug.spec.ts`) has shallow coverage.
**Needed:** Replace placeholders with real unit tests for pure functions: `parse_args`, `command_exists`, `split_command`, `resolve_backend`, `check_backend`, `strip_flag`, `build_banner`, `posix_quote`, `to_slug`, `derive_names`, `next_duplicate_slug`, all 6 adapter `build_args`, `is_agent_state`, `validate_state`, `get_repo_name`, `get_status_summary`.

### P2: Race condition in `AgentState` read-write cycle
**Files:** `src/modules/AgentState/useCases/state.ts`
**Problem:** `write_state()` reads the file, modifies in memory, then writes. Two concurrent calls can interleave and lose data.
**Needed:** Add file locking (e.g., `proper-lockfile` or atomic write with exclusive `open` flags) or redesign to a single-writer pattern.

### P2: `console.warn` side effects in `git.ts` and `state.ts`
**Files:** `src/modules/Workspace/useCases/git.ts`, `src/modules/AgentState/useCases/state.ts`
**Problem:** Utility functions call `console.warn()` as a side effect. This makes them non-pure and harder to test.
**Needed:** Return error results instead of logging, and let callers decide how to present warnings.

### P2: Magic strings for paths and config filenames
**Files:** Across the codebase
**Problem:** `.agents/tasks`, `.agents/state.json`, `.agents/logs`, `swarm.config.json`, `agent/` prefix are hardcoded in 20+ files.
**Needed:** Centralize path constants in `TaskManagement` or `Terminal` module.

### P3: Large markdown templates embedded in TypeScript
**Files:** `src/modules/Commands/useCases/refactor.ts`, `deps.ts`, `triage.ts`, `migrate.ts`, `pr.ts`
**Problem:** Multi-line markdown templates are embedded as template literals inside `.ts` files.
**Needed:** Move templates to `.md` files in `scaffold/` and load them at runtime, or use a minimal template engine.

---

## Risks

1. **Untested command files:** With no real tests, regressions in the 49 command files will only be caught at runtime.
2. **Race condition in state writes:** Concurrent `swarm` invocations (e.g., two agents finishing simultaneously) can corrupt `.agents/state.json`.
3. **Inconsistent error handling:** Some git utilities throw, some log warnings and return empty arrays. Callers cannot reason about failure uniformly.

---

## Suggested Approaches

1. **Batch-refactor remaining command files** using the `run(): number` pattern. This is mechanical but touches many files.
2. **Add unit tests for pure functions first** — zero mocks needed, high confidence, quick wins.
3. **Introduce a `Paths` constant object** in `Terminal/useCases/config.ts` or a new `TaskManagement/services/paths.ts` to eliminate magic string duplication.
4. **Consider moving command files to a proper handler framework** using `createHandler` from `#/helpers/createHandler` as described in AGENTS.md, instead of standalone spawned scripts.
