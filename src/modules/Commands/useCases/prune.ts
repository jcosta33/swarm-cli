#!/usr/bin/env node

import {
    cyan,
    dim,
    green,
    red,
    yellow,
} from '../../Terminal/index.ts';
import { load_config } from '../../Terminal/index.ts';
import { remove_state } from '../../AgentState/index.ts';
import {
    delete_branch,
    get_repo_root,
    is_branch_merged_into,
    worktree_list,
    worktree_prune,
    worktree_remove,
} from '../../Workspace/index.ts';

function run() {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch (_e: unknown) {
        console.error(red('Error: Not inside a git repository.'));
        process.exit(1);
    }

    const config = load_config(repoRoot);
    const baseBranch = config.defaultBaseBranch ?? 'main';
    const sandboxes = worktree_list(repoRoot);

    console.log(cyan('\n🧹 Pruning Swarm Sandboxes\n'));

    let removedCount = 0;

    for (const s of sandboxes) {
        const slug = s.branch?.replace('agent/', '');
        if (!slug || slug === 'main' || slug === baseBranch) continue;

        const isMerged = is_branch_merged_into(
            s.branch ?? '',
            baseBranch,
            repoRoot
        );

        if (isMerged) {
            console.log(
                yellow(`Removing merged sandbox: ${slug}`)
            );
            try {
                worktree_remove(s.path, true, repoRoot);
                delete_branch(s.branch ?? '', repoRoot, true);
                remove_state(repoRoot, slug);
                removedCount++;
                console.log(green(`  ✓ Removed ${slug}`));
            } catch (_e: unknown) {
                const e = _e instanceof Error ? _e : new Error(String(_e));
                console.error(red(`  ✗ Failed to remove ${slug}: ${e.message}`));
            }
        }
    }

    // Also prune any stale git worktree refs
    try {
        worktree_prune(repoRoot);
    } catch {
        /* best effort */
    }

    if (removedCount === 0) {
        console.log(dim('No merged sandboxes to prune.'));
    } else {
        console.log(green(`\nPruned ${removedCount.toString()} sandbox(es).`));
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run();
}
