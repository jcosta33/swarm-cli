#!/usr/bin/env node

import {
    parse_args,
    red,
} from '../../Terminal/index.ts';
import {
    get_repo_root,
    worktree_list,
} from '../../Workspace/index.ts';

import { spawnSync } from 'child_process';

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
        console.log(red('Usage: swarm focus <slug>'));
        return 1;
    }

    const sandboxes = worktree_list(repoRoot);
    const match = sandboxes.find((w) => w.branch === `agent/${slug}`);

    if (!match) {
        console.error(red(`No sandbox found for slug "${slug}".`));
        return 1;
    }

    const editor = process.env.EDITOR ?? 'code';
    const res = spawnSync(editor, [match.path], {
        stdio: 'inherit',
        shell: true,
    });

    if (res.status !== 0) {
        console.error(red(`Failed to open editor.`));
        return 1;
    }
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
