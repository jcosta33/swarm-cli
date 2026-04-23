# Audit: Knip and Dependency-Cruiser Configuration

## Scope

Static-analysis tooling configuration and accuracy for the `swarm-cli` project:

- **Knip** — unused files, exports, and dependency detection
- **dependency-cruiser** — module-boundary and architectural-dependency enforcement

This audit covers the tool configs themselves (`knip.json`, `.dependency-cruiser.cjs`, `package.json`), the runtime behavior of the tools, and the true-positive / false-positive classification of every finding.

## Goal

Both tools run cleanly against the actual project structure, produce actionable output, and enforce the architectural rules documented in `AGENTS.md` and `docs/agents/02-file-types.md`.

- `pnpm deps:validate` must cruise real modules and catch architectural violations.
- `pnpm exec knip` must distinguish between dead code and dynamic-execution entry points.
- No unused production dependencies remain in `package.json`.

## Relevant code paths

| File | Role |
|------|------|
| `knip.json` | Knip entry-point and project-scope configuration |
| `.dependency-cruiser.cjs` | dep-cruiser rules and resolution options |
| `package.json` | Dependency manifest; `main`, `bin`, `dependencies`, `devDependencies` |
| `src/index.ts` | Main CLI dispatcher; spawns commands dynamically |
| `src/modules/Commands/useCases/*.ts` | Individual command files — spawned as child processes |
| `src/modules/Terminal/useCases/ui.ts` | Standalone dashboard — spawned as child process |
| `src/modules/Adapters/` | Agent-configuration module (currently un-imported) |
| `src/modules/TaskManagement/useCases/slug.ts` | Slug utilities — some exports unused |
| `src/modules/TaskManagement/useCases/template.ts` | Template engine — some exports unused |
| `src/modules/Terminal/useCases/cli.ts` | CLI helpers — many exports unused |
| `src/modules/Terminal/useCases/colors.ts` | ANSI color wrappers — many exports unused |
| `src/modules/Terminal/useCases/terminal.ts` | Terminal launcher — `check_backend` unused |
| `src/modules/Workspace/useCases/git.ts` | Git primitives — many exports unused |

## Current behavior

### dependency-cruiser

**Before this session:**
- Version `16.10.4` installed. TypeScript `6.0.3` was outside the supported range (`<6.0.0`), so the transpiler was disabled.
- `depcruise --info` showed `.ts` as unsupported (`x`).
- `pnpm deps:validate` reported **0 modules, 0 dependencies cruised** — the tool was a no-op.
- The config contained forbidden rules referencing paths that do not exist in this repo (`src/core`, `src/commands`, `src/cli`, `src/adapters`, `src/utils` with wrong boundaries).

**After fixes:**
- Upgraded to `dependency-cruiser@17.3.10` (supports TypeScript `<7.0.0`).
- Rewrote `.dependency-cruiser.cjs` to match the actual DDD module structure (`src/modules/*`).
- Fixed two circular dependencies in `src/modules/Terminal/` caused by intra-module barrel imports:
  - `Terminal/useCases/ui.ts` imported colors from `'../index.ts'` → changed to `'./colors.ts'`
  - `Terminal/useCases/terminal.ts` imported colors from `'../index.ts'` → changed to `'./colors.ts'`
- `pnpm deps:validate` now cruises **72 modules, 156 dependencies** with **0 violations**.

### Knip

**Before this session:**
- `knip.json` listed only `src/index.ts` and `bin/swarm.js` as entries.
- Because `src/index.ts` spawns commands via `spawnSync` (dynamic execution, not static import), Knip could not trace the call graph.
- Result: **68 "unused files"** — essentially the entire source tree flagged as dead code.
- Several unused dependencies and exports were hidden behind the flood of false-positive unused files.

**After fixes:**
- Added `src/modules/Commands/useCases/*.ts` and `src/modules/Terminal/useCases/ui.ts` as explicit entry points.
- Removed redundant `bin/swarm.js` entry (already discovered via `package.json` `bin` field).
- Added `src/modules/Commands/index.ts` to `ignore` because the barrel exists for architectural consistency but is never statically imported (commands are spawned, not imported).
- Removed from `package.json`:
  - `"main": "index.js"` — file did not exist.
  - `ora` — no usage in source.
  - `eslint-plugin-prettier` — not referenced in ESLint configs.
  - `eslint-plugin-unicorn` — not referenced in ESLint configs.
  - `ts-morph` — not imported anywhere (`ast.ts` uses plain regex).
  - `tsx` — not referenced in scripts or source.

**Remaining Knip output (true positives):**

```
Unused files (7)
src/modules/Adapters/index.ts
src/modules/Adapters/useCases/claude.ts
src/modules/Adapters/useCases/codex.ts
src/modules/Adapters/useCases/droid.ts
src/modules/Adapters/useCases/gemini.ts
src/modules/Adapters/useCases/kimi.ts
src/modules/Adapters/useCases/opencode.ts

Unused exports (21)
next_duplicate_slug       function  src/modules/TaskManagement/useCases/slug.ts:57:17
render_template           function  src/modules/TaskManagement/useCases/template.ts:14:17
find_markdown_files       function  src/modules/Terminal/useCases/cli.ts:54:17
is_git_repo               function  src/modules/Terminal/useCases/cli.ts:136:17
format_size               function  src/modules/Terminal/useCases/cli.ts:148:17
command_exists            function  src/modules/Terminal/useCases/cli.ts:164:17
colors                    object    src/modules/Terminal/useCases/colors.ts:6:14
c                         function  src/modules/Terminal/useCases/colors.ts:33:17
magenta                   function  src/modules/Terminal/useCases/colors.ts:50:17
success                   function  src/modules/Terminal/useCases/colors.ts:63:17
info                      function  src/modules/Terminal/useCases/colors.ts:66:17
warn                      function  src/modules/Terminal/useCases/colors.ts:69:17
error                     function  src/modules/Terminal/useCases/colors.ts:72:17
box                       function  src/modules/Terminal/useCases/colors.ts:76:17
check_backend             function  src/modules/Terminal/useCases/terminal.ts:268:17
find_worktree_for_branch  function  src/modules/Workspace/useCases/git.ts:98:17
is_worktree_dirty         function  src/modules/Workspace/useCases/git.ts:146:17
get_status_summary        function  src/modules/Workspace/useCases/git.ts:161:17
list_branches_by_prefix   function  src/modules/Workspace/useCases/git.ts:219:17
git_available             function  src/modules/Workspace/useCases/git.ts:237:17
worktree_sync             function  src/modules/Workspace/useCases/git.ts:248:17
```

## Findings

1. **dependency-cruiser was completely non-functional.** The installed version (16.x) could not parse TypeScript 6.x files, so it cruised zero modules while reporting success. The config was a verbatim copy from another project (the DAW repo) with path rules pointing to `src/core`, `src/commands`, `src/cli`, etc., none of which exist in `swarm-cli`.

2. **Intra-module barrel imports caused real circular dependencies.** `Terminal/useCases/ui.ts` and `Terminal/useCases/terminal.ts` imported color utilities from `'../index.ts'` (their own module barrel). This created `index.ts → useCases/ui.ts → index.ts` and `index.ts → useCases/terminal.ts → index.ts` cycles. The AGENTS.md rule "Same module — relative imports" was violated.

3. **Knip's entry-point config did not account for dynamic spawning.** The CLI's primary execution model is `spawnSync(process.execPath, ['--experimental-strip-types', cmdPath, ...])`. No static import graph exists from `src/index.ts` into the command files. Knip therefore reported the entire command layer as dead code.

4. **The `Adapters` module is entirely dead code.** No source file imports from `src/modules/Adapters/`. Agent configuration is handled inside `load_config` (`src/modules/Terminal/useCases/config.ts`) via a hard-coded `DEFAULTS` object and optional `swarm.config.json`. The Adapters TypeScript files export `command` and `build_args` values that are never consumed.

5. **A large public API surface is exported but unused.** `Workspace/useCases/git.ts`, `Terminal/useCases/cli.ts`, `Terminal/useCases/colors.ts`, and `Terminal/useCases/terminal.ts` export many functions that are not imported by any entry point. These appear to be speculative exports — written for future commands but never wired up.

## Priorities

1. **P0 — Remove or wire up the `Adapters` dead module.** Seven files with zero consumers. Either delete them and remove the module, or refactor `load_config` to import agent configs from Adapters instead of hard-coding them.

2. **P1 — Audit and trim speculative exports.** 21 unused exports bloat the public API and slow future refactors. Functions that have no callers should be un-exported (kept as module-private) or removed if they have no plausible use case.

3. **P2 — Keep knip and dep-cruiser configs maintained.** Both tools now run correctly. Any new module or entry point (e.g., a new command file) must be added to `knip.json` `entry`. Any new architectural boundary must be reflected in `.dependency-cruiser.cjs`.

## Open issues

1. **`Adapters` module has no consumers.**
   - **Files:** `src/modules/Adapters/index.ts`, `src/modules/Adapters/useCases/*.ts` (6 files)
   - **Problem:** The module exports agent configurations (`command`, `build_args`) but `load_config` hard-codes agent defaults in `DEFAULTS.agents` and reads from `swarm.config.json`. The TypeScript files are never imported.
   - **Needed:** Either (a) delete the Adapters module entirely, or (b) refactor `load_config` to import agent configs from `src/modules/Adapters/index.ts` and remove the hard-coded defaults.

2. **21 unused exports across four files.**
   - **Files:**
     - `src/modules/TaskManagement/useCases/slug.ts` — `next_duplicate_slug`
     - `src/modules/TaskManagement/useCases/template.ts` — `render_template`
     - `src/modules/Terminal/useCases/cli.ts` — `find_markdown_files`, `is_git_repo`, `format_size`, `command_exists`
     - `src/modules/Terminal/useCases/colors.ts` — `colors`, `c`, `magenta`, `success`, `info`, `warn`, `error`, `box`
     - `src/modules/Terminal/useCases/terminal.ts` — `check_backend`
     - `src/modules/Workspace/useCases/git.ts` — `find_worktree_for_branch`, `is_worktree_dirty`, `get_status_summary`, `list_branches_by_prefix`, `git_available`, `worktree_sync`
   - **Problem:** Exported API surface with no callers increases maintenance burden and obscures what is actually used.
   - **Needed:** For each export, either (a) un-export it (remove `export` keyword) if it is used only within the file, (b) delete it if it has no uses at all, or (c) wire it up to a command if it has a legitimate future use case.

## Open questions

- Should `Adapters` be kept as a forward-looking module for multi-agent support, or is it premature abstraction? The current JSON-config approach is simpler and sufficient.
- Several `Workspace` git utilities (`find_worktree_for_branch`, `is_worktree_dirty`, etc.) are unexported but well-implemented. Are they intended for future commands (e.g., `swarm status --dirty`, `swarm sync`) or should they be deleted?
- `check_backend` in `terminal.ts` validates terminal backends but is never called. Should commands like `swarm new` validate the backend before launching?

## Risks

- **Dead-code rot.** The `Adapters` module and unused exports create the illusion of functionality. Future developers may assume `Adapters/useCases/claude.ts` drives Claude agent launches and waste time editing a file that has no effect.
- **Tool config drift.** If a new command is added but not added to `knip.json` `entry`, Knip will regress to reporting it as unused. The dynamic-spawning architecture requires manual bookkeeping.
- **False confidence in dep-cruiser.** Before this fix, `pnpm deps:validate` reported success while cruising zero modules. CI pipelines or scripts relying on its exit code would have passed silently. This pattern could repeat if TypeScript is upgraded past dep-cruiser's supported range again.

## Suggested approaches

1. **For `Adapters`:** Remove the module and its files. If multi-agent config complexity grows later, re-introduce it with a clear import path from `load_config`.

2. **For unused exports:** Run a focused cleanup pass. Remove `export` from functions with zero external callers. Delete functions with zero internal callers. The AGENTS.md "One Function Per File" rule already keeps files small, so deleting an unused function is low-risk.

3. **For knip maintenance:** Document in `AGENTS.md` or a repo README that new command files must be added to `knip.json` `entry`. Consider a small validation script that asserts every `.ts` file in `Commands/useCases/` is listed in `knip.json`.

4. **For dep-cruiser maintenance:** Pin `dependency-cruiser` to a version range known to support the installed TypeScript major version. The current `^17.3.10` is safe for TypeScript 6.x.

## Recommendation

Address **Open issue #1** first: decide the fate of the `Adapters` module. Deleting it is the lowest-effort, highest-clarity option. Then run a focused PR to trim the 21 unused exports. Finally, add a one-line comment at the top of `knip.json` reminding future editors to keep the `entry` list in sync with new command files.

## Resolved

- dependency-cruiser upgraded from `16.10.4` → `17.3.10` to support TypeScript 6.x.
- `.dependency-cruiser.cjs` rewritten to match `swarm-cli` module boundaries (`src/modules/*`).
- Circular dependencies in `src/modules/Terminal/` eliminated by converting intra-module barrel imports to relative imports.
- `knip.json` updated with command-file entry points and `Commands/index.ts` ignored.
- Stale `package.json` fields and unused dependencies removed (`main`, `ora`, `eslint-plugin-prettier`, `eslint-plugin-unicorn`, `ts-morph`, `tsx`).

---

**Post-audit follow-up completed:**

- `Adapters` module **wired up** — `Adapters/index.ts` now exports `get_adapter(name)`. `new.ts` and `open.ts` look up adapters at launch time and call `build_args(slug, agentCfg.args)` to build agent-specific argument lists. Agent configs in `load_config` still serve as the source of command/args defaults, but adapters provide per-agent arg shaping.
- `next_duplicate_slug` **wired up** into `new.ts` — when a slug collision is detected and `reuseExistingByDefault` is false, the slug is auto-incremented (`slug-2`, `slug-3`, etc.) before deriving names.
- `command_exists` **wired up** into `new.ts` and `open.ts` — validates the agent binary is in PATH before launching.
- `check_backend` **wired up** into `new.ts` and `open.ts` — validates the terminal backend is available before launching.
- `find_markdown_files` **wired up** into `knowledge.ts` — replaced the inline `find_files` recursive function.
- `find_worktree_for_branch` **wired up** into `open.ts` — replaced manual `sandboxes.find()` lookup.
- `is_worktree_dirty` and `get_status_summary` **wired up** into `show.ts` — displays git status and dirty-state warning in sandbox details.
- `list_branches_by_prefix` **wired up** into `list.ts` — shows orphaned branches (agent branches with no worktree).
- `git_available` **wired up** into `get_repo_root` — early validation with a clear error message if git is not installed.
- `success`, `error`, `info`, `warn`, `box` **wired up** into `new.ts`, `show.ts`, and `list.ts` for consistent CLI formatting.
- `render_template` **un-exported** (module-private, only used by `create_or_update_task_file`).
- `colors`, `c`, `magenta` **un-exported** (internal implementation details).
- `format_size` **deleted** (no use case).
- `is_git_repo` **deleted** (redundant with `get_repo_root` try/catch pattern).
- `worktree_sync` **kept exported** — useful API for a future `sync` command.

**Final knip state:** 1 unused export (`worktree_sync` — intentionally kept for future use).
