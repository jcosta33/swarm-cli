#!/usr/bin/env node

import { intro, outro, log } from '@clack/prompts';
import color from 'picocolors';

export function print_help(): void {
    intro(color.bgCyan(color.black(' Swarm CLI ')));
    log.message(`
  Usage: swarm <command> [args]

  Core Subcommands:
    init              Setup Swarm in the current repository
    new <slug>        Create a new isolated sandbox task
    open <slug>       Reopen an existing sandbox
    list              List active sandboxes
    show <slug>       Show detailed metadata for a sandbox
    task <slug>       Append human feedback to the task file
    remove <slug>     Forcefully remove a sandbox and its worktree
    prune             Clean up merged or orphaned sandboxes
    validate          Run configured linters and typechecks
    test              Run the test runner
    test-radius <f>   Run impacted specs for a modified file
    health            Run pre-flight environment checks

  Context & Analysis:
    compress, graph, references, docs, complexity, audit-sec
    dead-code, format, logs, context, memory, knowledge

  Autonomous Lifecycles:
    epic, triage, arch, review, chat, repro, find, mock, daemon, heal

  Production Scale:
    refactor, deps, migrate, fuzz, chaos, visual, telemetry
    profile, release, screenshot, pr

  Workspace Management:
    ast rename, remove, prune, path, focus, pick

  Supported Agent Runtimes (Auto-install):
    aider, cline, swe-agent
`);
    outro();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    print_help();
}
