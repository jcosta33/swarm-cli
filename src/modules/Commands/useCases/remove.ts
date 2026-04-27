#!/usr/bin/env node

import {
    bold,
    cyan,
    green,
    logger,
    parse_args,
    red,
    yellow,
} from '../../Terminal/index.ts';
import { remove_state } from '../../AgentState/index.ts';
import { swarmBus } from '../../../infra/events/swarmBus.ts';
import {
    delete_branch,
    get_repo_root,
    worktree_list,
    worktree_remove,
} from '../../Workspace/index.ts';

export function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { flags, positional } = parse_args(process.argv.slice(2));
    const slug = positional[0];
    const force = flags.get('force') === true || flags.get('f') === true;

    if (!slug) {
        console.log(red('Usage: swarm remove <slug> [--force]'));
        return 1;
    }

    const sandboxes = worktree_list(repoRoot);
    const match = sandboxes.find((w) => w.branch === `agent/${slug}`);

    if (!match) {
        console.error(red(`No sandbox found for slug "${slug}".`));
        return 1;
    }

    console.log(
        yellow(
            `About to remove sandbox "${slug}"${force ? ' (forced)' : ''}.`
        )
    );
    console.log(cyan(`  Worktree: ${match.path}`));
    console.log(cyan(`  Branch:   ${match.branch ?? 'unknown'}`));

    if (!force) {
        console.log(
            red(`This is destructive. Use --force to confirm.`)
        );
        return 1;
    }

    const removeResult = worktree_remove(match.path, true, repoRoot);
    if (!removeResult.ok) {
        console.error(red(removeResult.error.message));
        return 1;
    }
    console.log(green('✓ Worktree removed.'));

    const deleteResult = delete_branch(match.branch ?? `agent/${slug}`, repoRoot, true);
    if (deleteResult.ok) {
        console.log(green('✓ Branch deleted.'));
    } else {
        logger.warn(yellow(`Warning: could not delete branch: ${deleteResult.error.message}`));
    }

    remove_state(repoRoot, slug);
    console.log(green(`✓ State cleared for "${bold(slug)}".`));

    void swarmBus.emit('sandbox.removed', { repoRoot, slug });

    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
