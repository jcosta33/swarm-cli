#!/usr/bin/env node

import { parse_args, red } from '../../Terminal/index.ts';
import { get_repo_root } from '../../Workspace/index.ts';
import { spawnSync } from 'child_process';

interface MergeResult {
    success: boolean;
    branch: string;
    conflicts?: string[];
}

function run(): number {
    let repoRoot: string;
    try {
        repoRoot = get_repo_root();
    } catch {
        console.error(red('Error: Not inside a git repository.'));
        return 1;
    }

    const { positional } = parse_args(process.argv.slice(2));
    const branch = positional[0];

    if (!branch) {
        console.error(red('Usage: swarm merge <branch>'));
        return 1;
    }

    const result = spawnSync('git', ['merge', '--no-ff', '--no-commit', branch], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
    });

    const output = result.stdout + result.stderr;
    const conflicts: string[] = [];
    const conflictRegex = /CONFLICT \(([^)]+)\): ([^\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = conflictRegex.exec(output)) !== null) {
        conflicts.push(`${match[2].trim()} (${match[1]})`);
    }

    if (conflicts.length > 0 || result.status !== 0) {
        // Abort the merge to leave repo clean
        spawnSync('git', ['merge', '--abort'], { cwd: repoRoot, stdio: 'pipe' });

        const mergeResult: MergeResult = {
            success: false,
            branch,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
        };
        console.log(JSON.stringify(mergeResult, null, 2));
        return 1;
    }

    // Commit the merge
    const commitResult = spawnSync('git', ['commit', '-m', `Merge branch '${branch}'`], {
        cwd: repoRoot,
        stdio: 'pipe',
        encoding: 'utf8',
    });

    if (commitResult.status !== 0) {
        spawnSync('git', ['merge', '--abort'], { cwd: repoRoot, stdio: 'pipe' });
        const mergeResult: MergeResult = {
            success: false,
            branch,
            conflicts: ['Merge succeeded but commit failed.'],
        };
        console.log(JSON.stringify(mergeResult, null, 2));
        return 1;
    }

    const mergeResult: MergeResult = { success: true, branch };
    console.log(JSON.stringify(mergeResult, null, 2));
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = run();
}
