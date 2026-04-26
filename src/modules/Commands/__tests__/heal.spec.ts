import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/heal.ts';
import { spawnSync } from 'child_process';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), spawnSync: vi.fn() };
});

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

describe('heal', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 0 when typecheck passes', () => {
        let callCount = 0;
        vi.mocked(spawnSync).mockImplementation(() => {
            callCount++;
            return { status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>;
        });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('spawns fix agent when typecheck fails', () => {
        let callCount = 0;
        vi.mocked(spawnSync).mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return { status: 1, stdout: '', stderr: 'error' } as ReturnType<typeof spawnSync>;
            }
            return { status: 0, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>;
        });
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });
});
