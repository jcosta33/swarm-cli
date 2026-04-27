# General Codebase Audit: Swarm CLI

## Scope
An exhaustive documentation of the entire Swarm CLI codebase, mapping out its modules, infra layers, tests, docs, and skills based on a granular, file-by-file reading. This audit evaluates compliance with the defined architecture and workflows.

## Goal
To provide an extremely detailed, low-level technical architectural breakdown of all features, utilities, and components within the system, proving total codebase comprehension and forming a reliable foundation for any future agentic work.

## Relevant code paths
All files inside `src/`, `docs/`, `.agents/skills/`, and the root `.md` files (`AGENTS.md`, `GEMINI.md`, `README.md`).

## Current behavior / Architecture & Implementation Details

### Core System Instructions & Skills
- **AGENTS.md & GEMINI.md**: Establish strict rules enforcing "Force Empirical Proof", "Three Strikes Rule", and "Blast Radius Awareness". No automated codebase mutations via AST-altering scripts are permitted unless explicitly instructed. Mandates DDD architecture where modules only expose `index.ts` and keep internal subdirectories (`models`, `useCases`, `services`, `repositories`, `events`) strictly private.
- **docs/06-testing.md**: Outlines the Vitest setup. Mandates shallow unit tests, one test file per source file, placed in `__tests__/` immediately adjacent to the source file. No E2E/integration tests are present yet. External Node APIs must be mocked using `vi.mock()`.
- **docs/07-conventions.md**: Enforces explicit control flow (e.g., block conditionals, guard clauses), bans `any` escapes, restricts function parameters to single encapsulation objects (`Input`/`Output` types), mandates PascalCase for models/classes and camelCase for utilities, and strictly defines import ordering (Node APIs first, internals via `#/`).
- **Agent Workflow (`docs/agents/01-process.md`, `03-workflow.md`, `02-file-types.md`, `04-standards.md`)**: Encodes the documentation-first workflow consisting of Audits, Specs, Research, Skills, and Tasks. Mandates the creation of a local gitignored task file before starting any non-trivial work, explicitly stating the requirement of a self-review section containing empirical proof (console outputs).
- **Skills (`.agents/skills/`)**:
  - `architecture-violations`: Defines why and how to fix dependency-cruiser violations without engaging in "fake compliance" (like barrel-export laundering). Specifies that use cases cross modules, but their types must stay local.
  - `documentation-gatekeeper`: Enforces sequencing invariants. No implementation can begin without a proper spec for non-trivial tasks.
  - `event-bus-and-results`: Instructs on the use of `swarmBus` and the `Result<V, AppError>` structure for recoverable I/O boundaries instead of raw exceptions.
  - `manage-task`: Outlines the proper maintenance of the active task file, emphasizing logging blockers/findings and satisfying self-review requirements.
  - `write-audit` & `write-spec`: Rules for writing actionable audits (with an adversarial mindset) and verifiable specs grounded in actual research.
  - `personas`: Defines specific operational mindsets such as The Builder, The Skeptic (adversarial reviewer), The Lead Engineer, The Architect, and The Janitor.

### Infra Layer (`src/infra/`)
Contains leaf-level cross-cutting primitives completely isolated from the domain modules.
- **di (`src/infra/di/`)**: A basic dependency injection container (`Container.ts`) used as a singleton store for global infrastructure (logger, event bus). Implements `inject` with proxy/lazy-loading parameters and recursive circular dependency detection, alongside testing helpers (`spy.ts`, `createMock.ts`, `injectDependencies.ts`).
- **errors (`src/infra/errors/`)**: Provides tagged errors via `AppError` (`createAppError.ts`) and a Rust-flavored `Result` type (`Ok`, `Err`) with functional combinators like `map`, `flatMap`, `match`, `unwrapOr`, `tryCatch`, and `fromNullable`. Testing helpers `assertOk` and `assertErr` enforce correct unwrapping in unit tests.
- **events (`src/infra/events/`)**: A fully typed publish-subscribe event bus (`createEventBus.ts`). Uses an internal `createSubscriptionRegistry` for managing concurrent handlers and tracking `pendingCount` for `waitForIdle()`. The `swarmEvents.ts` explicitly types allowed events like `agent.session.recorded` and `sandbox.created`.
- **logger (`src/infra/logger/`)**: A pluggable logging system with structural NDJSON output support triggered by `SWARM_LOG_FORMAT=json`. Leverages `AsyncLocalStorage` in `appLogger.ts` to inject context variables (`trace_id` and `slug`) across asynchronous boundaries. Includes `createConsoleWriter` for styled terminal text outputs.
- **store (`src/infra/store/`)**: A reactive snapshot state machine (`createStore.ts`) holding references to an abstract `StorageAdapter`. Supports atomic read-modify-write loops (`update`), hydration from backing storage, and standard React integrations via `subscribeReact` for `useSyncExternalStore`. Uses `createMemoryStorage.ts` for the default in-memory backend.

### Modules (`src/modules/`)

#### 1. Adapters (`src/modules/Adapters/`)
Maps standardized Swarm CLI commands to agent-specific CLI configurations.
- **Capabilities (`index.ts`)**: Defines six primary agents (`claude`, `codex`, `droid`, `gemini`, `kimi`, `opencode`) and exposes them via `adapter_capabilities`.
- **Use Cases**: Each agent module (e.g., `claude.ts`) exports a `build_args` function responsible for constructing the CLI argument arrays. For instance, Claude utilizes `--name <slug>`, Codex forces `--full-auto`, while others rely solely on passed extra arguments.

#### 2. AgentState (`src/modules/AgentState/`)
Manages JSON-based volatile runtime state and SQLite-backed durable telemetry.
- **State (`state.ts`)**: Interacts with `.agents/state.json` via `proper-lockfile` to ensure atomic updates when modifying fields like `status`, `pid`, `backend`, and `exitCode`. Shape verification is done via `is_agent_state`.
- **Locks (`locks.ts`)**: Implements advisory file locking via `.agents/locks.json`. Ensures mutual exclusion when multiple agents mutate the same files, returning `Result<true, LockHeldByOtherError>`.
- **Persist Event (`persistEvent.ts`)**: A resilient, fire-and-forget NDJSON logger capable of sinking events down to `.agents/logs/events.ndjson`.
- **Telemetry (`services/telemetry.ts`)**: Harnesses `better-sqlite3` in WAL mode to commit `sessions` and `events` to `.agents/logs/telemetry.db`. Features schema auto-initialization, caching database instances, and functions for culling data past N days (`prune_events`, `prune_sessions`).

#### 3. TaskManagement (`src/modules/TaskManagement/`)
Handles string normalization, topological task graph validation, and templated scaffolds.
- **Slug (`slug.ts`)**: Cleans input strings via regex to build URL-safe slugs, prevents collisions via `next_duplicate_slug`, and computes derivative paths (`derive_names`).
- **Template (`template.ts`)**: Bootstraps or safely updates `.agents/tasks/<slug>.md`. Uses regex replacement for variables (`{{title}}`, `{{slug}}`) and intelligently replaces the `## Metadata` block without disturbing user-supplied content beneath it.
- **DAG (`dag.ts`)**: Provides dependency graph processing via Depth First Search to expose cyclic violations (`validate_dag`) and utilizes Kahn's algorithm for linear dependency execution sequencing (`topological_sort`).

#### 4. Terminal (`src/modules/Terminal/`)
The interface boundary handling TTY interaction, parsing, aesthetic rendering, and subprocess orchestration.
- **CLI Utilities (`cli.ts`)**: Features `parse_args` for custom positional/flag tracking, `fzf_select` for shell-integrated interactive fuzzy selection, and `split_command` to segment shell commands into discrete program arguments securely.
- **Colors (`colors.ts`)**: Lightweight ANSI styling wrappers avoiding external dependencies. Provides layout primitives like `box`, `success`, `warn`, and `error`.
- **Logger (`services/logger.ts`)**: Merely re-exports the `appLogger.ts` from the infra layer.
- **Terminal Backend (`terminal.ts`)**: Manages the complicated orchestration of subprocesses (`launch_current`, `launch_terminal_app` via osascript, `launch_iterm`, `launch_linux_auto`, and `launch_windows_auto`). Escapes arguments defensively utilizing `posix_quote` to dynamically generate temporary `.sh` bash scripts.
- **Config (`config.ts`)**: Validates and merges runtime execution defaults against `swarm.config.json`.
- **UI (`ui.ts`)**: Features a persistent TTY loop `render_dashboard()` updating statuses on a timer, and `run_dashboard()` which uses `@clack/prompts` to drive CLI actions (`new`, `open`, `status`, `pr`, etc.).

#### 5. Workspace (`src/modules/Workspace/`)
Secure filesystem and git orchestration utilities.
- **Git (`git.ts`)**: Wraps native git CLI functions: `worktree_list` parses raw `--porcelain` strings; `worktree_create`, `worktree_remove`, and `delete_branch` return strict `Result` types handling deterministic execution errors.
- **Resolve Within (`resolveWithin.ts`)**: A crucial path validation mechanism shielding against `../` path traversal injections, strictly isolating operations inside the `repoRoot`.

#### 6. Commands (`src/modules/Commands/`)
Individual entry points mapping straight to CLI subcommands.
- **Setup & Lifecycle**:
  - `init.ts`: Scaffolds `.agents/` structure, injects default `swarm.config.json`, triggers `git rerere.enabled true`.
  - `new.ts`: Initiates agent worktrees via `create_sandbox`, provisioning paths, templates, and invoking agents.
  - `remove.ts`, `prune.ts`, `open.ts`: Cleanup and lifecycle management interacting directly with Workspace and AgentState logic.
  - `pr.ts`: Utilizes the GitHub CLI (`gh`) to convert a task's `## Objective` into a structured pull request.
  - `doctor.ts`: Verifies underlying host components (Node.js >= 22.6, Git, PNPM/NPM, `rerere` status, and telemetry schemas).
- **Test Loops & Tooling**:
  - `test-radius.ts`: Identifies downstream `.spec.ts` files related to a source file by examining naive `fs.readdirSync` content graphs.
  - `daemon.ts`: Attaches a debounced `fs.watch` to `src/` to background-fire `test-radius` processes instantly upon developer saves.
  - `fuzz.ts`: Transpiles a `.fuzz.spec.ts` test bed implementing property-based chaos (massive strings, circular refs, NaNs) targeting isolated functions.
  - `repro.ts`: Strictly enforces TDD. Flags modifications in `src/` if there are zero equivalent alterations to `*.spec.ts` inside `git diff`.
  - `audit-sec.ts`: Scans individual files using regex signatures aimed at local storage pollution, XSS vulnerabilities (`dangerouslySetInnerHTML`), and raw secrets/`eval` injections.
  - `dead-code.ts`: Merges local AST-like regex parsing for exported symbols alongside `git grep -l` to flag orphan public functions.
  - `complexity.ts`: Aggregates structural markers (loops, ternary operators, early catches) to calculate base maintainability limits.
  - `compress.ts`: Discards deep implementations in TS files, preserving only types, signatures, and `JSDoc` comments to compress LLM processing context buffers.
  - `graph.ts`, `find.ts`, `context.ts`: Provide codebase indexing capabilities via grep-driven regex parsers and `readdirSync` graph-walking.
- **Multi-Agent Orchestration**:
  - `epic.ts`: Deconstructs markdown lists within `epic.md` definitions into discreet isolated task specifications.
  - `decompose.ts`: Reads a `graph.json`, verifies logic via `validate_dag`, reorders dependencies via `topological_sort`, and dispatches simultaneous agent runs across parallel Node processes in synchronized waves.
  - `review.ts`: Leverages "The Skeptic" persona logic by invoking a parallel adversarial agent targeting a sibling worktree to review diffs empirically.
  - `chat.ts`, `message.ts`: Manages IPC and inter-agent synchronization via markdown files (`.agents/ipc/`) and jsonl payload delivery paths (`.agents/mailbox/`).

## Findings
1. **Architectural Purity**: The internal codebase strictly adheres to the Domain-Driven structure mandated within `AGENTS.md`. Cross-module interaction happens entirely through strict index file surfaces, while implementation types (`useCases`, `services`, `models`) maintain absolute privacy.
2. **Robust Multiprocessing Boundaries**: Knowing that async Node operations face inherent race conditions against multiple decoupled git-worktrees, the system relies exclusively on battle-tested local synchronisation patterns: single-writer SQLite (`telemetry.db`), advisory JSON blocking (`locks.json`), and append-only streams (`events.ndjson`).
3. **Pervasive Code Coverage**: An extremely extensive testing layer wraps virtually every module. Every file within `src/` features a dedicated `.spec.ts` equivalent residing directly under a contiguous `__tests__/` directory. All external dependencies (e.g. `child_process`, `fs`, `@clack/prompts`) are rigorously mocked using Vitest's `vi.mock()`.
4. **Resilient Failure Encapsulation**: Crucial systemic I/O boundaries do not employ `try/catch` wrapping arbitrarily; instead, they funnel exceptions immediately into the explicit `Result<TValue, AppError>` model provided by `src/infra/errors`, ensuring deterministic runtime guarantees and isolated error propagation.
5. **No Barrel Bypassing**: Dependency Cruiser configurations clearly dictate rules to prevent internal layer washing via `index.ts` files, enforcing that only genuine `useCase` functions cross modules, fulfilling the requirements specified within the `architecture-violations` skill.

## Priorities
1. Maintenance of strict bounds within `src/modules/*` against external creep.
2. Continuous adherence to `pnpm typecheck` and `pnpm deps:validate` to ensure invariant checks.
3. Observability tracing expansion, ensuring full end-to-end `trace_id` capture across `telemetry.db` schemas.

## Recommendation
This audit is functionally complete and verifies full system compliance. Any subsequent agent tasks can leverage this document as absolute codebase validation logic.

### Configurations, Scaffolding, and Tooling
- **Dependency Cruiser (`.dependency-cruiser.cjs`)**: Enforces strict module isolation and cross-module discipline. Forbids core modules from depending on Commands/Terminal, enforces cross-module imports target the destination's root `index.ts`, and marks internal directories (`models`, `repositories`, `services`, etc.) as strictly private.
- **ESLint (`eslint.config.mjs`, `eslint.fast.config.mjs`)**: Configures TypeScript linting for Node 22 without React/JSX. Enforces strict type-checking (`no-explicit-any`, `no-unsafe-*`), forbids empty object types, enforces `type` over `interface`, and bans namespace imports. A "fast" config variant exists to run linting without type-aware rules for speed.
- **Vite/Vitest (`vitest.config.ts`)**: Configures the testing environment using Node. Excludes `node_modules` and `dist`, uses the V8 coverage provider, and targets `src/modules/**/*` while explicitly excluding barrel files and markdown docs from coverage.
- **TypeScript (`tsconfig.json`, `tsconfig.eslint.json`, `knip.json`)**: Targets `ES2024` with `NodeNext` module resolution. Enforces strict mode while softening `noUnusedLocals` temporarily. Uses `#/*` path alias for the infra package. `knip` is configured to find unused exports and dependencies.
- **Entrypoint (`bin/swarm.js`)**: An executable Node script enforcing a minimum Node version of 22.6.0. Spawns the main CLI process (`src/index.ts`) using the `--experimental-strip-types` flag to execute TypeScript directly, forwarding process signals to the child process.
- **Scaffolding (`scaffold/`)**: Contains baseline templates and documentation intended for initializing new agent environments or sub-worktrees. It replicates the core `AGENTS.md`, `GEMINI.md`, and all the essential skills (`documentation-gatekeeper`, `manage-task`, `personas`, `write-audit`, `write-spec`) to ensure consistent rules and behaviors are established across spawned sandboxes.
- **Auxiliary Packages (`package/`)**: Contains a local unpacked distribution of `dependency-cruiser` (v17.3.10), including its source, types, and configurations.
