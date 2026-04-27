#!/usr/bin/env node

import { intro, outro, log } from '@clack/prompts';
import color from 'picocolors';

export function print_help(): void {
    intro(color.bgCyan(color.black(' Swarm CLI ')));
    log.message(`
  Usage: swarm                       (open the interactive dashboard)
         swarm <command> [args]
         swarm <agent>   [args]      (proxy to claude/codex/droid/gemini/...)

  Setup & lifecycle:
    init                             Setup Swarm in the current repository
    new <slug> [title] [--launch]    Create a new isolated sandbox task
    open <slug>                      Reopen an existing sandbox terminal
    list                             List active sandboxes
    show <slug>                      Show detailed metadata for a sandbox
    status <slug>                    Runtime status (state + telemetry + dirtiness)
    task <slug>                      Append human feedback to the task file
    pick [action]                    Fuzzy-finder over sandboxes (open by default)
    focus <slug>                     Open the sandbox in your editor
    path <slug>                      Print absolute path of a sandbox
    remove <slug> [--force]          Forcefully remove a sandbox
    prune                            Clean up merged or orphaned sandboxes
    merge <branch>                   Merge a branch with structured conflict reporting
    pr <slug> [--push] [--draft]     Auto-commit and (optionally) open a PR
    health                           Quick pre-flight environment checks
    doctor                           Deep diagnostics
    dashboard                        Re-open the interactive TUI

  Validation & test loops:
    validate                         Run configured lint/typecheck commands
    test [...vitest-args]            Run Vitest with truncated output
    test-radius <file>               Run only the specs impacted by <file>
    daemon                           Background watcher: re-runs test-radius on save
    repro                            Verify TDD: tests modified before source code
    format <file>                    Run Prettier on a single file

  Context, search & analysis:
    compress <file>                  Skeletonize TS file (drop bodies, keep signatures)
    graph <file>                     Map import/export dependencies
    references <symbol> [--path d]   Fast git-grep for symbol usages
    find <type> <target>             Search for class/interface/function/implements/extends
    docs <file>                      Extract JSDoc blocks
    complexity <file>                Cyclomatic complexity heuristic
    audit-sec <file>                 Scan for dangerous patterns and secrets
    dead-code <file>                 Find exported symbols never imported elsewhere
    context [dir]                    Generate semantic export map (RAG)
    arch                             Lint cross-module boundary invariants

  Memory, knowledge & telemetry:
    memory <get|set|list>            Markdown-backed cross-agent memory bank
    knowledge <query>                Search past tasks, audits, specs, and PRs
    logs [--agent a] [--slug s]      Query / tail / prune the telemetry SQLite DB
        [--follow] [--prune <days>]
        [--events]                   Tail the NDJSON event log instead of sessions
    telemetry                        Aggregated session metrics dashboard

  Multi-agent orchestration:
    epic <file>                      Decompose a markdown checklist into child tasks
    decompose <graph.json>           Run a typed task DAG
        [--dry-run] [--execute]
    triage <file>                    Convert a raw bug report into a verifiable spec
    review <slug>                    Spawn an adversarial peer-review agent
    chat <slug> [--message ...]      Append-only IPC log between two agents
    message <slug> <json>            Queue a structured message into a mailbox
    lock <claim|release|list>        Advisory file locking for parallel agents
    heal                             Self-healing hotfix when typecheck fails

  Production-scale tooling:
    refactor <dir> <goal>            Break a refactor into 5-file chunks
    migrate <file> <lang>            Translator + Verifier agent pair
    mock <file> <Name>               Generate a TS mock factory for an interface
    fuzz <file> <func>               Generate fuzz tests against a function
    chaos <start|stop>               Toggle latency/failure injection in .env.local
    visual <baseline|compare> [url]  Screenshot-based visual regression
    screenshot [url]                 Capture a Playwright screenshot
    profile <cmd>                    Profile a Node process and assign optimizer
    release                          Bump semver, generate changelog & notes
    deps                             Find outdated packages and queue upgrade tasks

  Workspace utilities:
    ast-rename <file> <Old> <New>    Structural rename across a file
    capabilities                     Print registered command/adapter catalog
    help                             Show this reference

  Supported agent runtimes (auto-install on first use):
    claude, codex, droid, gemini, kimi, opencode, aider, cline, swe-agent

  Tip: 'swarm <agent>' inside a sandbox launches that agent CLI in the worktree.
`);
    outro();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    print_help();
}
