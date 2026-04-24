import { get_repo_name, worktree_list } from '../../Workspace/index.ts';

import { describe, expect, it, vi } from 'vitest';

// Mock child_process spawnSync for worktree_list tests
vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('child_process')>();
    return {
        ...actual,
        spawnSync: vi.fn(),
    };
});

import { spawnSync } from 'child_process';

describe('workspace module', () => {
    describe('get_repo_name', () => {
        it('returns the basename of a repo root path', () => {
            expect(get_repo_name('/Users/dev/projects/swarm-cli')).toBe('swarm-cli');
            expect(get_repo_name('/home/user/my-repo')).toBe('my-repo');
        });
    });

    describe('worktree_list', () => {
        it('parses git worktree list --porcelain output', () => {
            const mockOutput = `worktree /Users/dev/projects/swarm-cli
HEAD abc1234
branch refs/heads/main

worktree /Users/dev/projects/swarm-cli--feature-x
HEAD def5678
branch refs/heads/agent/feature-x

worktree /Users/dev/bare-repo
HEAD 0000000
bare
`;
            (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
                status: 0,
                stdout: mockOutput,
                stderr: '',
            });

            const list = worktree_list('/Users/dev/projects/swarm-cli');

            expect(list).toHaveLength(3);
            expect(list[0]).toEqual({ path: '/Users/dev/projects/swarm-cli', head: 'abc1234', branch: 'main', bare: false });
            expect(list[1]).toEqual({ path: '/Users/dev/projects/swarm-cli--feature-x', head: 'def5678', branch: 'agent/feature-x', bare: false });
            expect(list[2]).toEqual({ path: '/Users/dev/bare-repo', head: '0000000', branch: null, bare: true });
        });

        it('returns empty array when git command fails', () => {
            (spawnSync as ReturnType<typeof vi.fn>).mockReturnValue({
                status: 128,
                stdout: '',
                stderr: 'fatal: not a git repository',
            });

            const list = worktree_list('/not-a-repo');
            expect(list).toEqual([]);
        });
    });
});
