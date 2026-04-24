

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { basename } from 'path';

interface WorktreeInfo {
    path: string;
    head: string | null;
    branch: string | null;
    bare: boolean;
}

/**
 * Run a git command and return stdout as string.
 */
function git(args: string[], opts: { cwd?: string } = {}): string {
    const result = spawnSync('git', args, {
        cwd: opts.cwd,
        encoding: 'utf8',
    });
    if (result.error) throw new Error(`git error: ${result.error.message}`);
    if (result.status !== 0) {
        throw new Error((result.stderr || "").trim() || `git ${args[0]} failed`);
    }
    return (result.stdout || "").trim();
}

/**
 * Find the root of the current git repository.
 */
export function get_repo_root(): string {
    if (!git_available()) {
        throw new Error('git is not installed or not in PATH.');
    }
    try {
        return git(['rev-parse', '--show-toplevel']);
    } catch {
        throw new Error('Not inside a git repository. Run this command from within the repo.');
    }
}

/**
 * Get the repo directory name (used for worktree path patterns).
 */
export function get_repo_name(repoRoot: string): string {
    return basename(repoRoot);
}

/**
 * Parse `git worktree list --porcelain` output into an array of objects.
 */
export function worktree_list(repoRoot: string): WorktreeInfo[] {
    let raw: string;
    try {
        raw = git(['worktree', 'list', '--porcelain'], { cwd: repoRoot });
    } catch {
        return [];
    }
    const worktrees: WorktreeInfo[] = [];
    let current: WorktreeInfo | null = null;
    for (const line of raw.split('\n')) {
        if (line.startsWith('worktree ')) {
            if (current) worktrees.push(current);
            current = { path: line.slice(9), head: null, branch: null, bare: false };
        } else if (line.startsWith('HEAD ') && current) {
            current.head = line.slice(5);
        } else if (line.startsWith('branch ') && current) {
            current.branch = line.slice(7).replace('refs/heads/', '');
        } else if (line === 'bare' && current) {
            current.bare = true;
        }
    }
    if (current) worktrees.push(current);
    return worktrees;
}

/**
 * Check if a local branch exists.
 */
export function branch_exists(branch: string, repoRoot: string): boolean {
    const result = spawnSync('git', ['rev-parse', '--verify', `refs/heads/${branch}`], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    return result.status === 0;
}

/**
 * Find which worktree (if any) has a given branch checked out.
 */
export function find_worktree_for_branch(branch: string, repoRoot: string): string | null {
    const list = worktree_list(repoRoot);
    const found = list.find((w) => w.branch === branch);
    return found ? found.path : null;
}

/**
 * Create a new worktree. If branch doesn't exist, creates it from baseBranch.
 */
export function worktree_create(worktreePath: string, branch: string, baseBranch: string, repoRoot: string) {
    const exists = branch_exists(branch, repoRoot);
    if (exists) {
        git(['worktree', 'add', worktreePath, branch], { cwd: repoRoot });
    } else {
        git(['worktree', 'add', '-b', branch, worktreePath, baseBranch], { cwd: repoRoot });
    }
}

/**
 * Remove a worktree. Uses --force if requested.
 */
export function worktree_remove(worktreePath: string, force: boolean, repoRoot: string) {
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(worktreePath);
    git(args, { cwd: repoRoot });
}

/**
 * Run `git worktree prune`.
 */
export function worktree_prune(repoRoot: string) {
    git(['worktree', 'prune'], { cwd: repoRoot });
}

/**
 * Check if a worktree has uncommitted changes.
 */
export function is_worktree_dirty(worktreePath: string): boolean {
    if (!existsSync(worktreePath)) return false;
    const result = spawnSync('git', ['status', '--porcelain'], {
        cwd: worktreePath,
        encoding: 'utf8',
    });
    if (result.status !== 0) return false;
    return (result.stdout || "").trim().length > 0;
}

/**
 * Get a short git status summary for a worktree.
 */
export function get_status_summary(worktreePath: string): string {
    if (!existsSync(worktreePath)) return 'missing';
    const result = spawnSync('git', ['status', '--porcelain'], {
        cwd: worktreePath,
        encoding: 'utf8',
    });
    if (result.status !== 0) return 'unknown';
    const lines = (result.stdout || "").trim();
    if (!lines) return 'clean';
    const count = lines.split('\n').length;
    return `dirty (${String(count)} change${count !== 1 ? 's' : ''})`;
}

/**
 * Check if a local branch is fully merged into another branch.
 */
export function is_branch_merged_into(branch: string, baseBranch: string, repoRoot: string): boolean {
    const refs = [baseBranch, `origin/${baseBranch}`];
    for (const ref of refs) {
        try {
            // A branch with 0 unique commits relative to this ref is empty, not merged
            const uniqueCount = parseInt(git(['rev-list', '--count', `${ref}..${branch}`], { cwd: repoRoot }), 10);
            if (uniqueCount === 0) continue;

            const output = git(['branch', '--merged', ref], { cwd: repoRoot });
            const merged = output.split('\n').map((l: string) => l.trim().replace(/^[*+]\s*/, ''));
            if (merged.includes(branch)) return true;
        } catch {
            // Ignore check errors and try next ref
        }
    }
    return false;
}

/**
 * Delete a local branch.
 */
export function delete_branch(branch: string, repoRoot: string, force = false) {
    git(['branch', force ? '-D' : '-d', branch], { cwd: repoRoot });
}

/**
 * List all local branches matching a prefix.
 */
export function list_branches_by_prefix(prefix: string, repoRoot: string): string[] {
    try {
        const output = git(['branch', '--list', `${prefix}*`], { cwd: repoRoot });
        return output
            .split('\n')
            .map((l: string) => l.trim().replace(/^[*+]\s*/, '')) // * = current branch, + = checked out in worktree
            .filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Check that git is available.
 */
function git_available() {
    const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
}

/**
 * Synchronize (rebase) a worktree's branch onto its base branch.
 * @returns true if successful, false if conflicts occurred
 */
export function worktree_sync(worktreePath: string, baseBranch: string): boolean {
    const result = spawnSync('git', ['rebase', baseBranch], {
        cwd: worktreePath,
        stdio: 'inherit',
        encoding: 'utf8',
    });
    return result.status === 0;
}
