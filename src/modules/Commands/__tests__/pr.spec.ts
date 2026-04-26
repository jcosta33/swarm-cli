import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/pr.ts';
import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), spawnSync: vi.fn() };
});

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
    worktree_list: vi.fn(() => [
        { path: '/tmp/repo/.agents/agent-foo', branch: 'agent/foo', head: 'abc' },
    ]),
}));

describe('pr', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mkdirSync('/tmp/repo/.agents/agent-foo/.agents/tasks', { recursive: true });
        writeFileSync('/tmp/repo/.agents/agent-foo/.agents/tasks/foo.md', '## Objective\nFix the bug\n', 'utf8');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 1 when slug is missing', () => {
        process.argv = ['node', 'script'];
        expect(run()).toBe(1);
    });

    it('stages and commits without --push', () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script', 'foo'];
        expect(run()).toBe(0);
    });
});
