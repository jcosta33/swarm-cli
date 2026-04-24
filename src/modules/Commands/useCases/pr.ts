#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { red, green, cyan, bold, dim, yellow, parse_args } from '../../Terminal/index.ts';
import { get_repo_root, worktree_list } from '../../Workspace/index.ts';

function findWorktreePath(slug: string, repoRoot: string) {
    const worktrees = worktree_list(repoRoot);
    const match = worktrees.find((w) => w.branch === `agent/${slug}`);
    return match ? match.path : null;
}

function run(): number {
    let repoRoot;
    try {
        repoRoot = get_repo_root();
    } catch (_e) {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { positional } = parse_args(process.argv.slice(2));
    const slug = positional[0];
    
    if (!slug) {
        console.log(red('Usage: agents:pr <slug>'));
        return 1;
    }

    const worktreeAbs = findWorktreePath(slug, repoRoot);
    if (!worktreeAbs) {
        console.error(red(`No active worktree found for "${slug}".`));
        return 1;
    }

    const taskFile = join(worktreeAbs, '.agents', 'tasks', `${slug}.md`);
    if (!existsSync(taskFile)) {
        console.error(red(`Task file not found at ${taskFile}`));
        return 1;
    }

    // Extract objective as PR title
    const content = readFileSync(taskFile, 'utf8');
    const objMatch = /## Objective\n+([^#]+)/.exec(content);
    const objective = objMatch ? objMatch[1].trim().split('\n')[0] : `Implement ${slug}`;

    console.log(cyan(`\nAuto-generating PR for ${bold(slug)}...`));
    console.log(dim(`Objective: ${objective}`));

    // Add changes
    spawnSync('git', ['add', '.'], { cwd: worktreeAbs });

    // Commit
    const commitMsg = `feat(${slug}): ${objective}\n\nAutomated commit via Swarm PR generator.`;
    const commitRes = spawnSync('git', ['commit', '-m', commitMsg], { cwd: worktreeAbs, stdio: 'inherit' });

    if (commitRes.status === 0) {
        console.log(green(`\n✓ Changes committed successfully.`));
        console.log(yellow(`To open the PR, push your branch: git push origin agents-${slug}`));
    } else {
        console.log(yellow(`\n✗ Git commit failed (maybe no changes to commit?).`));
    }
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
