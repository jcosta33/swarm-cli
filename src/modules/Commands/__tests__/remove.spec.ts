import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/remove.ts';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
    worktree_list: vi.fn(),
    // worktree_remove and delete_branch now return Result<>.
    worktree_remove: vi.fn((path: string) => ({ ok: true, value: { path } })),
    delete_branch: vi.fn((branch: string) => ({ ok: true, value: { branch } })),
}));

vi.mock('../../AgentState/index.ts', () => ({
    remove_state: vi.fn(),
}));

import { get_repo_root, worktree_list, worktree_remove } from '../../Workspace/index.ts';

describe('remove', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1 when slug is missing', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('returns 1 when sandbox not found', () => {
        vi.mocked(worktree_list).mockReturnValue([]);
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(1);
    });

    it('returns 1 without --force flag', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(1);
    });

    it('removes sandbox with --force', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        process.argv = ['node', 'script', 'foo', '--force'];
        expect(run()).toBe(0);
    });

    it('returns 1 when not in a git repo', () => {
        vi.mocked(get_repo_root).mockImplementation(() => { throw new Error('not a repo'); });
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(1);
    });

    it('returns 1 when worktree removal fails', () => {
        vi.mocked(worktree_list).mockReturnValue([
            { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
        ]);
        vi.mocked(worktree_remove).mockReturnValue({
            ok: false,
            error: Object.assign(new Error('git error'), {
                _tag: 'WorktreeRemoveFailed' as const,
                worktreePath: '/tmp/repo/.agents/agent-foo',
                force: true,
                stderr: 'git error',
            }),
        });
        process.argv = ['node', 'script', 'foo', '--force'];
        expect(run()).toBe(1);
    });
});
