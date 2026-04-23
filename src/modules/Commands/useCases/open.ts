#!/usr/bin/env node

import {
    bold,
    cyan,
    parse_args,
    red,
} from '../../Terminal/index.ts';
import { read_state } from '../../AgentState/index.ts';
import {
    find_worktree_for_branch,
    get_repo_root,
} from '../../Workspace/index.ts';

import { run_agent_launch } from './launch-agent.ts';

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { positional } = parse_args(process.argv.slice(2));
    const slug = positional[0];

    if (!slug) {
        console.log(red('Usage: swarm open <slug>'));
        return 1;
    }

    const matchPath = find_worktree_for_branch(`agent/${slug}`, repoRoot);

    if (!matchPath) {
        console.error(red(`No sandbox found for slug "${slug}".`));
        return 1;
    }

    const state = read_state(repoRoot)[slug] ?? {};
    const agent = state.agent ?? undefined;

    console.log(cyan(`Opening ${bold(slug)}...`));

    return run_agent_launch({ repoRoot, slug, worktreePath: matchPath, agent });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        process.exitCode = run();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(red(`Unexpected error: ${message}`));
        process.exitCode = 1;
    }
}
