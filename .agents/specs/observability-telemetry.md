# Observability & Telemetry

## Context

Swarm CLI currently uses `console.log` and `console.error` scattered across command files. There is no unified logging format, no execution history, and no way to query past agent sessions. Research in `.agents/research/observability-telemetry.md` evaluated Pino, OpenTelemetry, SQLite, and AsyncLocalStorage.

## Goal

The CLI captures structured logs, session metadata, and events in a local SQLite database, with a unified logger interface and context propagation via `AsyncLocalStorage`. Users can query history with `swarm logs`.

## User-visible behavior

- All CLI output is structured NDJSON when `SWARM_LOG_FORMAT=json` is set.
- `swarm logs` lists recent agent sessions with duration, exit code, and agent name.
- `swarm logs --follow --agent claude` tails events for running agents.
- `swarm logs --prune --older-than 30d` deletes old records.
- `swarm status <slug>` reads from the telemetry database for richer output.

## Scope

**In scope:**
- Unified `Logger` service with Pino-like NDJSON output.
- `AsyncLocalStorage` context propagation for trace IDs and slugs.
- SQLite telemetry database (`sessions` and `events` tables).
- `swarm logs` command with filtering, tailing, and pruning.
- Replacing `console.log/error/warn` in `Commands/useCases/` with the logger.

**Non-goals:**
- OpenTelemetry SDK integration.
- External SaaS dashboards.
- Real-time metrics aggregation (counts, rates).

## Requirements

1. **Logger interface** — `logger.info()`, `logger.error()`, etc., outputting NDJSON to stdout or a file.
2. **Context propagation** — Every command runs inside an `AsyncLocalStorage` context carrying `trace_id` and `slug`.
3. **SQLite schema** — `sessions` (id, slug, agent, model, started_at, finished_at, exit_code) and `events` (id, session_id, timestamp, level, event_type, message, metadata JSON).
4. **Database initialisation** — Auto-created on first CLI invocation if missing. WAL mode enabled.
5. **`swarm logs` command** — Supports `--json`, `--follow`, `--agent <name>`, `--slug <slug>`, `--since <iso>`, `--prune`.
6. **Console replacement** — All existing `console.*` calls in `Commands/useCases/` migrated to the logger.

## Constraints

- Must use a SQLite library that works on macOS ARM64, Linux x64, and Windows without additional build tools.
- Must not change CLI behaviour for users who do not use `swarm logs`.
- Must follow DDD: logger in `Terminal`, telemetry DB in `AgentState`, commands in `Commands`.

## Design decisions

### Decision: `better-sqlite3` with WAL mode

**Chosen:** `better-sqlite3` for synchronous, fast SQLite access.

**Considered and rejected:**
- `sql.js` (WASM) — slower, no file-system persistence.
- `node:sqlite` (Node 22.5+ experimental) — too new, may change API.
- Pure JSON files — not queryable, grow unbounded.

### Decision: Pino-style NDJSON without the `pino` dependency

**Chosen:** Implement a minimal NDJSON logger to avoid adding a dependency.

**Considered and rejected:**
- `pino` — excellent but adds ~100KB; our needs are minimal.
- `console` as-is — not structured, hard to parse.

## Acceptance criteria

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test:run` passes.
- [ ] After running `swarm new test-log --launch`, `.agents/logs/telemetry.db` exists and contains a session row.
- [ ] `swarm logs --json` outputs valid NDJSON with session and event data.
- [ ] `swarm logs --prune --older-than 0d` deletes all records and returns success.
- [ ] No `console.log` or `console.error` remains in `src/modules/Commands/useCases/`.
- [ ] `pnpm deps:validate` passes.

## Implementation notes

- Create `src/modules/Terminal/services/logger.ts` with `Logger` class and `AsyncLocalStorage` integration.
- Create `src/modules/AgentState/services/telemetry.ts` with SQLite schema, `record_session()`, `record_event()`, and query functions.
- Add `src/modules/Commands/useCases/logs.ts` for the command.
- Modify `src/index.ts` to wrap `main()` in `AsyncLocalStorage.run()`.
- Modify `new.ts`, `open.ts`, `list.ts`, etc., to use `logger.info()` instead of `console.log()`.
- The telemetry DB path should be `join(repoRoot, '.agents', 'logs', 'telemetry.db')`.

## Test plan

1. Unit test: `Logger` outputs valid NDJSON with correct level and message.
2. Unit test: `telemetry.record_session` inserts a row and `query_sessions` retrieves it.
3. Integration test: Run a command, verify the DB file is created and populated.
4. Manual: `swarm logs --follow` while an agent is running; verify events appear in real time.

## Open questions

- [ ] **[CRITICAL]** `better-sqlite3` requires `node-gyp`. Will it install cleanly in this environment? Need to test `pnpm add better-sqlite3` before committing to it.
- [ ] **[MINOR]** Should stdout from the agent process itself be captured in the telemetry DB, or only orchestrator events?

## Tradeoffs and risks

- `better-sqlite3` native compilation is the biggest risk. If it fails, fallback to `node:sqlite` (Node 22+) or a pure-JS alternative.
- Replacing all `console.*` calls is tedious and error-prone. Do it incrementally, module by module.
- SQLite write concurrency from multiple agents is handled by WAL mode but may still bottleneck with many concurrent writers. For now, the orchestrator does most of the writing; agents write only if they explicitly call telemetry APIs.
