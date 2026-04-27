import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { run } from '../useCases/deps.ts';
import { spawnSync } from 'child_process';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...(actual as object), spawnSync: vi.fn() };
});

import { writeFileSync } from 'fs';

vi.mock('../../Workspace/index.ts', () => ({
    get_repo_root: vi.fn(() => '/tmp/repo'),
}));

describe('deps', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        writeFileSync('/tmp/repo/package.json', '{}', 'utf8');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('checks outdated deps successfully', () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '{"package": {"current": "1.0.0", "latest": "2.0.0"}}', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });

    it('returns 0 when all deps are up to date', () => {
        vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: '{}', stderr: '' } as ReturnType<typeof spawnSync>);
        process.argv = ['node', 'script'];
        expect(run()).toBe(0);
    });
});
