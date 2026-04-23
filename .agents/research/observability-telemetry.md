# Observability & Telemetry for Agent Swarms

> **Note:** Research on structured logging, distributed tracing, and metrics collection for CLI-orchestrated AI agent sessions running in isolated git worktrees.

---

## Research question

What lightweight observability stack can the Swarm CLI adopt to capture structured logs, execution traces, and aggregate metrics from AI agent sessions, without requiring external infrastructure (no SaaS, no Docker) and without violating developer privacy?

---

## Sources

- **[S1]** OpenTelemetry. _Node.js SDK Getting Started_. https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- **[S2]** OpenTelemetry. _OTLP File Exporter (Experimental)_. https://opentelemetry.io/docs/specs/otlp/
- **[S3]** pino documentation. _Extreme mode logging_. https://getpino.io/#/docs/benchmarks
- **[S4]** Node.js documentation. _Async Hooks and AsyncLocalStorage_. https://nodejs.org/api/async_context.html
- **[S5]** SQLite documentation. _Full-text search (FTS5)_. https://www.sqlite.org/fts5.html
- **[S6]** hyperfine documentation. _Benchmarking tool_. https://github.com/sharkdp/hyperfine

---

## Key findings

### Structured logging with Pino

`pino` is the fastest Node.js logger and outputs newline-delimited JSON (NDJSON). It is ideal for CLI tools because:
- Zero dependencies (itself is lightweight).
- Logs are machine-parseable without a separate logging daemon.
- Child loggers inherit context (e.g., `logger.child({ agent: 'claude', slug: 'oauth-refactor' })`).

```ts
import pino from 'pino';
const logger = pino({ level: process.env.SWARM_LOG_LEVEL ?? 'info' });
const child = logger.child({ agentSlug: 'oauth-refactor', backend: 'iterm' });
child.info({ event: 'worktree_created', path: '/tmp/...' }, 'Worktree ready');
```

Output:
```json
{"level":30,"time":1713723456789,"agentSlug":"oauth-refactor","backend":"iterm","event":"worktree_created","path":"/tmp/...","msg":"Worktree ready"}
```

### Distributed tracing with OpenTelemetry (OTLP File)

OpenTelemetry's Node.js SDK supports an experimental OTLP File exporter that writes traces to a local file instead of sending them over HTTP/gRPC [S2]. This satisfies the "no external infrastructure" constraint.

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-file';

const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ filePath: '.agents/logs/traces.jsonl' }),
});
sdk.start();
```

A trace spans from `swarm new` through agent launch, agent execution, to `swarm merge`. Each worktree session is a span; commands within it are child spans.

Trade-offs:
- OpenTelemetry SDK is ~2MB and has many sub-dependencies. This conflicts with the lightweight CLI philosophy.
- OTLP File exporter is experimental and may break between versions.

### AsyncLocalStorage for implicit context propagation

Node.js `AsyncLocalStorage` allows context (trace IDs, agent slugs) to propagate through async calls without explicit passing. This is how OpenTelemetry itself works [S4].

```ts
import { AsyncLocalStorage } from 'async_hooks';
const traceStorage = new AsyncLocalStorage<{ traceId: string; slug: string }>();

function withTrace<T>(traceId: string, slug: string, fn: () => T): T {
    return traceStorage.run({ traceId, slug }, fn);
}

// Inside any async function:
const ctx = traceStorage.getStore();
logger.info({ traceId: ctx?.traceId }, 'Agent finished');
```

### SQLite-based telemetry store

For aggregate metrics (tokens used, duration, success rate), a local SQLite database is superior to log files:
- Queryable with SQL.
- FTSS for full-text search over agent outputs [S5].
- Single file (`.agents/logs/telemetry.db`) that can be committed or `.gitignore`d.

Schema sketch:

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    agent TEXT NOT NULL,
    model TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    exit_code INTEGER,
    tokens_input INTEGER,
    tokens_output INTEGER
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT,
    metadata TEXT -- JSON
);
```

### CLI-native telemetry: timing and resource usage

For measuring agent performance without external tools:

```ts
import { performance } from 'perf_hooks';
const start = performance.now();
// ... run agent ...
const duration = performance.now() - start;
```

Process resource usage:
```ts
import { resourceUsage } from 'process';
const usage = resourceUsage();
// usage.maxRSS — peak memory in kilobytes
```

---

## Relevant patterns and snippets

### Pattern: Unified Logger Interface

```ts
// src/modules/Terminal/services/logger.ts
interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    event: string;
    slug?: string;
    metadata?: Record<string, unknown>;
    message: string;
}

export function write_log(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    fs.appendFileSync('.agents/logs/events.jsonl', line + '\n', { flag: 'a' });
}
```

### Pattern: SQLite Session Recorder

```ts
// src/modules/AgentState/services/telemetry.ts
import Database from 'better-sqlite3';

const db = new Database('.agents/logs/telemetry.db');
db.exec(`CREATE TABLE IF NOT EXISTS sessions (...)`);

export function record_session(session: SessionRecord): void {
    const stmt = db.prepare(`INSERT INTO sessions (...) VALUES (...)`);
    stmt.run(session);
}
```

---

## Comparison / tradeoffs

| Criterion              | Pino NDJSON | OpenTelemetry | SQLite | AsyncLocalStorage |
| ---------------------- | ----------- | ------------- | ------ | ----------------- |
| Zero external infra      | ✅           | ✅ (file mode) | ✅     | ✅                |
| Queryable                | ❌ (grep)    | ❌ (otel-cli)  | ✅     | N/A               |
| Distributed trace view   | ❌           | ✅             | ⚠️     | N/A               |
| Dependency weight        | Light       | Heavy          | Medium | Built-in          |
| Privacy (local only)     | ✅           | ✅             | ✅     | ✅                |
| Aggregations / dashboards| ❌           | ❌             | ✅     | N/A               |

---

## Applicability to this repo

Swarm CLI must remain lightweight and self-contained. Therefore:

- **OpenTelemetry SDK is excluded** (too heavy, experimental file exporter).
- **Pino + SQLite combo is the sweet spot:** Pino for fast, structured stdout/NDJSON logging; SQLite for aggregate metrics and searchable history.
- **`AsyncLocalStorage`** should be used to propagate `trace_id` and `slug` through the CLI without threading them through every function signature.
- The telemetry database should live in `.agents/logs/telemetry.db` and be `.gitignore`d by default (developer may choose to commit it).
- All existing `console.log` / `console.error` calls in `Commands/useCases/` should be replaced with the unified logger.

---

## Risks and uncertainties

- `better-sqlite3` requires native compilation (`node-gyp`). On Windows without build tools, installation fails. Consider `bun:sqlite` if migrating to Bun, or a pure-JS alternative like `sql.js` (WASM, no native code, but slower).
- Log files grow unbounded. Need log rotation or a `swarm logs --prune` command.
- Privacy: if agent outputs contain secrets, the telemetry DB could leak them. Sanitise or exclude stdout/stderr from the DB, keeping only metadata.
- SQLite concurrency: multiple agents writing to the same DB from different processes. SQLite handles this with WAL mode, but performance degrades with many writers. For high-frequency events, buffer in memory and flush periodically.

---

## Recommendation

1. **Create a `Logger` service** in `src/modules/Terminal/services/logger.ts` that wraps `console` for now but uses a unified `LogEntry` format. Replace all `console.log/error/warn` in `Commands/useCases/` with it.
2. **Add `AsyncLocalStorage` context** in `src/index.ts` so that every command runs inside a context with `trace_id` and `slug`.
3. **Build a SQLite telemetry module** in `src/modules/AgentState/services/telemetry.ts` with a minimal schema (sessions + events). Use WAL mode.
4. **Add `swarm logs` command** to query and tail the telemetry database. Support `--json`, `--follow`, and `--agent` filters.
5. **Defer OpenTelemetry** until there is a need for distributed tracing across multiple machines or integration with external observability platforms.
